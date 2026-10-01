-- Per-round draft order: reshuffle pick_order after every full member pass.

create or replace function app_private.shuffle_draft_pick_order(p_league_id uuid)
returns table (order_seed text, pick_order uuid[])
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  member_ids uuid[];
  seed text;
  shuffled uuid[];
begin
  select coalesce(array_agg(m.user_id order by m.joined_at, m.user_id), '{}'::uuid[])
  into member_ids
  from public.league_members m
  where m.league_id = p_league_id
    and m.status = 'active';

  seed := encode(extensions.gen_random_bytes(16), 'hex');
  select coalesce(array_agg(mid order by md5(seed || mid::text), mid), '{}'::uuid[])
  into shuffled
  from unnest(member_ids) as mid;

  order_seed := seed;
  pick_order := shuffled;
  return next;
end;
$fn$;

revoke all on function app_private.shuffle_draft_pick_order(uuid) from public, anon, authenticated;

create or replace function public.start_league_selection(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  uid uuid;
  league_row public.leagues%rowtype;
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

  select coalesce(cardinality(m.user_ids), 0)
  into member_count
  from (
    select array_agg(lm.user_id) as user_ids
    from public.league_members lm
    where lm.league_id = p_league_id
      and lm.status = 'active'
  ) m;

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

  select s.order_seed, s.pick_order
  into seed, shuffled
  from app_private.shuffle_draft_pick_order(p_league_id) s;

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
  member_n integer;
  seed text;
  shuffled uuid[];
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

  member_n := coalesce(cardinality(session_row.pick_order), 0);

  if incomplete = 0 then
    update public.selection_sessions
    set draft_phase = 'mvp'
    where league_id = p_league_id
    returning * into session_row;
  elsif member_n > 0 and session_row.current_pick_index % member_n = 0 then
    -- Round complete: reshuffle and reveal the next round's order before picks resume.
    select s.order_seed, s.pick_order
    into seed, shuffled
    from app_private.shuffle_draft_pick_order(p_league_id) s;

    update public.selection_sessions
    set pick_order = shuffled,
        order_seed = seed,
        draft_phase = 'revealing'
    where league_id = p_league_id
    returning * into session_row;

    insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
    values (
      uid,
      'league.reshuffle_draft_order',
      'league',
      p_league_id,
      jsonb_build_object(
        'pick_order', to_jsonb(shuffled),
        'order_seed', seed,
        'current_pick_index', session_row.current_pick_index
      )
    );
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

grant execute on function public.start_league_selection(uuid) to authenticated;
grant execute on function public.submit_draft_pick(uuid, uuid) to authenticated;
revoke execute on function public.start_league_selection(uuid) from anon, public;
revoke execute on function public.submit_draft_pick(uuid, uuid) from anon, public;
