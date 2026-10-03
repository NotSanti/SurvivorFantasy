-- Postgres rejects CASE text branches assigned to episode_status without an explicit cast.
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
  values (p_season_id, p_episode_number, 'parsed'::public.episode_status)
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
    status = case
      when kind = 'correction' then 'corrected'::public.episode_status
      else 'published'::public.episode_status
    end,
    published_score_revision = next_revision
  where id = episode_row.id;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (uid, 'scores.publish', 'episode', episode_row.id, jsonb_build_object('kind', kind, 'revision', next_revision, 'run_id', p_run_id));
  return jsonb_build_object('status', 'published', 'kind', kind, 'episode_id', episode_row.id, 'episode_number', p_episode_number, 'revision', next_revision);
end;
$$;
