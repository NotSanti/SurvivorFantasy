create or replace function app_private.require_user_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  uid := (select auth.uid());
  if uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  return uid;
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
  order by rs.version desc
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

create or replace function public.create_league_invite(
  p_league_id uuid,
  p_expires_in_hours integer default 72,
  p_max_uses integer default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  token text;
  token_hash text;
begin
  uid := app_private.require_user_id();

  if not app_private.is_commissioner(p_league_id) then
    raise exception 'Only the commissioner can create invites' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.leagues l
    where l.id = p_league_id and l.status <> 'recruiting'
  ) then
    raise exception 'Invites are closed after selection begins' using errcode = '22023';
  end if;

  token := encode(extensions.gen_random_bytes(24), 'hex');
  token_hash := encode(extensions.digest(convert_to(token, 'UTF8'), 'sha256'), 'hex');

  insert into public.league_invites (
    league_id, token_hash, created_by, expires_at, max_uses
  ) values (
    p_league_id,
    token_hash,
    uid,
    now() + make_interval(hours => p_expires_in_hours),
    p_max_uses
  );

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (uid, 'invite.create', 'league', p_league_id, '{}'::jsonb);

  return token;
end;
$$;

create or replace function public.revoke_league_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  league uuid;
begin
  uid := app_private.require_user_id();
  select league_id into league from public.league_invites where id = p_invite_id;
  if league is null then
    raise exception 'Invite not found' using errcode = 'P0002';
  end if;
  if not app_private.is_commissioner(league) then
    raise exception 'Only the commissioner can revoke invites' using errcode = '42501';
  end if;

  update public.league_invites
  set revoked_at = now()
  where id = p_invite_id and revoked_at is null;
end;
$$;

create or replace function public.accept_league_invite(p_token text)
returns public.leagues
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  hashed_token text;
  invite public.league_invites%rowtype;
  league public.leagues%rowtype;
  member_count integer;
begin
  uid := app_private.require_user_id();
  hashed_token := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');

  select * into invite
  from public.league_invites
  where league_invites.token_hash = hashed_token
  for update;

  if invite.id is null then
    raise exception 'Invite is invalid' using errcode = 'P0002';
  end if;
  if invite.revoked_at is not null then
    raise exception 'Invite has been revoked' using errcode = '22023';
  end if;
  if invite.expires_at <= now() then
    raise exception 'Invite has expired' using errcode = '22023';
  end if;

  select * into league
  from public.leagues
  where id = invite.league_id
  for update;

  if league.status <> 'recruiting' then
    raise exception 'This league is no longer accepting members' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.league_members
    where league_id = league.id and user_id = uid and status = 'active'
  ) then
    return league;
  end if;

  select count(*) into member_count
  from public.league_members
  where league_id = league.id and status = 'active';

  if member_count >= league.max_members then
    raise exception 'This league is full' using errcode = '22023';
  end if;

  if invite.max_uses is not null and invite.use_count >= invite.max_uses then
    raise exception 'This invite has no remaining uses' using errcode = '22023';
  end if;

  insert into public.league_members (league_id, user_id, role, status)
  values (league.id, uid, 'member', 'active');

  update public.league_invites
  set use_count = use_count + 1
  where id = invite.id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (uid, 'invite.accept', 'league', league.id, jsonb_build_object('invite_id', invite.id));

  return league;
end;
$$;

create or replace function public.set_league_ready(p_league_id uuid, p_ready boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  uid := app_private.require_user_id();
  if not app_private.is_league_member(p_league_id) then
    raise exception 'Not a league member' using errcode = '42501';
  end if;

  update public.league_members
  set ready_at = case when p_ready then now() else null end
  where league_id = p_league_id and user_id = uid;
end;
$$;

create policy league_invites_commissioner_read on public.league_invites
  for select to authenticated
  using ((select app_private.is_commissioner(league_id)) or (select app_private.is_admin()));

grant select on public.league_invites to authenticated;

grant execute on function public.create_league(text, smallint) to authenticated;
grant execute on function public.create_league_invite(uuid, integer, integer) to authenticated;
grant execute on function public.revoke_league_invite(uuid) to authenticated;
grant execute on function public.accept_league_invite(text) to authenticated;
grant execute on function public.set_league_ready(uuid, boolean) to authenticated;

revoke execute on function public.create_league(text, smallint) from anon, public;
revoke execute on function public.create_league_invite(uuid, integer, integer) from anon, public;
revoke execute on function public.revoke_league_invite(uuid) from anon, public;
revoke execute on function public.accept_league_invite(text) from anon, public;
revoke execute on function public.set_league_ready(uuid, boolean) from anon, public;
