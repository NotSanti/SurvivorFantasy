create or replace function public.complete_onboarding(p_display_name text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  profile public.profiles;
begin
  uid := app_private.require_user_id();
  if p_display_name is null or length(trim(p_display_name)) < 2 or length(trim(p_display_name)) > 40 then
    raise exception 'Display name must be between 2 and 40 characters' using errcode = '22023';
  end if;

  update public.profiles
  set
    display_name = trim(p_display_name),
    onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = uid
  returning * into profile;

  return profile;
end;
$$;

create or replace function public.leave_league(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  league public.leagues%rowtype;
  remaining integer;
begin
  uid := app_private.require_user_id();

  select * into league
  from public.leagues
  where id = p_league_id
  for update;

  if league.id is null then
    raise exception 'League not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = uid and status = 'active'
  ) then
    raise exception 'Not a league member' using errcode = '42501';
  end if;

  if league.status <> 'recruiting' then
    raise exception 'You can only leave while the league is still recruiting' using errcode = '22023';
  end if;

  if league.commissioner_id = uid then
    select count(*) into remaining
    from public.league_members
    where league_id = p_league_id and status = 'active' and user_id <> uid;
    if remaining > 0 then
      raise exception 'Commissioner must archive the league or wait until others leave' using errcode = '22023';
    end if;
    update public.leagues set status = 'archived' where id = p_league_id;
  end if;

  update public.league_members
  set status = 'left', ready_at = null
  where league_id = p_league_id and user_id = uid;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (uid, 'league.leave', 'league', p_league_id, '{}'::jsonb);
end;
$$;

create or replace function public.archive_league(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  uid := app_private.require_user_id();
  if not app_private.is_commissioner(p_league_id) then
    raise exception 'Only the commissioner can archive a league' using errcode = '42501';
  end if;

  update public.leagues
  set status = 'archived'
  where id = p_league_id
    and status in ('recruiting', 'finished');

  if not found then
    raise exception 'This league cannot be archived in its current status' using errcode = '22023';
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (uid, 'league.archive', 'league', p_league_id, '{}'::jsonb);
end;
$$;

create or replace function public.start_league_selection(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  member_count integer;
begin
  uid := app_private.require_user_id();
  if not app_private.is_commissioner(p_league_id) then
    raise exception 'Only the commissioner can start selection' using errcode = '42501';
  end if;

  select count(*) into member_count
  from public.league_members
  where league_id = p_league_id and status = 'active';

  if member_count < 2 then
    raise exception 'A league needs at least two members before selection starts' using errcode = '22023';
  end if;

  update public.leagues
  set status = 'selecting'
  where id = p_league_id and status = 'recruiting';

  if not found then
    raise exception 'Selection can only start from recruiting' using errcode = '22023';
  end if;

  insert into public.selection_sessions (league_id, rule_set_id)
  select l.id, l.ruleset_version_id
  from public.leagues l
  where l.id = p_league_id
  on conflict (league_id) do nothing;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (uid, 'league.start_selection', 'league', p_league_id, '{}'::jsonb);
end;
$$;

grant execute on function public.complete_onboarding(text) to authenticated;
grant execute on function public.leave_league(uuid) to authenticated;
grant execute on function public.archive_league(uuid) to authenticated;
grant execute on function public.start_league_selection(uuid) to authenticated;

revoke execute on function public.complete_onboarding(text) from anon, public;
revoke execute on function public.leave_league(uuid) from anon, public;
revoke execute on function public.archive_league(uuid) from anon, public;
revoke execute on function public.start_league_selection(uuid) from anon, public;
