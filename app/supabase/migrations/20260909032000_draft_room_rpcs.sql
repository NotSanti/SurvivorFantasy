-- Draft Room RPCs: manual picks, idempotent wildcard, MVP, and league lock.

create or replace function app_private.require_selecting_member(p_league_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid;
  league_status public.league_status;
begin
  uid := app_private.require_user_id();
  if not app_private.is_league_member(p_league_id) then
    raise exception 'Not a league member' using errcode = '42501';
  end if;
  select status into league_status from public.leagues where id = p_league_id;
  if league_status is distinct from 'selecting' then
    raise exception 'League is not in selection' using errcode = '22023';
  end if;
  if app_private.league_is_locked(p_league_id) then
    raise exception 'League is locked' using errcode = '22023';
  end if;
  return uid;
end;
$$;

create or replace function app_private.manual_distribution(p_json jsonb)
returns integer[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    array_agg(value::integer order by value::integer desc),
    '{}'::integer[]
  )
  from jsonb_array_elements_text(p_json -> 'manual_distribution') as t(value);
$$;

create or replace function app_private.counts_fit_distribution(
  p_counts integer[],
  p_distribution integer[],
  p_tribe_count integer
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  padded integer[] := '{}';
  target integer[] := '{}';
  i integer;
begin
  if p_tribe_count is null or p_tribe_count <= 0 then
    return false;
  end if;
  padded := coalesce(p_counts, '{}');
  target := coalesce(p_distribution, '{}');
  padded := (
    select coalesce(array_agg(v order by v desc), '{}')
    from unnest(padded) as v
  );
  target := (
    select coalesce(array_agg(v order by v desc), '{}')
    from unnest(target) as v
  );
  while coalesce(array_length(padded, 1), 0) < p_tribe_count loop
    padded := padded || 0;
  end loop;
  while coalesce(array_length(target, 1), 0) < p_tribe_count loop
    target := target || 0;
  end loop;
  if coalesce(array_length(padded, 1), 0) > p_tribe_count then
    return false;
  end if;
  for i in 1..p_tribe_count loop
    if padded[i] > target[i] then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create or replace function public.save_manual_picks(p_league_id uuid, p_castaway_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  league_row public.leagues%rowtype;
  rule_row public.rule_sets%rowtype;
  dist integer[];
  tribe_count integer;
  slot_total integer;
  counts integer[];
  pick_count integer;
begin
  uid := app_private.require_selecting_member(p_league_id);
  perform pg_advisory_xact_lock(hashtext(p_league_id::text || ':' || uid::text));

  select * into league_row from public.leagues where id = p_league_id;
  select * into rule_row from public.rule_sets where id = league_row.ruleset_version_id;

  if exists (
    select 1
    from public.roster_entries
    where league_id = p_league_id
      and member_id = uid
      and acquisition_type = 'wildcard'
      and ends_episode is null
  ) then
    raise exception 'Member already has a wildcard' using errcode = '22023';
  end if;

  p_castaway_ids := coalesce(p_castaway_ids, '{}');
  pick_count := coalesce(array_length(p_castaway_ids, 1), 0);
  if pick_count <> (select count(distinct x) from unnest(p_castaway_ids) as x) then
    raise exception 'Duplicate castaway in manual picks' using errcode = '22023';
  end if;

  dist := app_private.manual_distribution(rule_row.picks_per_original_tribe);
  tribe_count := coalesce((rule_row.picks_per_original_tribe ->> 'tribe_count')::integer, 0);
  slot_total := coalesce((select sum(v) from unnest(dist) as v), 0);

  if pick_count > slot_total then
    raise exception 'Too many manual picks for the rule-set distribution' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(p_castaway_ids) as cid
    left join public.castaways c on c.id = cid
    where c.id is null
      or c.season_id <> league_row.season_id
      or c.status <> 'active'
      or c.original_tribe_id is null
  ) then
    raise exception 'Manual picks must be active Season castaways with an original tribe' using errcode = '22023';
  end if;

  select coalesce(array_agg(cnt), '{}')
  into counts
  from (
    select count(*)::integer as cnt
    from unnest(p_castaway_ids) as cid
    join public.castaways c on c.id = cid
    group by c.original_tribe_id
  ) s;

  if not app_private.counts_fit_distribution(counts, dist, tribe_count) then
    raise exception 'Picks do not fit the rule-set distribution' using errcode = '22023';
  end if;

  delete from public.roster_entries
  where league_id = p_league_id
    and member_id = uid
    and acquisition_type = 'manual'
    and ends_episode is null;

  insert into public.roster_entries (
    league_id,
    member_id,
    castaway_id,
    acquisition_type,
    slot_number,
    starts_episode
  )
  select
    p_league_id,
    uid,
    cid,
    'manual',
    ord::smallint,
    1
  from unnest(p_castaway_ids) with ordinality as t(cid, ord);

  delete from public.mvp_selections
  where league_id = p_league_id
    and member_id = uid
    and locked_at is null
    and not exists (
      select 1
      from public.roster_entries re
      where re.league_id = p_league_id
        and re.member_id = uid
        and re.castaway_id = mvp_selections.castaway_id
        and re.ends_episode is null
    );

  update public.league_members
  set ready_at = null
  where league_id = p_league_id and user_id = uid;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    uid,
    'roster.save_manual',
    'league',
    p_league_id,
    jsonb_build_object('count', pick_count)
  );
end;
$$;

create or replace function public.request_wildcard(p_league_id uuid, p_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  league_row public.leagues%rowtype;
  rule_row public.rule_sets%rowtype;
  dist integer[];
  tribe_count integer;
  slot_total integer;
  counts integer[];
  underfilled uuid;
  eligible uuid[];
  selected uuid;
  seed_material text;
  seed_hash text;
  n integer;
  idx integer;
  existing public.wildcard_audits%rowtype;
begin
  uid := app_private.require_selecting_member(p_league_id);
  perform pg_advisory_xact_lock(hashtext(p_league_id::text || ':' || uid::text));

  select * into existing
  from public.wildcard_audits
  where league_id = p_league_id and member_id = uid;

  if found then
    if existing.idempotency_key = p_idempotency_key then
      return jsonb_build_object(
        'selected_castaway_id', existing.selected_castaway_id,
        'eligible_castaway_ids', to_jsonb(existing.eligible_castaway_ids),
        'algorithm_version', existing.algorithm_version,
        'seed_hash', existing.seed_hash,
        'reused', true
      );
    end if;
    raise exception 'Member already has a wildcard' using errcode = '22023';
  end if;

  select * into league_row from public.leagues where id = p_league_id;
  select * into rule_row from public.rule_sets where id = league_row.ruleset_version_id;
  dist := app_private.manual_distribution(rule_row.picks_per_original_tribe);
  tribe_count := coalesce((rule_row.picks_per_original_tribe ->> 'tribe_count')::integer, 0);
  slot_total := coalesce((select sum(v) from unnest(dist) as v), 0);

  if (
    select count(*)
    from public.roster_entries
    where league_id = p_league_id
      and member_id = uid
      and acquisition_type = 'manual'
      and ends_episode is null
  ) <> slot_total then
    raise exception 'Request the wildcard only after eight manual picks' using errcode = '22023';
  end if;

  select coalesce(array_agg(cnt), '{}')
  into counts
  from (
    select count(*)::integer as cnt
    from public.roster_entries re
    join public.castaways c on c.id = re.castaway_id
    where re.league_id = p_league_id
      and re.member_id = uid
      and re.acquisition_type = 'manual'
      and re.ends_episode is null
    group by c.original_tribe_id
  ) s;

  if not app_private.counts_fit_distribution(counts, dist, tribe_count) then
    raise exception 'Picks do not fit the rule-set distribution' using errcode = '22023';
  end if;

  select c.original_tribe_id
  into underfilled
  from public.roster_entries re
  join public.castaways c on c.id = re.castaway_id
  where re.league_id = p_league_id
    and re.member_id = uid
    and re.acquisition_type = 'manual'
    and re.ends_episode is null
  group by c.original_tribe_id
  having count(*) = (
    select min(tribe_cnt)
    from (
      select count(*) as tribe_cnt
      from public.roster_entries re2
      join public.castaways c2 on c2.id = re2.castaway_id
      where re2.league_id = p_league_id
        and re2.member_id = uid
        and re2.acquisition_type = 'manual'
        and re2.ends_episode is null
      group by c2.original_tribe_id
    ) mins
  );

  if underfilled is null then
    raise exception 'Could not determine the underfilled tribe' using errcode = '22023';
  end if;

  select coalesce(array_agg(c.id order by c.id), '{}')
  into eligible
  from public.castaways c
  where c.season_id = league_row.season_id
    and c.original_tribe_id = underfilled
    and c.status = 'active'
    and not exists (
      select 1
      from public.roster_entries re
      where re.league_id = p_league_id
        and re.member_id = uid
        and re.castaway_id = c.id
        and re.ends_episode is null
    );

  n := coalesce(array_length(eligible, 1), 0);
  if n = 0 then
    raise exception 'No eligible castaways remain in the underfilled tribe' using errcode = '22023';
  end if;

  seed_material := p_idempotency_key::text || ':' || array_to_string(eligible, ',');
  seed_hash := encode(extensions.digest(convert_to(seed_material, 'UTF8'), 'sha256'), 'hex');
  idx := 1 + ((('x' || substr(seed_hash, 1, 15))::bit(60)::bigint % n + n) % n);
  selected := eligible[idx];

  insert into public.roster_entries (
    league_id,
    member_id,
    castaway_id,
    acquisition_type,
    slot_number,
    starts_episode
  )
  values (
    p_league_id,
    uid,
    selected,
    'wildcard',
    rule_row.roster_size,
    1
  );

  insert into public.wildcard_audits (
    league_id,
    member_id,
    idempotency_key,
    eligible_castaway_ids,
    selected_castaway_id,
    algorithm_version,
    seed_hash
  )
  values (
    p_league_id,
    uid,
    p_idempotency_key,
    eligible,
    selected,
    'uniform-v1',
    seed_hash
  );

  update public.league_members
  set ready_at = null
  where league_id = p_league_id and user_id = uid;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    uid,
    'roster.wildcard',
    'league',
    p_league_id,
    jsonb_build_object('algorithm_version', 'uniform-v1', 'seed_hash', seed_hash)
  );

  return jsonb_build_object(
    'selected_castaway_id', selected,
    'eligible_castaway_ids', to_jsonb(eligible),
    'algorithm_version', 'uniform-v1',
    'seed_hash', seed_hash,
    'reused', false
  );
end;
$$;

create or replace function public.set_mvp(p_league_id uuid, p_castaway_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  roster_count integer;
  has_wildcard boolean;
begin
  uid := app_private.require_selecting_member(p_league_id);
  perform pg_advisory_xact_lock(hashtext(p_league_id::text || ':' || uid::text));

  select count(*) into roster_count
  from public.roster_entries
  where league_id = p_league_id and member_id = uid and ends_episode is null;

  select exists (
    select 1
    from public.roster_entries
    where league_id = p_league_id
      and member_id = uid
      and acquisition_type = 'wildcard'
      and ends_episode is null
  ) into has_wildcard;

  if roster_count <> 9 or not has_wildcard then
    raise exception 'MVP requires a completed nine-person roster' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.roster_entries
    where league_id = p_league_id
      and member_id = uid
      and castaway_id = p_castaway_id
      and ends_episode is null
  ) then
    raise exception 'MVP must belong to the completed roster' using errcode = '22023';
  end if;

  insert into public.mvp_selections (league_id, member_id, castaway_id)
  values (p_league_id, uid, p_castaway_id)
  on conflict (league_id, member_id) do update
    set castaway_id = excluded.castaway_id
    where public.mvp_selections.locked_at is null;

  if not found and exists (
    select 1 from public.mvp_selections
    where league_id = p_league_id and member_id = uid and locked_at is not null
  ) then
    raise exception 'League is locked' using errcode = '22023';
  end if;

  update public.league_members
  set ready_at = null
  where league_id = p_league_id and user_id = uid;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    uid,
    'roster.mvp',
    'league',
    p_league_id,
    jsonb_build_object('castaway_id', p_castaway_id)
  );
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
  league_status public.league_status;
  roster_count integer;
  has_mvp boolean;
begin
  uid := app_private.require_user_id();
  if not app_private.is_league_member(p_league_id) then
    raise exception 'Not a league member' using errcode = '42501';
  end if;

  select status into league_status from public.leagues where id = p_league_id;

  if p_ready and league_status = 'selecting' then
    select count(*) into roster_count
    from public.roster_entries
    where league_id = p_league_id and member_id = uid and ends_episode is null;
    select exists (
      select 1 from public.mvp_selections
      where league_id = p_league_id and member_id = uid
    ) into has_mvp;
    if roster_count <> 9 or not has_mvp then
      raise exception 'Mark ready only after a complete roster and MVP' using errcode = '22023';
    end if;
  end if;

  update public.league_members
  set ready_at = case when p_ready then now() else null end
  where league_id = p_league_id and user_id = uid;
end;
$$;

create or replace function public.lock_league_selection(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  incomplete integer;
begin
  uid := app_private.require_user_id();
  if not app_private.is_commissioner(p_league_id) then
    raise exception 'Only the commissioner can lock the league' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_league_id::text));

  if not exists (
    select 1 from public.leagues where id = p_league_id and status = 'selecting'
  ) then
    raise exception 'The league can only lock from selection' using errcode = '22023';
  end if;

  select count(*) into incomplete
  from public.league_members m
  where m.league_id = p_league_id
    and m.status = 'active'
    and (
      m.ready_at is null
      or not exists (
        select 1 from public.mvp_selections mv
        where mv.league_id = p_league_id and mv.member_id = m.user_id
      )
      or (
        select count(*)
        from public.roster_entries re
        where re.league_id = p_league_id
          and re.member_id = m.user_id
          and re.ends_episode is null
      ) <> 9
      or not exists (
        select 1
        from public.roster_entries re
        where re.league_id = p_league_id
          and re.member_id = m.user_id
          and re.acquisition_type = 'wildcard'
          and re.ends_episode is null
      )
    );

  if incomplete > 0 then
    raise exception 'Cannot lock: a member is missing a valid roster, MVP, or ready mark' using errcode = '22023';
  end if;

  update public.leagues
  set status = 'locked', locked_at = now()
  where id = p_league_id and status = 'selecting';

  update public.selection_sessions
  set locked_at = now()
  where league_id = p_league_id and locked_at is null;

  update public.roster_entries
  set locked_at = now()
  where league_id = p_league_id and ends_episode is null and locked_at is null;

  update public.mvp_selections
  set locked_at = now()
  where league_id = p_league_id and locked_at is null;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (uid, 'league.lock_selection', 'league', p_league_id, '{}'::jsonb);
end;
$$;

grant execute on function public.save_manual_picks(uuid, uuid[]) to authenticated;
grant execute on function public.request_wildcard(uuid, uuid) to authenticated;
grant execute on function public.set_mvp(uuid, uuid) to authenticated;
grant execute on function public.lock_league_selection(uuid) to authenticated;
grant execute on function public.set_league_ready(uuid, boolean) to authenticated;

revoke execute on function public.save_manual_picks(uuid, uuid[]) from anon, public;
revoke execute on function public.request_wildcard(uuid, uuid) from anon, public;
revoke execute on function public.set_mvp(uuid, uuid) from anon, public;
revoke execute on function public.lock_league_selection(uuid) from anon, public;
revoke execute on function public.set_league_ready(uuid, boolean) from anon, public;
