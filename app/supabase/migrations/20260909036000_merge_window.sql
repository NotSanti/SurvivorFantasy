-- Merge window, one add-or-swap per member, effective the episode after merge.

alter table public.notification_preferences
  add column if not exists merge_window boolean not null default true;

create or replace function app_private.alive_roster_count(
  p_league_id uuid,
  p_member_id uuid,
  p_as_of_episode smallint
)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.roster_entries re
  join public.castaways c on c.id = re.castaway_id
  where re.league_id = p_league_id
    and re.member_id = p_member_id
    and re.starts_episode <= p_as_of_episode
    and (re.ends_episode is null or p_as_of_episode <= re.ends_episode)
    and c.status = 'active'
    and (c.eliminated_episode_number is null or c.eliminated_episode_number > p_as_of_episode);
$$;

create or replace function app_private.enqueue_merge_notifications(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec record;
begin
  for rec in
    select m.user_id
    from public.league_members m
    where m.league_id = p_league_id
      and m.status = 'active'
  loop
    if exists (
      select 1
      from public.notification_preferences p
      where p.user_id = rec.user_id
        and p.merge_window is false
    ) then
      continue;
    end if;

    insert into public.notifications (user_id, title, body, route, league_id)
    values (
      rec.user_id,
      'Merge window is open',
      'Your choice starts next episode. Historical points stay put.',
      '/league/merge',
      p_league_id
    );

    insert into public.notification_outbox (event_type, dedupe_key, user_id, payload)
    values (
      'merge_window',
      format('merge-window:%s:%s', p_league_id, rec.user_id),
      rec.user_id,
      jsonb_build_object('league_id', p_league_id, 'route', '/league/merge')
    )
    on conflict (dedupe_key) do nothing;
  end loop;
end;
$$;

create or replace function public.set_season_merge_episode(
  p_season_id uuid,
  p_episode_number smallint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  league_row public.leagues%rowtype;
  existing smallint;
begin
  uid := app_private.require_user_id();
  if not app_private.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;
  if p_episode_number is null or p_episode_number <= 0 then
    raise exception 'Merge episode is not confirmed' using errcode = '22023';
  end if;

  select merge_episode_number into existing from public.seasons where id = p_season_id;
  if existing is not null and existing is distinct from p_episode_number
    and exists (select 1 from public.merge_moves mm join public.leagues l on l.id = mm.league_id where l.season_id = p_season_id)
  then
    raise exception 'Merge episode cannot change after a move exists' using errcode = '22023';
  end if;

  update public.seasons
  set merge_episode_number = p_episode_number
  where id = p_season_id;

  insert into public.episodes (season_id, episode_number, phase, status)
  values (p_season_id, p_episode_number, 'merge', 'scheduled')
  on conflict (season_id, episode_number) do update
    set phase = 'merge';

  for league_row in
    select * from public.leagues
    where season_id = p_season_id
      and status in ('locked', 'active_pre_merge')
  loop
    update public.leagues
    set status = 'merge_window'
    where id = league_row.id;
    perform app_private.enqueue_merge_notifications(league_row.id);
  end loop;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    uid,
    'season.set_merge_episode',
    'season',
    p_season_id,
    jsonb_build_object('episode', p_episode_number)
  );
end;
$$;

create or replace function public.mark_castaway_eliminated(
  p_castaway_id uuid,
  p_episode_number smallint
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
  if p_episode_number is null or p_episode_number <= 0 then
    raise exception 'Elimination episode is required' using errcode = '22023';
  end if;

  update public.castaways
  set
    status = 'eliminated',
    eliminated_episode_number = p_episode_number
  where id = p_castaway_id;

  if not found then
    raise exception 'Castaway not found' using errcode = '22023';
  end if;

  update public.roster_entries
  set ends_episode = p_episode_number
  where castaway_id = p_castaway_id
    and ends_episode is null
    and starts_episode <= p_episode_number;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    uid,
    'castaway.eliminated',
    'castaway',
    p_castaway_id,
    jsonb_build_object('episode', p_episode_number)
  );
end;
$$;

create or replace function public.close_merge_window(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  uid := app_private.require_user_id();
  if not (app_private.is_commissioner(p_league_id) or app_private.is_admin()) then
    raise exception 'Only the commissioner can close the merge window' using errcode = '42501';
  end if;

  update public.leagues
  set status = 'active_post_merge'
  where id = p_league_id
    and status = 'merge_window';

  if not found then
    raise exception 'The merge window is not open' using errcode = '22023';
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (uid, 'league.close_merge_window', 'league', p_league_id, '{}'::jsonb);
end;
$$;

create or replace function public.submit_merge_move(
  p_league_id uuid,
  p_in_castaway_id uuid,
  p_out_roster_entry_id uuid default null
)
returns public.merge_moves
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  league_row public.leagues%rowtype;
  season_row public.seasons%rowtype;
  rule_row public.rule_sets%rowtype;
  merge_ep smallint;
  effective smallint;
  alive integer;
  move_type public.merge_move_type;
  next_slot smallint;
  incoming public.castaways%rowtype;
  outgoing public.roster_entries%rowtype;
  outgoing_id uuid;
  created public.merge_moves%rowtype;
begin
  uid := app_private.require_user_id();
  if not app_private.is_league_member(p_league_id) then
    raise exception 'Not a league member' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_league_id::text || ':merge:' || uid::text));

  select * into league_row from public.leagues where id = p_league_id;
  if league_row.status = 'active_post_merge' or league_row.status = 'finished' then
    raise exception 'The merge window is closed' using errcode = '22023';
  end if;
  if league_row.status is distinct from 'merge_window' then
    raise exception 'The merge window is not open' using errcode = '22023';
  end if;

  select * into season_row from public.seasons where id = league_row.season_id;
  merge_ep := season_row.merge_episode_number;
  if merge_ep is null then
    raise exception 'Merge episode is not confirmed' using errcode = '22023';
  end if;
  effective := merge_ep + 1;

  if exists (
    select 1 from public.merge_moves
    where league_id = p_league_id and member_id = uid
  ) then
    raise exception 'Member already used a merge move' using errcode = '22023';
  end if;

  select * into rule_row from public.rule_sets where id = league_row.ruleset_version_id;
  alive := app_private.alive_roster_count(p_league_id, uid, merge_ep);
  if alive < rule_row.roster_size then
    move_type := 'add';
  elsif alive = rule_row.roster_size then
    move_type := 'swap';
  else
    raise exception 'Roster is over capacity' using errcode = '22023';
  end if;

  select * into incoming from public.castaways where id = p_in_castaway_id;
  if incoming.id is null
    or incoming.season_id is distinct from league_row.season_id
    or incoming.status is distinct from 'active'
    or (incoming.eliminated_episode_number is not null and incoming.eliminated_episode_number <= merge_ep)
  then
    raise exception 'Incoming castaway is not eligible' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.roster_entries
    where league_id = p_league_id
      and member_id = uid
      and castaway_id = p_in_castaway_id
      and ends_episode is null
  ) then
    raise exception 'Castaway is already on this roster' using errcode = '22023';
  end if;

  if move_type = 'add' then
    if p_out_roster_entry_id is not null then
      raise exception 'Your camp must add, not swap' using errcode = '22023';
    end if;
  else
    if p_out_roster_entry_id is null then
      raise exception 'All nine are still active, so you must swap one pick' using errcode = '22023';
    end if;
    select * into outgoing
    from public.roster_entries
    where id = p_out_roster_entry_id
      and league_id = p_league_id
      and member_id = uid
      and ends_episode is null;
    if outgoing.id is null or outgoing.castaway_id = p_in_castaway_id then
      raise exception 'Choose a valid outgoing roster entry to swap' using errcode = '22023';
    end if;
    outgoing_id := outgoing.id;

    update public.roster_entries
    set ends_episode = merge_ep
    where id = outgoing_id;
  end if;

  select coalesce(max(slot_number), 0) + 1
  into next_slot
  from public.roster_entries
  where league_id = p_league_id and member_id = uid;

  insert into public.roster_entries (
    league_id,
    member_id,
    castaway_id,
    acquisition_type,
    slot_number,
    starts_episode,
    ends_episode,
    locked_at,
    replaces_roster_entry_id
  )
  values (
    p_league_id,
    uid,
    p_in_castaway_id,
    case when move_type = 'add' then 'merge_add'::public.roster_acquisition_type
         else 'merge_swap_in'::public.roster_acquisition_type end,
    next_slot,
    effective,
    null,
    now(),
    outgoing_id
  );

  insert into public.merge_moves (
    league_id,
    member_id,
    move_type,
    out_roster_entry_id,
    in_castaway_id,
    effective_episode,
    locked_at
  )
  values (
    p_league_id,
    uid,
    move_type,
    outgoing_id,
    p_in_castaway_id,
    effective,
    now()
  )
  returning * into created;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    uid,
    'roster.merge_move',
    'league',
    p_league_id,
    jsonb_build_object('type', move_type, 'effective_episode', effective)
  );

  return created;
end;
$$;

create or replace function app_private.episodes_after_publish_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  merge_ep smallint;
begin
  if new.published_score_revision is null then
    return new;
  end if;

  select merge_episode_number into merge_ep from public.seasons where id = new.season_id;

  if merge_ep is not null and new.episode_number >= merge_ep + 1 then
    update public.leagues
    set status = 'active_post_merge'
    where season_id = new.season_id
      and status = 'merge_window';
  elsif merge_ep is null or new.episode_number < merge_ep then
    update public.leagues
    set status = 'active_pre_merge'
    where season_id = new.season_id
      and status = 'locked';
  end if;

  return new;
end;
$$;

drop trigger if exists episodes_after_publish_lifecycle on public.episodes;
create trigger episodes_after_publish_lifecycle
after insert or update of published_score_revision on public.episodes
for each row
execute procedure app_private.episodes_after_publish_lifecycle();

grant execute on function public.set_season_merge_episode(uuid, smallint) to authenticated;
grant execute on function public.mark_castaway_eliminated(uuid, smallint) to authenticated;
grant execute on function public.close_merge_window(uuid) to authenticated;
grant execute on function public.submit_merge_move(uuid, uuid, uuid) to authenticated;
revoke execute on function public.set_season_merge_episode(uuid, smallint) from anon, public;
revoke execute on function public.mark_castaway_eliminated(uuid, smallint) from anon, public;
revoke execute on function public.close_merge_window(uuid) from anon, public;
revoke execute on function public.submit_merge_move(uuid, uuid, uuid) from anon, public;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'merge_moves'
  ) then
    alter publication supabase_realtime add table public.merge_moves;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'seasons'
  ) then
    alter publication supabase_realtime add table public.seasons;
  end if;
end
$$;

alter table public.merge_moves replica identity full;
alter table public.seasons replica identity full;
