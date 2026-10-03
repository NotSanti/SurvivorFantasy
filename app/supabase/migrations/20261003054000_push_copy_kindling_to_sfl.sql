-- Push / outbox lock-screen copy: Kindling → SFL
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

    body := 'Open SFL to see your tribe score.';

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
