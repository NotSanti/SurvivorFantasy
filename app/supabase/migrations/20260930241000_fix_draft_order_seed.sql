-- Qualify pgcrypto helper used for draft order seeding (search_path is empty).
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
    league_id, rule_set_id, pick_order, order_seed, current_pick_index, tribe_order, draft_phase
  )
  values (
    p_league_id, league_row.ruleset_version_id, shuffled, seed, 0, tribe_ids, 'revealing'
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
  values (uid, 'league.start_selection', 'league', p_league_id, jsonb_build_object('pick_order', to_jsonb(shuffled), 'order_seed', seed));
end;
$fn$;

grant execute on function public.start_league_selection(uuid) to authenticated;
revoke execute on function public.start_league_selection(uuid) from anon, public;
