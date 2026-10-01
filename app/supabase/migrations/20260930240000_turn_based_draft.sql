-- Turn-based tribe-alternating draft: session state, claim cap, RLS, RPCs.

alter table public.selection_sessions
  add column if not exists pick_order uuid[] not null default '{}'::uuid[],
  add column if not exists order_seed text,
  add column if not exists current_pick_index integer not null default 0,
  add column if not exists tribe_order uuid[] not null default '{}'::uuid[],
  add column if not exists draft_phase text not null default 'revealing';

alter table public.selection_sessions
  drop constraint if exists selection_sessions_draft_phase_check;

alter table public.selection_sessions
  add constraint selection_sessions_draft_phase_check
  check (draft_phase in ('revealing', 'picking', 'mvp', 'locked'));

create or replace function app_private.max_castaway_claims()
returns integer
language sql
immutable
set search_path = ''
as $fn$
  select 2;
$fn$;

create or replace function app_private.draft_member_count(p_pick_order uuid[])
returns integer
language sql
immutable
set search_path = ''
as $fn$
  select coalesce(cardinality(p_pick_order), 0);
$fn$;

create or replace function app_private.draft_current_member_id(
  p_pick_order uuid[],
  p_current_pick_index integer
)
returns uuid
language plpgsql
immutable
set search_path = ''
as $fn$
declare
  n integer := coalesce(cardinality(p_pick_order), 0);
begin
  if n = 0 then
    return null;
  end if;
  return p_pick_order[(p_current_pick_index % n) + 1];
end;
$fn$;

create or replace function app_private.draft_current_tribe_id(
  p_tribe_order uuid[],
  p_pick_order uuid[],
  p_current_pick_index integer
)
returns uuid
language plpgsql
immutable
set search_path = ''
as $fn$
declare
  n integer := coalesce(cardinality(p_pick_order), 0);
  t integer := coalesce(cardinality(p_tribe_order), 0);
  pass integer;
begin
  if n = 0 or t = 0 then
    return null;
  end if;
  pass := p_current_pick_index / n;
  return p_tribe_order[(pass % t) + 1];
end;
$fn$;

create or replace function app_private.castaway_claim_count(
  p_league_id uuid,
  p_castaway_id uuid
)
returns integer
language sql
stable
security definer
set search_path = ''
as $fn$
  select count(*)::integer
  from public.roster_entries
  where league_id = p_league_id
    and castaway_id = p_castaway_id
    and ends_episode is null;
$fn$;

create or replace function app_private.enqueue_draft_turn(
  p_league_id uuid,
  p_user_id uuid,
  p_pick_index integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if exists (
    select 1
    from public.notification_preferences p
    where p.user_id = p_user_id
      and p.draft_deadlines is false
  ) then
    return;
  end if;

  insert into public.notifications (user_id, title, body, route, league_id)
  values (
    p_user_id,
    'It''s your turn to pick',
    'Open the draft room and choose from this round''s tribe.',
    format('/leagues/%s/draft', p_league_id),
    p_league_id
  );

  insert into public.notification_outbox (event_type, dedupe_key, user_id, payload)
  values (
    'draft_turn',
    format('draft-turn:%s:%s', p_league_id, p_pick_index),
    p_user_id,
    jsonb_build_object(
      'league_id', p_league_id,
      'route', format('/leagues/%s/draft', p_league_id),
      'pick_index', p_pick_index
    )
  )
  on conflict (dedupe_key) do nothing;
end;
$fn$;

drop policy if exists roster_own_or_locked_read on public.roster_entries;

create policy roster_own_or_locked_read on public.roster_entries
  for select to authenticated
  using (
    (select app_private.is_admin())
    or (
      (select app_private.is_league_member(league_id))
      and (
        member_id = (select auth.uid())
        or (select app_private.league_is_locked(league_id))
        or exists (
          select 1
          from public.leagues l
          where l.id = roster_entries.league_id
            and l.status = 'selecting'
        )
      )
    )
  );

create or replace function public.start_league_selection(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  uid uuid;
  league_row public.leagues%rowtype;
  member_ids uuid[];
  tribe_ids uuid[];
  seed text;
  shuffled uuid[];
  member_count integer;
begin
  uid := app_private.require_user_id();
  if not app_private.is_commissioner(p_league_id) then
    raise exception 'Only the commissioner can start selection' using errcode = '42501';
  end if;

  select * into league_row from public.leagues where id = p_league_id;

  select coalesce(array_agg(m.user_id order by m.joined_at, m.user_id), '{}'::uuid[])
  into member_ids
  from public.league_members m
  where m.league_id = p_league_id and m.status = 'active';

  member_count := coalesce(cardinality(member_ids), 0);
  if member_count < 2 then
    raise exception 'A league needs at least two members before selection starts' using errcode = '22023';
  end if;

  select coalesce(array_agg(t.id order by t.sort_order nulls last, t.name, t.id), '{}'::uuid[])
  into tribe_ids
  from public.tribes t
  where t.season_id = league_row.season_id;

  if coalesce(cardinality(tribe_ids), 0) < 2 then
    raise exception 'Season needs at least two original tribes before selection starts' using errcode = '22023';
  end if;

  seed := encode(extensions.gen_random_bytes(16), 'hex');
  select coalesce(array_agg(mid order by md5(seed || mid::text), mid), '{}'::uuid[])
  into shuffled
  from unnest(member_ids) as mid;

  update public.leagues
  set status = 'selecting'
  where id = p_league_id and status = 'recruiting';

  if not found then
    raise exception 'Selection can only start from recruiting' using errcode = '22023';
  end if;

  insert into public.selection_sessions (
    league_id,
    rule_set_id,
    pick_order,
    order_seed,
    current_pick_index,
    tribe_order,
    draft_phase
  )
  values (
    p_league_id,
    league_row.ruleset_version_id,
    shuffled,
    seed,
    0,
    tribe_ids,
    'revealing'
  )
  on conflict (league_id) do update
    set rule_set_id = excluded.rule_set_id,
        pick_order = excluded.pick_order,
        order_seed = excluded.order_seed,
        current_pick_index = 0,
        tribe_order = excluded.tribe_order,
        draft_phase = 'revealing',
        locked_at = null
    where public.selection_sessions.locked_at is null;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    uid,
    'league.start_selection',
    'league',
    p_league_id,
    jsonb_build_object('pick_order', to_jsonb(shuffled), 'order_seed', seed)
  );
end;
$fn$;

create or replace function public.ack_draft_order(p_league_id uuid)
returns public.selection_sessions
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  uid uuid;
  session_row public.selection_sessions%rowtype;
  first_member uuid;
begin
  uid := app_private.require_selecting_member(p_league_id);
  perform pg_advisory_xact_lock(hashtext(p_league_id::text));

  select * into session_row
  from public.selection_sessions
  where league_id = p_league_id
  for update;

  if not found then
    raise exception 'Selection session not found' using errcode = '22023';
  end if;

  if session_row.draft_phase = 'revealing' then
    update public.selection_sessions
    set draft_phase = 'picking'
    where league_id = p_league_id
    returning * into session_row;

    first_member := app_private.draft_current_member_id(
      session_row.pick_order,
      session_row.current_pick_index
    );
    if first_member is not null then
      perform app_private.enqueue_draft_turn(
        p_league_id,
        first_member,
        session_row.current_pick_index
      );
    end if;

    insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
    values (
      uid,
      'league.ack_draft_order',
      'league',
      p_league_id,
      jsonb_build_object('first_member', first_member)
    );
  end if;

  return session_row;
end;
$fn$;

create or replace function public.submit_draft_pick(
  p_league_id uuid,
  p_castaway_id uuid
)
returns public.selection_sessions
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  uid uuid;
  league_row public.leagues%rowtype;
  rule_row public.rule_sets%rowtype;
  session_row public.selection_sessions%rowtype;
  castaway_row public.castaways%rowtype;
  current_member uuid;
  current_tribe uuid;
  claim_count integer;
  next_slot smallint;
  roster_count integer;
  incomplete integer;
  next_member uuid;
begin
  uid := app_private.require_selecting_member(p_league_id);
  perform pg_advisory_xact_lock(hashtext(p_league_id::text));

  select * into league_row from public.leagues where id = p_league_id;
  select * into rule_row from public.rule_sets where id = league_row.ruleset_version_id;
  select * into session_row
  from public.selection_sessions
  where league_id = p_league_id
  for update;

  if not found then
    raise exception 'Selection session not found' using errcode = '22023';
  end if;
  if session_row.draft_phase is distinct from 'picking' then
    raise exception 'Draft is not open for picks yet' using errcode = '22023';
  end if;

  current_member := app_private.draft_current_member_id(
    session_row.pick_order,
    session_row.current_pick_index
  );
  if current_member is distinct from uid then
    raise exception 'It is not your turn to pick' using errcode = '42501';
  end if;

  current_tribe := app_private.draft_current_tribe_id(
    session_row.tribe_order,
    session_row.pick_order,
    session_row.current_pick_index
  );

  select * into castaway_row from public.castaways where id = p_castaway_id;
  if castaway_row.id is null
    or castaway_row.season_id <> league_row.season_id
    or castaway_row.status <> 'active'
    or castaway_row.original_tribe_id is distinct from current_tribe
  then
    raise exception 'Pick must be an active castaway from the current tribe pool' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.roster_entries
    where league_id = p_league_id
      and member_id = uid
      and castaway_id = p_castaway_id
      and ends_episode is null
  ) then
    raise exception 'Castaway is already on your roster' using errcode = '22023';
  end if;

  claim_count := app_private.castaway_claim_count(p_league_id, p_castaway_id);
  if claim_count >= app_private.max_castaway_claims() then
    raise exception 'Castaway is already claimed by the maximum number of teams' using errcode = '22023';
  end if;

  select count(*)::integer into roster_count
  from public.roster_entries
  where league_id = p_league_id
    and member_id = uid
    and ends_episode is null;

  if roster_count >= rule_row.roster_size then
    raise exception 'Your roster is already complete' using errcode = '22023';
  end if;

  select coalesce(max(slot_number), 0) + 1 into next_slot
  from public.roster_entries
  where league_id = p_league_id
    and member_id = uid
    and ends_episode is null;

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
    p_castaway_id,
    'manual',
    next_slot,
    1
  );

  update public.selection_sessions
  set current_pick_index = current_pick_index + 1
  where league_id = p_league_id
  returning * into session_row;

  select count(*) into incomplete
  from public.league_members m
  where m.league_id = p_league_id
    and m.status = 'active'
    and (
      select count(*)
      from public.roster_entries re
      where re.league_id = p_league_id
        and re.member_id = m.user_id
        and re.ends_episode is null
    ) < rule_row.roster_size;

  if incomplete = 0 then
    update public.selection_sessions
    set draft_phase = 'mvp'
    where league_id = p_league_id
    returning * into session_row;
  else
    next_member := app_private.draft_current_member_id(
      session_row.pick_order,
      session_row.current_pick_index
    );
    if next_member is not null then
      perform app_private.enqueue_draft_turn(
        p_league_id,
        next_member,
        session_row.current_pick_index
      );
    end if;
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    uid,
    'roster.draft_pick',
    'league',
    p_league_id,
    jsonb_build_object(
      'castaway_id', p_castaway_id,
      'pick_index', session_row.current_pick_index - 1,
      'next_member', next_member,
      'draft_phase', session_row.draft_phase
    )
  );

  return session_row;
end;
$fn$;

create or replace function public.set_mvp(p_league_id uuid, p_castaway_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  uid uuid;
  league_row public.leagues%rowtype;
  rule_row public.rule_sets%rowtype;
  session_row public.selection_sessions%rowtype;
  roster_count integer;
  wildcard_count integer;
  require_wildcard boolean;
begin
  uid := app_private.require_selecting_member(p_league_id);

  select * into league_row from public.leagues where id = p_league_id;
  select * into rule_row from public.rule_sets where id = league_row.ruleset_version_id;
  select * into session_row from public.selection_sessions where league_id = p_league_id;

  select count(*) into roster_count
  from public.roster_entries
  where league_id = p_league_id and member_id = uid and ends_episode is null;

  if roster_count <> rule_row.roster_size then
    raise exception 'MVP requires a complete roster' using errcode = '22023';
  end if;

  if session_row.draft_phase is distinct from 'mvp' then
    raise exception 'MVP is only available after the draft finishes' using errcode = '22023';
  end if;

  require_wildcard := coalesce(rule_row.wildcard_slots, 0) > 0;
  if require_wildcard then
    select count(*) into wildcard_count
    from public.roster_entries
    where league_id = p_league_id
      and member_id = uid
      and acquisition_type = 'wildcard'
      and ends_episode is null;
    if wildcard_count < rule_row.wildcard_slots then
      raise exception 'MVP requires a complete roster including wildcard' using errcode = '22023';
    end if;
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
$fn$;

create or replace function public.lock_league_selection(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  uid uuid;
  league_row public.leagues%rowtype;
  rule_row public.rule_sets%rowtype;
  incomplete integer;
  require_wildcard boolean;
begin
  uid := app_private.require_user_id();
  if not app_private.is_commissioner(p_league_id) then
    raise exception 'Only the commissioner can lock the league' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_league_id::text));

  select * into league_row from public.leagues where id = p_league_id;
  if league_row.status is distinct from 'selecting' then
    raise exception 'The league can only lock from selection' using errcode = '22023';
  end if;

  select * into rule_row from public.rule_sets where id = league_row.ruleset_version_id;
  require_wildcard := coalesce(rule_row.wildcard_slots, 0) > 0;

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
      ) <> rule_row.roster_size
      or (
        require_wildcard
        and not exists (
          select 1
          from public.roster_entries re
          where re.league_id = p_league_id
            and re.member_id = m.user_id
            and re.acquisition_type = 'wildcard'
            and re.ends_episode is null
        )
      )
    );

  if incomplete > 0 then
    raise exception 'Cannot lock: a member is missing a valid roster, MVP, or ready mark' using errcode = '22023';
  end if;

  update public.leagues
  set status = 'locked', locked_at = now()
  where id = p_league_id and status = 'selecting';

  update public.selection_sessions
  set locked_at = now(), draft_phase = 'locked'
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
$fn$;

grant execute on function public.start_league_selection(uuid) to authenticated;
grant execute on function public.ack_draft_order(uuid) to authenticated;
grant execute on function public.submit_draft_pick(uuid, uuid) to authenticated;

revoke execute on function public.start_league_selection(uuid) from anon, public;
revoke execute on function public.ack_draft_order(uuid) from anon, public;
revoke execute on function public.submit_draft_pick(uuid, uuid) from anon, public;

revoke execute on function app_private.enqueue_draft_turn(uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function app_private.castaway_claim_count(uuid, uuid) from public, anon, authenticated;
