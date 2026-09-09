-- Roster-aware scoring views, league-member rule-set reads, and Realtime publication.

create policy rule_sets_league_attached_read on public.rule_sets
  for select to authenticated
  using (
    exists (
      select 1
      from public.leagues l
      where l.ruleset_version_id = rule_sets.id
        and (select app_private.is_league_member(l.id))
    )
  );

create policy scoring_rules_league_attached_read on public.scoring_rules
  for select to authenticated
  using (
    exists (
      select 1
      from public.leagues l
      where l.ruleset_version_id = scoring_rules.rule_set_id
        and (select app_private.is_league_member(l.id))
    )
  );

drop view if exists public.league_standings;
drop view if exists public.member_cumulative_scores;

create or replace view public.member_episode_castaway_scores
with (security_invoker = true) as
select
  re.league_id,
  re.member_id,
  re.id as roster_entry_id,
  re.castaway_id,
  re.acquisition_type,
  re.starts_episode,
  re.ends_episode,
  s.episode_id,
  s.episode_number,
  s.points_total,
  s.revision,
  s.published_at,
  false as is_mvp_bonus
from public.roster_entries re
join public.leagues l on l.id = re.league_id
join public.published_castaway_episode_scores s
  on s.castaway_id = re.castaway_id
 and s.season_id = l.season_id
where re.starts_episode <= s.episode_number
  and (re.ends_episode is null or s.episode_number <= re.ends_episode)

union all

select
  mv.league_id,
  mv.member_id,
  null::uuid as roster_entry_id,
  mv.castaway_id,
  null::public.roster_acquisition_type as acquisition_type,
  e.episode_number as starts_episode,
  e.episode_number as ends_episode,
  e.id as episode_id,
  e.episode_number,
  sr.points as points_total,
  1 as revision,
  e_updated.published_at,
  true as is_mvp_bonus
from public.mvp_selections mv
join public.leagues l on l.id = mv.league_id
join public.seasons season on season.id = l.season_id
join public.castaways winner
  on winner.id = mv.castaway_id
 and winner.season_id = season.id
 and winner.final_placement = 1
join public.episodes e
  on e.season_id = season.id
 and (
   e.phase = 'finale'
   or (season.finale_episode_number is not null and e.episode_number = season.finale_episode_number)
 )
join public.scoring_rules sr
  on sr.rule_set_id = l.ruleset_version_id
 and sr.code = 'mvp_win'
join lateral (
  select max(s.published_at) as published_at
  from public.published_castaway_episode_scores s
  where s.episode_id = e.id
) e_updated on e_updated.published_at is not null;

create or replace view public.member_episode_scores
with (security_invoker = true) as
select
  league_id,
  member_id,
  episode_id,
  episode_number,
  sum(points_total)::integer as points
from public.member_episode_castaway_scores
group by league_id, member_id, episode_id, episode_number;

create or replace view public.member_cumulative_scores
with (security_invoker = true) as
select
  lm.league_id,
  lm.user_id as member_id,
  coalesce(sum(mes.points), 0)::integer as total_points
from public.league_members lm
left join public.member_episode_scores mes
  on mes.league_id = lm.league_id
 and mes.member_id = lm.user_id
where lm.status = 'active'
group by lm.league_id, lm.user_id;

create view public.league_standings
with (security_invoker = true) as
select
  s.league_id,
  s.member_id,
  p.display_name,
  s.total_points,
  rank() over (
    partition by s.league_id
    order by s.total_points desc
  ) as rank
from public.member_cumulative_scores s
join public.profiles p on p.id = s.member_id;

grant select on public.member_episode_castaway_scores, public.member_episode_scores,
  public.member_cumulative_scores, public.league_standings
  to authenticated;

alter table public.episodes replica identity full;
alter table public.castaway_episode_score_revisions replica identity full;
alter table public.roster_entries replica identity full;
alter table public.mvp_selections replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'episodes'
  ) then
    alter publication supabase_realtime add table public.episodes;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'castaway_episode_score_revisions'
  ) then
    alter publication supabase_realtime add table public.castaway_episode_score_revisions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'roster_entries'
  ) then
    alter publication supabase_realtime add table public.roster_entries;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mvp_selections'
  ) then
    alter publication supabase_realtime add table public.mvp_selections;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'leagues'
  ) then
    alter publication supabase_realtime add table public.leagues;
  end if;
end
$$;
