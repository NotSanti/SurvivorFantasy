-- Phase 10: Vault-backed cron, service-role import path, rate limits, admin health.

create table if not exists app_private.rate_limit_hits (
  subject text not null,
  action text not null,
  hit_at timestamptz not null default now()
);

create index if not exists rate_limit_hits_lookup_idx
  on app_private.rate_limit_hits (subject, action, hit_at desc);

create or replace function app_private.is_service_role()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.role(), '') = 'service_role';
$$;

create or replace function app_private.require_admin_actor()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  if app_private.is_service_role() then
    return null;
  end if;
  uid := app_private.require_user_id();
  if not app_private.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;
  return uid;
end;
$$;

create or replace function app_private.enforce_rate_limit(
  p_action text,
  p_limit integer,
  p_window interval
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  subject text;
  hits integer;
begin
  if app_private.is_service_role() then
    return;
  end if;

  subject := coalesce((select auth.uid())::text, 'anon:' || p_action);

  delete from app_private.rate_limit_hits
  where rate_limit_hits.subject = subject
    and rate_limit_hits.action = p_action
    and rate_limit_hits.hit_at < now() - p_window;

  select count(*) into hits
  from app_private.rate_limit_hits
  where rate_limit_hits.subject = subject
    and rate_limit_hits.action = p_action
    and rate_limit_hits.hit_at >= now() - p_window;

  if hits >= p_limit then
    raise exception 'Too many attempts. Try again shortly.' using errcode = '54000';
  end if;

  insert into app_private.rate_limit_hits (subject, action)
  values (subject, p_action);
end;
$$;

create or replace function app_private.invoke_edge_function(p_name text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_url text;
  anon_key text;
  cron_secret text;
  request_id bigint;
begin
  if p_name not in ('import-scores', 'process-outbox') then
    raise exception 'Unknown scheduled function' using errcode = '22023';
  end if;

  select ds.decrypted_secret into project_url
  from vault.decrypted_secrets ds
  where ds.name = 'project_url';
  select ds.decrypted_secret into anon_key
  from vault.decrypted_secrets ds
  where ds.name = 'anon_key';
  select ds.decrypted_secret into cron_secret
  from vault.decrypted_secrets ds
  where ds.name = 'CRON_SECRET';

  if project_url is null or anon_key is null or cron_secret is null then
    raise exception 'Vault secrets for scheduled invocation are missing';
  end if;

  select net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/' || p_name,
    body := '{}'::jsonb,
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key,
      'apikey', anon_key,
      'x-cron-secret', cron_secret
    ),
    timeout_milliseconds := 20000
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function app_private.invoke_edge_function(text) from public, anon, authenticated;

create or replace function public.create_score_import_run(
  p_season_id uuid,
  p_trigger_type public.import_trigger_type,
  p_source_url text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_id uuid;
begin
  perform app_private.require_admin_actor();
  perform app_private.enforce_rate_limit('create_score_import_run', 20, interval '1 hour');
  insert into public.score_import_runs (
    season_id, trigger_type, status, source_url, parser_version
  )
  values (p_season_id, p_trigger_type, 'started', p_source_url, 'scores-v1')
  returning id into run_id;
  return run_id;
end;
$$;

create or replace function public.finish_score_import_run(
  p_run_id uuid,
  p_status public.import_status,
  p_summary jsonb,
  p_error_code text default null,
  p_error_detail text default null,
  p_source_hash text default null,
  p_http_status integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.require_admin_actor();
  update public.score_import_runs
  set
    status = p_status,
    summary = p_summary,
    error_code = p_error_code,
    error_detail_redacted = left(coalesce(p_error_detail, ''), 300),
    source_hash = p_source_hash,
    http_status = p_http_status,
    finished_at = now()
  where id = p_run_id;
end;
$$;

create or replace function public.publish_episode_scores(
  p_season_id uuid,
  p_episode_number smallint,
  p_run_id uuid,
  p_scores jsonb,
  p_source_image_url text,
  p_source_alt_text_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  first_scored smallint;
  episode_row public.episodes%rowtype;
  next_revision integer;
  previous_revision integer;
  identical boolean;
  kind text;
begin
  uid := app_private.require_admin_actor();
  if p_episode_number is null or p_episode_number <= 0 then
    raise exception 'Invalid episode number' using errcode = '22023';
  end if;
  select first_scored_episode into first_scored from public.seasons where id = p_season_id;
  if first_scored is not null and p_episode_number < first_scored then
    raise exception 'Episode is before the first scored episode' using errcode = '22023';
  end if;
  if jsonb_typeof(p_scores) is distinct from 'array' or jsonb_array_length(p_scores) = 0 then
    raise exception 'Score payload is empty' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_scores) as el
    where (el->>'castaway_id') is null or (el->>'points_total') is null or (el->>'points_total')::integer < 0
  ) then
    raise exception 'Score payload is malformed' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_array_elements(p_scores) el)
     <> (select count(distinct el->>'castaway_id') from jsonb_array_elements(p_scores) el) then
    raise exception 'Duplicate castaway in score payload' using errcode = '22023';
  end if;
  insert into public.episodes (season_id, episode_number, status)
  values (p_season_id, p_episode_number, 'parsed')
  on conflict (season_id, episode_number) do update set status = public.episodes.status
  returning * into episode_row;
  previous_revision := episode_row.published_score_revision;
  select coalesce(bool_and(published.points_total = incoming.points_total), false) into identical
  from (
    select (el->>'castaway_id')::uuid as castaway_id, (el->>'points_total')::integer as points_total
    from jsonb_array_elements(p_scores) el
  ) incoming
  full join (
    select r.castaway_id, r.points_total from public.castaway_episode_score_revisions r
    where r.episode_id = episode_row.id and r.status = 'published'
  ) published using (castaway_id);
  if identical and previous_revision is not null and (
    select count(*) from public.castaway_episode_score_revisions
    where episode_id = episode_row.id and status = 'published'
  ) = jsonb_array_length(p_scores) then
    return jsonb_build_object('status', 'noop', 'episode_id', episode_row.id, 'episode_number', p_episode_number, 'revision', previous_revision);
  end if;
  next_revision := coalesce(previous_revision, 0) + 1;
  kind := case when previous_revision is null then 'new' else 'correction' end;
  if previous_revision is not null then
    update public.castaway_episode_score_revisions set status = 'superseded'
    where episode_id = episode_row.id and status = 'published';
  end if;
  insert into public.castaway_episode_score_revisions (
    season_id, episode_id, castaway_id, revision, points_total,
    source_run_id, source_image_url, source_alt_text_hash, status, published_at
  )
  select p_season_id, episode_row.id, (el->>'castaway_id')::uuid, next_revision,
    (el->>'points_total')::integer, p_run_id, p_source_image_url, p_source_alt_text_hash, 'published', now()
  from jsonb_array_elements(p_scores) el;
  update public.episodes set
    status = case when kind = 'correction' then 'corrected' else 'published' end,
    published_score_revision = next_revision
  where id = episode_row.id;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (uid, 'scores.publish', 'episode', episode_row.id, jsonb_build_object('kind', kind, 'revision', next_revision, 'run_id', p_run_id));
  return jsonb_build_object('status', 'published', 'kind', kind, 'episode_id', episode_row.id, 'episode_number', p_episode_number, 'revision', next_revision);
end;
$$;

create or replace function public.enqueue_score_notifications(
  p_episode_id uuid,
  p_kind text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  episode_row public.episodes%rowtype;
  rec record;
  title text;
  body text;
  event_type text;
  prefer_ok boolean;
begin
  perform app_private.require_admin_actor();

  select * into episode_row from public.episodes where id = p_episode_id;
  if not found then
    raise exception 'Episode not found' using errcode = '22023';
  end if;

  event_type := case when p_kind = 'correction' then 'score_corrections' else 'scores_published' end;
  title := case
    when p_kind = 'correction' then format('Episode %s totals were updated', episode_row.episode_number)
    else format('Episode %s scores are in', episode_row.episode_number)
  end;

  for rec in
    select mes.league_id, mes.member_id, mes.points
    from public.member_episode_scores mes
    where mes.episode_id = p_episode_id
  loop
    select coalesce(
      case
        when p_kind = 'correction' then pref.score_corrections
        else pref.scores_published
      end,
      true
    )
    into prefer_ok
    from (select rec.member_id as user_id) m
    left join public.notification_preferences pref on pref.user_id = m.user_id;

    if not prefer_ok then
      continue;
    end if;

    body := 'Open Kindling to see your tribe score.';

    insert into public.notifications (user_id, title, body, route, league_id, episode_id)
    values (
      rec.member_id,
      title,
      format('Your tribe total for this episode is %s.', rec.points),
      '/standings',
      rec.league_id,
      p_episode_id
    );

    insert into public.notification_outbox (
      event_type,
      dedupe_key,
      user_id,
      payload
    )
    values (
      event_type,
      format('score:%s:%s:%s:%s', p_episode_id, episode_row.published_score_revision, rec.member_id, p_kind),
      rec.member_id,
      jsonb_build_object(
        'episode_number', episode_row.episode_number,
        'league_id', rec.league_id,
        'kind', p_kind,
        'route', '/standings',
        'title', title,
        'body', body
      )
    )
    on conflict (dedupe_key) do nothing;
  end loop;
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
  perform app_private.enforce_rate_limit('create_league', 5, interval '1 hour');

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
  order by (rs.status = 'confirmed') desc, rs.version desc
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
  perform app_private.enforce_rate_limit('create_league_invite', 20, interval '1 hour');

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
  perform app_private.enforce_rate_limit('accept_league_invite', 12, interval '15 minutes');
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

create or replace function public.claim_first_admin()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  uid := app_private.require_user_id();
  perform app_private.enforce_rate_limit('claim_first_admin', 3, interval '1 hour');
  if exists (select 1 from app_private.admin_users) then
    return app_private.is_admin();
  end if;
  insert into app_private.admin_users (user_id) values (uid);
  return true;
end;
$$;

create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null,
  p_device_label text default null
)
returns public.push_subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  hashed text;
  created public.push_subscriptions%rowtype;
begin
  uid := app_private.require_user_id();
  perform app_private.enforce_rate_limit('register_push_subscription', 20, interval '1 hour');
  if p_endpoint is null or p_endpoint !~ '^https://' then
    raise exception 'Push endpoint must be https' using errcode = '22023';
  end if;
  if p_p256dh is null or length(p_p256dh) < 16 or p_auth is null or length(p_auth) < 8 then
    raise exception 'Push subscription keys are required' using errcode = '22023';
  end if;

  hashed := encode(extensions.digest(convert_to(p_endpoint, 'UTF8'), 'sha256'), 'hex');

  insert into public.push_subscriptions (
    user_id, endpoint_hash, endpoint, p256dh, auth, user_agent, device_label, last_seen_at, revoked_at
  )
  values (uid, hashed, p_endpoint, p_p256dh, p_auth, p_user_agent, p_device_label, now(), null)
  on conflict (endpoint_hash) do update
    set
      user_id = uid,
      endpoint = excluded.endpoint,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      user_agent = excluded.user_agent,
      device_label = coalesce(excluded.device_label, public.push_subscriptions.device_label),
      last_seen_at = now(),
      revoked_at = null
  returning * into created;

  return created;
end;
$$;

alter function public.request_wildcard(uuid, uuid) rename to request_wildcard_unthrottled;

create or replace function public.request_wildcard(p_league_id uuid, p_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.enforce_rate_limit('request_wildcard', 10, interval '10 minutes');
  return public.request_wildcard_unthrottled(p_league_id, p_idempotency_key);
end;
$$;

revoke all on function public.request_wildcard_unthrottled(uuid, uuid) from public, anon, authenticated;
grant execute on function public.request_wildcard(uuid, uuid) to authenticated;
revoke execute on function public.request_wildcard(uuid, uuid) from anon, public;

grant execute on function public.create_score_import_run(uuid, public.import_trigger_type, text) to authenticated, service_role;
grant execute on function public.finish_score_import_run(uuid, public.import_status, jsonb, text, text, text, integer) to authenticated, service_role;
grant execute on function public.publish_episode_scores(uuid, smallint, uuid, jsonb, text, text) to authenticated, service_role;
grant execute on function public.enqueue_score_notifications(uuid, text) to authenticated, service_role;
revoke execute on function public.create_score_import_run(uuid, public.import_trigger_type, text) from anon, public;
revoke execute on function public.finish_score_import_run(uuid, public.import_status, jsonb, text, text, text, integer) from anon, public;
revoke execute on function public.publish_episode_scores(uuid, smallint, uuid, jsonb, text, text) from anon, public;
revoke execute on function public.enqueue_score_notifications(uuid, text) from anon, public;

create or replace function public.admin_ops_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  last_check public.score_import_runs%rowtype;
  last_ok public.score_import_runs%rowtype;
  next_ep integer;
  review_count integer;
  dead_push integer;
  pending_push integer;
  last_schedule timestamptz;
  season_status public.season_status;
begin
  if not app_private.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;

  select * into last_check
  from public.score_import_runs
  order by started_at desc
  limit 1;

  select * into last_ok
  from public.score_import_runs
  where status = 'succeeded'
  order by finished_at desc nulls last
  limit 1;

  select s.status into season_status
  from public.seasons s
  where s.number = 51;

  select coalesce(
    (
      select max(e.episode_number) + 1
      from public.episodes e
      join public.seasons s on s.id = e.season_id
      where s.number = 51
        and e.status in ('published', 'corrected')
    ),
    (
      select coalesce(s.first_scored_episode, 2)
      from public.seasons s
      where s.number = 51
    )
  )
  into next_ep;

  select count(*) into review_count
  from public.score_import_runs
  where status = 'needs_review';

  select count(*) into dead_push
  from public.notification_outbox
  where status = 'dead_letter';

  select count(*) into pending_push
  from public.notification_outbox
  where status = 'pending';

  select max(started_at) into last_schedule
  from public.score_import_runs
  where trigger_type = 'schedule';

  return jsonb_build_object(
    'season_status', season_status,
    'last_source_check', case when last_check.id is null then null else jsonb_build_object(
      'id', last_check.id,
      'status', last_check.status,
      'error_code', last_check.error_code,
      'started_at', last_check.started_at,
      'finished_at', last_check.finished_at,
      'trigger_type', last_check.trigger_type
    ) end,
    'last_success', case when last_ok.id is null then null else jsonb_build_object(
      'id', last_ok.id,
      'finished_at', last_ok.finished_at
    ) end,
    'next_expected_episode', next_ep,
    'outstanding_review', review_count,
    'push_failures', jsonb_build_object(
      'dead_letter', dead_push,
      'pending', pending_push
    ),
    'cron_staleness', jsonb_build_object(
      'last_scheduled_at', last_schedule,
      'stale', last_schedule is null or last_schedule < now() - interval '8 days'
    )
  );
end;
$$;

grant execute on function public.admin_ops_health() to authenticated;
revoke execute on function public.admin_ops_health() from anon, public;

do $$
declare
  job record;
begin
  for job in
    select jobid from cron.job
    where jobname in (
      'kindling-import-scores-thu',
      'kindling-import-scores-fri-early',
      'kindling-import-scores-fri-day',
      'kindling-process-outbox'
    )
  loop
    perform cron.unschedule(job.jobid);
  end loop;

  perform cron.schedule(
    'kindling-import-scores-thu',
    '*/15 22-23 * * 4',
    $cron$select app_private.invoke_edge_function('import-scores')$cron$
  );
  perform cron.schedule(
    'kindling-import-scores-fri-early',
    '*/15 0-5 * * 5',
    $cron$select app_private.invoke_edge_function('import-scores')$cron$
  );
  perform cron.schedule(
    'kindling-import-scores-fri-day',
    '0 16,19 * * 5',
    $cron$select app_private.invoke_edge_function('import-scores')$cron$
  );
  perform cron.schedule(
    'kindling-process-outbox',
    '*/15 * * * *',
    $cron$select app_private.invoke_edge_function('process-outbox')$cron$
  );
end;
$$;
