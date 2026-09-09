-- Rules sync runs, admin RPCs, prefer confirmed rule sets, alias mutations.

alter table public.rule_sets
  add column if not exists parser_version text not null default 'rules-v1';

create type public.rule_sync_status as enum (
  'not_published_yet',
  'noop',
  'draft_created',
  'parse_failed',
  'fetch_failed'
);

create table public.rule_sync_runs (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id),
  trigger_type public.import_trigger_type not null default 'manual',
  status public.rule_sync_status not null,
  source_url text,
  source_post_id bigint,
  source_modified_at timestamptz,
  source_hash text,
  parser_version text not null default 'rules-v1',
  http_status integer,
  proposed_rule_set_id uuid references public.rule_sets (id),
  error_code text,
  error_detail_redacted text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index rule_sync_runs_season_id_idx on public.rule_sync_runs (season_id, started_at desc);

alter table public.rule_sync_runs enable row level security;

create policy rule_sync_runs_admin_read on public.rule_sync_runs
  for select to authenticated
  using ((select app_private.is_admin()));

grant select on public.rule_sync_runs to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.is_admin();
$$;

create or replace function public.claim_first_admin()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  uid := app_private.require_user_id();
  if exists (select 1 from app_private.admin_users) then
    return app_private.is_admin();
  end if;
  insert into app_private.admin_users (user_id) values (uid);
  return true;
end;
$$;

create or replace function public.confirm_rule_set(p_rule_set_id uuid)
returns public.rule_sets
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  target public.rule_sets;
begin
  uid := app_private.require_user_id();
  if not app_private.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;

  select * into target from public.rule_sets where id = p_rule_set_id;
  if target.id is null then
    raise exception 'Rule set not found' using errcode = 'P0002';
  end if;
  if target.status not in ('draft', 'confirmed') then
    raise exception 'Only a draft rule set can be confirmed' using errcode = '22023';
  end if;

  update public.rule_sets
  set status = 'retired', pending_confirmation = false
  where season_id = target.season_id
    and status = 'confirmed'
    and id <> p_rule_set_id;

  update public.rule_sets
  set status = 'confirmed', pending_confirmation = false
  where id = p_rule_set_id
  returning * into target;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (uid, 'rules.confirm', 'rule_set', p_rule_set_id, jsonb_build_object('version', target.version));

  return target;
end;
$$;

create or replace function public.upsert_castaway_alias(
  p_season_id uuid,
  p_source_key text,
  p_normalized_source_name text,
  p_castaway_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  normalized text;
begin
  uid := app_private.require_user_id();
  if not app_private.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;
  normalized := lower(btrim(p_normalized_source_name));
  if normalized = '' then
    raise exception 'Alias cannot be empty' using errcode = '22023';
  end if;

  insert into public.castaway_source_aliases (season_id, source_key, normalized_source_name, castaway_id)
  values (p_season_id, p_source_key, normalized, p_castaway_id)
  on conflict (season_id, source_key, normalized_source_name)
  do update set castaway_id = excluded.castaway_id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    uid,
    'alias.upsert',
    'castaway',
    p_castaway_id,
    jsonb_build_object('name', normalized, 'source_key', p_source_key)
  );
end;
$$;

create or replace function public.delete_castaway_alias(
  p_season_id uuid,
  p_source_key text,
  p_normalized_source_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  uid := app_private.require_user_id();
  if not app_private.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;

  delete from public.castaway_source_aliases
  where season_id = p_season_id
    and source_key = p_source_key
    and normalized_source_name = p_normalized_source_name;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    uid,
    'alias.delete',
    'season',
    p_season_id,
    jsonb_build_object('name', p_normalized_source_name, 'source_key', p_source_key)
  );
end;
$$;

create or replace function public.create_league(
  p_name text,
  p_max_members smallint default 8
)
returns public.leagues
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  season_row public.seasons%rowtype;
  ruleset_id uuid;
  new_league public.leagues;
begin
  uid := app_private.require_user_id();

  if p_name is null or length(trim(p_name)) < 2 or length(trim(p_name)) > 40 then
    raise exception 'League name must be between 2 and 40 characters' using errcode = '22023';
  end if;
  if p_max_members < 2 or p_max_members > 20 then
    raise exception 'League size must be between 2 and 20' using errcode = '22023';
  end if;

  select * into season_row
  from public.seasons
  where number = 51
  limit 1;

  if season_row.id is null then
    raise exception 'Season 51 is not configured' using errcode = 'P0002';
  end if;

  select rs.id into ruleset_id
  from public.rule_sets rs
  where rs.season_id = season_row.id
  order by (rs.status = 'confirmed') desc, rs.version desc
  limit 1;

  if ruleset_id is null then
    raise exception 'No rule set is available for this season' using errcode = 'P0002';
  end if;

  insert into public.leagues (
    season_id, name, commissioner_id, status, max_members, ruleset_version_id
  ) values (
    season_row.id, trim(p_name), uid, 'recruiting', p_max_members, ruleset_id
  )
  returning * into new_league;

  insert into public.league_members (league_id, user_id, role, status)
  values (new_league.id, uid, 'commissioner', 'active');

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (uid, 'league.create', 'league', new_league.id, jsonb_build_object('name', new_league.name));

  return new_league;
end;
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.claim_first_admin() to authenticated;
grant execute on function public.confirm_rule_set(uuid) to authenticated;
grant execute on function public.upsert_castaway_alias(uuid, text, text, uuid) to authenticated;
grant execute on function public.delete_castaway_alias(uuid, text, text) to authenticated;

revoke execute on function public.is_admin() from anon, public;
revoke execute on function public.claim_first_admin() from anon, public;
revoke execute on function public.confirm_rule_set(uuid) from anon, public;
revoke execute on function public.upsert_castaway_alias(uuid, text, text, uuid) from anon, public;
revoke execute on function public.delete_castaway_alias(uuid, text, text) from anon, public;
