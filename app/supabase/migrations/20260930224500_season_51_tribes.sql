-- Season 51 original tribes (Global Fantasy Tribe) and castaway assignments.

insert into public.tribes (season_id, name, color_name, color_token, sort_order)
select s.id, v.name, v.color_name, v.color_token, v.sort_order
from public.seasons s
cross join (
  values
    ('Savu', 'Purple', 'purple', 1::smallint),
    ('Toka', 'Yellow', 'yellow', 2::smallint)
) as v(name, color_name, color_token, sort_order)
where s.number = 51
on conflict (season_id, name) do update
  set color_name = excluded.color_name,
      color_token = excluded.color_token,
      sort_order = excluded.sort_order;

-- Savu (Purple)
update public.castaways c
set original_tribe_id = t.id
from public.seasons s
join public.tribes t on t.season_id = s.id and t.name = 'Savu'
where s.id = c.season_id
  and s.number = 51
  and c.slug in (
    'alexis', 'ana', 'carter', 'cristian', 'eric',
    'kristin', 'linnea', 'ori', 'rob', 'sharonda'
  );

-- Toka (Yellow)
update public.castaways c
set original_tribe_id = t.id
from public.seasons s
join public.tribes t on t.season_id = s.id and t.name = 'Toka'
where s.id = c.season_id
  and s.number = 51
  and c.slug in (
    'aaliyah', 'brady', 'devin', 'angelica', 'jenna',
    'lewis', 'danny', 'maggie', 'an', 'mike', 'patt'
  );

-- Aaliyah eliminated Day 3 / first boot (before scoring starts on episode 2).
update public.castaways c
set status = 'eliminated',
    eliminated_episode_number = 1,
    final_placement = 21
from public.seasons s
where s.id = c.season_id
  and s.number = 51
  and c.slug = 'aaliyah';

-- Global Season 51: 4 picks per tribe across 2 tribes = 8 manual, no draft wildcard.
-- Merge window can later add/swap toward roster_size.
update public.rule_sets rs
set picks_per_original_tribe = '{"per_tribe": 4, "tribe_count": 2, "manual_distribution": [4, 4]}'::jsonb,
    roster_size = 8,
    wildcard_slots = 0
from public.seasons s
where s.id = rs.season_id
  and s.number = 51
  and rs.version = 1;

-- Draft RPCs: honor rule_sets.roster_size / wildcard_slots instead of hard-coded 9 + wildcard.
create or replace function public.set_mvp(p_league_id uuid, p_castaway_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  league_row public.leagues%rowtype;
  rule_row public.rule_sets%rowtype;
  roster_count integer;
  has_wildcard boolean;
  require_wildcard boolean;
begin
  uid := app_private.require_selecting_member(p_league_id);
  perform pg_advisory_xact_lock(hashtext(p_league_id::text || ':' || uid::text));

  select * into league_row from public.leagues where id = p_league_id;
  select * into rule_row from public.rule_sets where id = league_row.ruleset_version_id;

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

  require_wildcard := coalesce(rule_row.wildcard_slots, 0) > 0;

  if roster_count <> rule_row.roster_size or (require_wildcard and not has_wildcard) then
    raise exception 'MVP requires a completed roster' using errcode = '22023';
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
  league_row public.leagues%rowtype;
  rule_row public.rule_sets%rowtype;
  league_status public.league_status;
  roster_count integer;
  has_mvp boolean;
begin
  uid := app_private.require_user_id();
  if not app_private.is_league_member(p_league_id) then
    raise exception 'Not a league member' using errcode = '42501';
  end if;

  select * into league_row from public.leagues where id = p_league_id;
  league_status := league_row.status;
  select * into rule_row from public.rule_sets where id = league_row.ruleset_version_id;

  if p_ready and league_status = 'selecting' then
    select count(*) into roster_count
    from public.roster_entries
    where league_id = p_league_id and member_id = uid and ends_episode is null;
    select exists (
      select 1 from public.mvp_selections
      where league_id = p_league_id and member_id = uid
    ) into has_mvp;
    if roster_count <> rule_row.roster_size or not has_mvp then
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
