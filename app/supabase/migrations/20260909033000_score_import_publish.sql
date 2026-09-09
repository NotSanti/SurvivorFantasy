-- Publish versioned episode scores and enqueue in-app/outbox notifications separately.

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
  uid := app_private.require_user_id();
  if not app_private.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;

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
    select 1
    from jsonb_array_elements(p_scores) as el
    where (el->>'castaway_id') is null
      or (el->>'points_total') is null
      or (el->>'points_total')::integer < 0
  ) then
    raise exception 'Score payload is malformed' using errcode = '22023';
  end if;

  if (
    select count(*) from jsonb_array_elements(p_scores) el
  ) <> (
    select count(distinct el->>'castaway_id') from jsonb_array_elements(p_scores) el
  ) then
    raise exception 'Duplicate castaway in score payload' using errcode = '22023';
  end if;

  insert into public.episodes (season_id, episode_number, status)
  values (p_season_id, p_episode_number, 'parsed')
  on conflict (season_id, episode_number) do update
    set status = public.episodes.status
  returning * into episode_row;

  previous_revision := episode_row.published_score_revision;

  select coalesce(bool_and(published.points_total = incoming.points_total), false)
  into identical
  from (
    select (el->>'castaway_id')::uuid as castaway_id, (el->>'points_total')::integer as points_total
    from jsonb_array_elements(p_scores) el
  ) incoming
  full join (
    select r.castaway_id, r.points_total
    from public.castaway_episode_score_revisions r
    where r.episode_id = episode_row.id
      and r.status = 'published'
  ) published using (castaway_id);

  if identical
    and previous_revision is not null
    and (
      select count(*) from public.castaway_episode_score_revisions
      where episode_id = episode_row.id and status = 'published'
    ) = jsonb_array_length(p_scores)
  then
    return jsonb_build_object(
      'status', 'noop',
      'episode_id', episode_row.id,
      'episode_number', p_episode_number,
      'revision', previous_revision
    );
  end if;

  next_revision := coalesce(previous_revision, 0) + 1;
  kind := case when previous_revision is null then 'new' else 'correction' end;

  if previous_revision is not null then
    update public.castaway_episode_score_revisions
    set status = 'superseded'
    where episode_id = episode_row.id and status = 'published';
  end if;

  insert into public.castaway_episode_score_revisions (
    season_id,
    episode_id,
    castaway_id,
    revision,
    points_total,
    source_run_id,
    source_image_url,
    source_alt_text_hash,
    status,
    published_at
  )
  select
    p_season_id,
    episode_row.id,
    (el->>'castaway_id')::uuid,
    next_revision,
    (el->>'points_total')::integer,
    p_run_id,
    p_source_image_url,
    p_source_alt_text_hash,
    'published',
    now()
  from jsonb_array_elements(p_scores) el;

  update public.episodes
  set
    status = case when kind = 'correction' then 'corrected' else 'published' end,
    published_score_revision = next_revision
  where id = episode_row.id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    uid,
    'scores.publish',
    'episode',
    episode_row.id,
    jsonb_build_object('kind', kind, 'revision', next_revision, 'run_id', p_run_id)
  );

  return jsonb_build_object(
    'status', 'published',
    'kind', kind,
    'episode_id', episode_row.id,
    'episode_number', p_episode_number,
    'revision', next_revision
  );
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
  uid uuid;
  episode_row public.episodes%rowtype;
  rec record;
  title text;
  body text;
  event_type text;
  prefer_ok boolean;
begin
  uid := app_private.require_user_id();
  if not app_private.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;

  select * into episode_row from public.episodes where id = p_episode_id;
  if not found then
    raise exception 'Episode not found' using errcode = '22023';
  end if;

  event_type := case when p_kind = 'correction' then 'score_corrections' else 'scores_published' end;
  title := case
    when p_kind = 'correction' then format('Episode %s was corrected', episode_row.episode_number)
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

    body := case
      when p_kind = 'correction' then format('Your tribe total for this episode is now %s.', rec.points)
      else format('Your tribe earned %s points.', rec.points)
    end;

    insert into public.notifications (user_id, title, body, route, league_id, episode_id)
    values (
      rec.member_id,
      title,
      body,
      format('/leagues/%s', rec.league_id),
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
        'points', rec.points,
        'kind', p_kind
      )
    )
    on conflict (dedupe_key) do nothing;
  end loop;
end;
$$;

grant execute on function public.publish_episode_scores(uuid, smallint, uuid, jsonb, text, text) to authenticated;
grant execute on function public.enqueue_score_notifications(uuid, text) to authenticated;
revoke execute on function public.publish_episode_scores(uuid, smallint, uuid, jsonb, text, text) from anon, public;
revoke execute on function public.enqueue_score_notifications(uuid, text) from anon, public;

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
  if not app_private.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;
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
  if not app_private.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;
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

grant execute on function public.create_score_import_run(uuid, public.import_trigger_type, text) to authenticated;
grant execute on function public.finish_score_import_run(uuid, public.import_status, jsonb, text, text, text, integer) to authenticated;
revoke execute on function public.create_score_import_run(uuid, public.import_trigger_type, text) from anon, public;
revoke execute on function public.finish_score_import_run(uuid, public.import_status, jsonb, text, text, text, integer) from anon, public;
