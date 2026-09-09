-- Kindling v1 schema: private helpers, versioned domain tables, RLS.

create schema if not exists app_private;

revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to postgres, service_role;

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Enums
create type public.league_status as enum (
  'recruiting',
  'selecting',
  'locked',
  'active_pre_merge',
  'merge_window',
  'active_post_merge',
  'finished',
  'archived'
);

create type public.selection_mode as enum (
  'global_shared_pool',
  'exclusive_snake'
);

create type public.league_member_role as enum ('commissioner', 'member');

create type public.league_member_status as enum ('active', 'left', 'removed');

create type public.season_status as enum (
  'upcoming',
  'active',
  'finished',
  'archived'
);

create type public.castaway_status as enum (
  'active',
  'eliminated',
  'withdrawn'
);

create type public.rule_set_status as enum ('draft', 'confirmed', 'retired');

create type public.scoring_rule_kind as enum (
  'survival',
  'weekly_category',
  'placement',
  'mvp'
);

create type public.scoring_phase as enum (
  'pre_merge',
  'post_merge',
  'finale',
  'any'
);

create type public.roster_acquisition_type as enum (
  'manual',
  'wildcard',
  'merge_add',
  'merge_swap_in'
);

create type public.merge_move_type as enum ('add', 'swap');

create type public.episode_phase as enum ('pre_merge', 'merge', 'post_merge', 'finale');

create type public.episode_status as enum (
  'scheduled',
  'results_pending',
  'parsed',
  'published',
  'corrected',
  'needs_review'
);

create type public.import_trigger_type as enum ('schedule', 'manual', 'retry');

create type public.import_status as enum (
  'started',
  'succeeded',
  'noop',
  'needs_review',
  'failed'
);

create type public.score_revision_status as enum ('parsed', 'published', 'superseded');

create type public.outbox_status as enum (
  'pending',
  'processing',
  'sent',
  'dead_letter'
);

-- Identity
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_path text,
  timezone text not null default 'America/Toronto',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  number smallint not null unique,
  name text not null,
  status public.season_status not null default 'upcoming',
  premiere_at timestamptz,
  timezone text not null default 'America/Toronto',
  source_page_url text,
  source_wp_post_id bigint,
  source_checked_at timestamptz,
  first_scored_episode smallint,
  merge_episode_number smallint,
  finale_episode_number smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tribes (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  name text not null,
  color_name text,
  color_token text,
  sort_order smallint not null,
  unique (season_id, name)
);

create table public.castaways (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  original_tribe_id uuid references public.tribes (id),
  display_name text not null,
  slug text not null,
  photo_url text,
  status public.castaway_status not null default 'active',
  eliminated_episode_number smallint,
  final_placement smallint,
  unique (season_id, slug)
);

create table public.castaway_source_aliases (
  season_id uuid not null references public.seasons (id) on delete cascade,
  source_key text not null,
  normalized_source_name text not null,
  castaway_id uuid not null references public.castaways (id) on delete cascade,
  primary key (season_id, source_key, normalized_source_name)
);

create table public.rule_sets (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  version integer not null,
  status public.rule_set_status not null default 'draft',
  source_url text not null,
  source_modified_at timestamptz,
  source_hash text not null,
  effective_from_episode smallint not null default 1,
  roster_size smallint not null,
  wildcard_slots smallint not null default 1,
  picks_per_original_tribe jsonb not null,
  first_scored_episode smallint not null,
  pending_confirmation boolean not null default true,
  unique (season_id, version)
);

create table public.scoring_rules (
  id uuid primary key default gen_random_uuid(),
  rule_set_id uuid not null references public.rule_sets (id) on delete cascade,
  code text not null,
  label text not null,
  points integer not null,
  kind public.scoring_rule_kind not null,
  phase public.scoring_phase not null default 'any',
  max_occurrences_per_castaway_episode smallint,
  sort_order smallint not null,
  unique (rule_set_id, code)
);

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id),
  name text not null,
  commissioner_id uuid not null references public.profiles (id),
  status public.league_status not null default 'recruiting',
  selection_mode public.selection_mode not null default 'global_shared_pool',
  max_members smallint not null check (max_members between 2 and 20),
  selection_deadline timestamptz,
  locked_at timestamptz,
  ruleset_version_id uuid not null references public.rule_sets (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.league_members (
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.league_member_role not null default 'member',
  status public.league_member_status not null default 'active',
  joined_at timestamptz not null default now(),
  ready_at timestamptz,
  primary key (league_id, user_id)
);

create table public.league_invites (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references public.profiles (id),
  expires_at timestamptz not null,
  max_uses integer,
  use_count integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.selection_sessions (
  league_id uuid primary key references public.leagues (id) on delete cascade,
  started_at timestamptz not null default now(),
  locked_at timestamptz,
  rule_set_id uuid not null references public.rule_sets (id)
);

create table public.roster_entries (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  member_id uuid not null references public.profiles (id),
  castaway_id uuid not null references public.castaways (id),
  acquisition_type public.roster_acquisition_type not null,
  slot_number smallint not null,
  starts_episode smallint not null,
  ends_episode smallint,
  picked_at timestamptz not null default now(),
  locked_at timestamptz,
  replaces_roster_entry_id uuid references public.roster_entries (id),
  created_at timestamptz not null default now()
);

create unique index roster_entries_active_slot
  on public.roster_entries (league_id, member_id, slot_number)
  where ends_episode is null;

create unique index roster_entries_active_castaway
  on public.roster_entries (league_id, member_id, castaway_id)
  where ends_episode is null;

create table public.mvp_selections (
  league_id uuid not null references public.leagues (id) on delete cascade,
  member_id uuid not null references public.profiles (id),
  castaway_id uuid not null references public.castaways (id),
  locked_at timestamptz,
  primary key (league_id, member_id)
);

create table public.wildcard_audits (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  member_id uuid not null references public.profiles (id),
  idempotency_key uuid not null,
  eligible_castaway_ids uuid[] not null,
  selected_castaway_id uuid not null references public.castaways (id),
  algorithm_version text not null,
  seed_hash text not null,
  created_at timestamptz not null default now(),
  unique (league_id, member_id),
  unique (member_id, idempotency_key)
);

create table public.merge_moves (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  member_id uuid not null references public.profiles (id),
  move_type public.merge_move_type not null,
  out_roster_entry_id uuid references public.roster_entries (id),
  in_castaway_id uuid not null references public.castaways (id),
  effective_episode smallint not null,
  locked_at timestamptz not null default now(),
  unique (league_id, member_id)
);

create table public.episodes (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  episode_number smallint not null,
  title text,
  airs_at timestamptz,
  phase public.episode_phase,
  status public.episode_status not null default 'scheduled',
  published_score_revision integer,
  unique (season_id, episode_number)
);

create table public.score_import_runs (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id),
  trigger_type public.import_trigger_type not null,
  status public.import_status not null default 'started',
  source_url text not null,
  source_post_id bigint,
  source_modified_at timestamptz,
  source_etag text,
  source_hash text,
  http_status integer,
  parser_version text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  summary jsonb,
  error_code text,
  error_detail_redacted text
);

create table public.castaway_episode_score_revisions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id),
  episode_id uuid not null references public.episodes (id) on delete cascade,
  castaway_id uuid not null references public.castaways (id),
  revision integer not null,
  points_total integer not null check (points_total >= 0),
  source_run_id uuid not null references public.score_import_runs (id),
  source_image_url text,
  source_alt_text_hash text not null,
  status public.score_revision_status not null,
  published_at timestamptz,
  unique (episode_id, castaway_id, revision)
);

create table public.score_events (
  score_revision_id uuid not null references public.castaway_episode_score_revisions (id) on delete cascade,
  scoring_rule_id uuid not null references public.scoring_rules (id),
  occurrences smallint not null default 1,
  points integer not null,
  evidence_note text,
  primary key (score_revision_id, scoring_rule_id)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint_hash text not null unique,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  device_label text,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  weekly_reminder boolean not null default true,
  scores_published boolean not null default true,
  score_corrections boolean not null default true,
  league_updates boolean not null default true,
  draft_deadlines boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  timezone text not null default 'America/Toronto'
);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  dedupe_key text not null unique,
  user_id uuid not null references public.profiles (id) on delete cascade,
  payload jsonb not null,
  available_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  status public.outbox_status not null default 'pending',
  last_error_redacted text
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  route text not null,
  read_at timestamptz,
  league_id uuid references public.leagues (id) on delete set null,
  episode_id uuid references public.episodes (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table app_private.admin_users (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Indexes for FKs and RLS predicates
create index leagues_season_id_idx on public.leagues (season_id);
create index leagues_commissioner_id_idx on public.leagues (commissioner_id);
create index league_members_user_id_idx on public.league_members (user_id);
create index league_members_active_idx on public.league_members (league_id, user_id) where status = 'active';
create index league_invites_league_id_idx on public.league_invites (league_id);
create index roster_entries_league_member_idx on public.roster_entries (league_id, member_id);
create index roster_entries_castaway_idx on public.roster_entries (castaway_id);
create index score_revisions_episode_idx on public.castaway_episode_score_revisions (episode_id, status);
create index score_revisions_season_idx on public.castaway_episode_score_revisions (season_id);
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
create index notifications_user_id_idx on public.notifications (user_id, created_at desc);
create index notification_outbox_status_idx on public.notification_outbox (status, available_at);
create index tribes_season_id_idx on public.tribes (season_id);
create index castaways_season_id_idx on public.castaways (season_id);
create index episodes_season_id_idx on public.episodes (season_id);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function app_private.set_updated_at();

create trigger seasons_updated_at
  before update on public.seasons
  for each row execute function app_private.set_updated_at();

create trigger leagues_updated_at
  before update on public.leagues
  for each row execute function app_private.set_updated_at();

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), 'Player')
  );
  insert into public.notification_preferences (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

-- Helpers (security definer, non-exposed schema)
create or replace function app_private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app_private.admin_users a
    where a.user_id = (select auth.uid())
  );
$$;

create or replace function app_private.is_league_member(target_league uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.league_members m
    where m.league_id = target_league
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create or replace function app_private.is_commissioner(target_league uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.league_members m
    where m.league_id = target_league
      and m.user_id = (select auth.uid())
      and m.role = 'commissioner'
      and m.status = 'active'
  );
$$;

create or replace function app_private.league_is_locked(target_league uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.leagues l
    where l.id = target_league
      and l.locked_at is not null
      and l.status not in ('recruiting', 'selecting')
  );
$$;

create or replace function app_private.is_season_league_member(target_season uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.leagues l
    join public.league_members m on m.league_id = l.id
    where l.season_id = target_season
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.seasons enable row level security;
alter table public.tribes enable row level security;
alter table public.castaways enable row level security;
alter table public.castaway_source_aliases enable row level security;
alter table public.rule_sets enable row level security;
alter table public.scoring_rules enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.league_invites enable row level security;
alter table public.selection_sessions enable row level security;
alter table public.roster_entries enable row level security;
alter table public.mvp_selections enable row level security;
alter table public.wildcard_audits enable row level security;
alter table public.merge_moves enable row level security;
alter table public.episodes enable row level security;
alter table public.score_import_runs enable row level security;
alter table public.castaway_episode_score_revisions enable row level security;
alter table public.score_events enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

create policy seasons_public_read on public.seasons
  for select to anon, authenticated
  using (true);

create policy tribes_public_read on public.tribes
  for select to anon, authenticated
  using (true);

create policy castaways_public_read on public.castaways
  for select to anon, authenticated
  using (true);

create policy rule_sets_confirmed_read on public.rule_sets
  for select to anon, authenticated
  using (status = 'confirmed' or (select app_private.is_admin()));

create policy scoring_rules_confirmed_read on public.scoring_rules
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.rule_sets rs
      where rs.id = scoring_rules.rule_set_id
        and (rs.status = 'confirmed' or (select app_private.is_admin()))
    )
  );

create policy aliases_admin_read on public.castaway_source_aliases
  for select to authenticated
  using ((select app_private.is_admin()));

create policy profiles_self_or_peer_read on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select app_private.is_admin())
    or exists (
      select 1
      from public.league_members mine
      join public.league_members peer on peer.league_id = mine.league_id
      where mine.user_id = (select auth.uid())
        and mine.status = 'active'
        and peer.user_id = profiles.id
        and peer.status = 'active'
    )
  );

create policy profiles_self_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy leagues_member_read on public.leagues
  for select to authenticated
  using ((select app_private.is_league_member(id)) or (select app_private.is_admin()));

create policy league_members_read on public.league_members
  for select to authenticated
  using ((select app_private.is_league_member(league_id)) or (select app_private.is_admin()));

create policy selection_sessions_member_read on public.selection_sessions
  for select to authenticated
  using ((select app_private.is_league_member(league_id)) or (select app_private.is_admin()));

create policy roster_own_or_locked_read on public.roster_entries
  for select to authenticated
  using (
    (select app_private.is_admin())
    or (
      (select app_private.is_league_member(league_id))
      and (
        member_id = (select auth.uid())
        or (select app_private.league_is_locked(league_id))
      )
    )
  );

create policy mvp_own_or_locked_read on public.mvp_selections
  for select to authenticated
  using (
    (select app_private.is_admin())
    or (
      (select app_private.is_league_member(league_id))
      and (
        member_id = (select auth.uid())
        or (select app_private.league_is_locked(league_id))
      )
    )
  );

create policy wildcard_own_read on public.wildcard_audits
  for select to authenticated
  using (
    member_id = (select auth.uid())
    or (select app_private.is_admin())
  );

create policy merge_moves_member_read on public.merge_moves
  for select to authenticated
  using (
    (select app_private.is_league_member(league_id))
    and (
      member_id = (select auth.uid())
      or (select app_private.league_is_locked(league_id))
      or (select app_private.is_commissioner(league_id))
    )
  );

create policy episodes_member_read on public.episodes
  for select to authenticated
  using (
    (select app_private.is_season_league_member(season_id))
    or (select app_private.is_admin())
  );

create policy published_scores_member_read on public.castaway_episode_score_revisions
  for select to authenticated
  using (
    (
      status = 'published'
      and (select app_private.is_season_league_member(season_id))
    )
    or (select app_private.is_admin())
  );

create policy import_runs_summary_read on public.score_import_runs
  for select to authenticated
  using (
    (
      status in ('succeeded', 'noop')
      and (select app_private.is_season_league_member(season_id))
    )
    or (select app_private.is_admin())
  );

create policy push_own_all on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy notification_prefs_own on public.notification_preferences
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy notifications_own_read on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy notifications_own_update on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Grants: reads only. Mutations go through RPCs in later phases.
grant usage on schema public to anon, authenticated, service_role;

grant select on public.seasons, public.tribes, public.castaways, public.rule_sets, public.scoring_rules
  to anon, authenticated;

grant select on public.profiles, public.leagues, public.league_members, public.selection_sessions,
  public.roster_entries, public.mvp_selections, public.wildcard_audits, public.merge_moves,
  public.episodes, public.castaway_episode_score_revisions, public.score_import_runs,
  public.notifications
  to authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant update on public.notifications to authenticated;

grant all on all tables in schema public to postgres, service_role;
grant all on all sequences in schema public to postgres, service_role;

-- Views
create or replace view public.published_castaway_episode_scores
with (security_invoker = true) as
select
  r.id,
  r.season_id,
  r.episode_id,
  e.episode_number,
  r.castaway_id,
  r.revision,
  r.points_total,
  r.published_at
from public.castaway_episode_score_revisions r
join public.episodes e on e.id = r.episode_id
where r.status = 'published'
  and e.published_score_revision = r.revision;

create or replace view public.member_episode_scores
with (security_invoker = true) as
select
  re.league_id,
  re.member_id,
  s.episode_id,
  s.episode_number,
  sum(s.points_total)::integer as points
from public.roster_entries re
join public.published_castaway_episode_scores s
  on s.castaway_id = re.castaway_id
 and s.season_id = (select l.season_id from public.leagues l where l.id = re.league_id)
where re.starts_episode <= s.episode_number
  and (re.ends_episode is null or s.episode_number <= re.ends_episode)
group by re.league_id, re.member_id, s.episode_id, s.episode_number;

create or replace view public.member_cumulative_scores
with (security_invoker = true) as
select
  league_id,
  member_id,
  sum(points)::integer as total_points
from public.member_episode_scores
group by league_id, member_id;

create or replace view public.league_standings
with (security_invoker = true) as
select
  s.league_id,
  s.member_id,
  p.display_name,
  s.total_points,
  rank() over (partition by s.league_id order by s.total_points desc, p.display_name asc, s.member_id asc) as rank
from public.member_cumulative_scores s
join public.profiles p on p.id = s.member_id;

grant select on public.published_castaway_episode_scores, public.member_episode_scores,
  public.member_cumulative_scores, public.league_standings
  to authenticated;
