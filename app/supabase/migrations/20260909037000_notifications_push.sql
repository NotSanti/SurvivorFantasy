-- Push subscription RPCs, outbox claim/complete, spoiler-safe score routes, notifications realtime.

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

create or replace function public.revoke_push_subscription(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  hashed text;
begin
  uid := app_private.require_user_id();
  hashed := encode(extensions.digest(convert_to(p_endpoint, 'UTF8'), 'sha256'), 'hex');
  update public.push_subscriptions
  set revoked_at = now()
  where endpoint_hash = hashed
    and user_id = uid
    and revoked_at is null;
end;
$$;

create or replace function public.mark_notifications_read(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  uid := app_private.require_user_id();
  update public.notifications
  set read_at = now()
  where user_id = uid
    and read_at is null
    and id = any(p_ids);
end;
$$;

create or replace function app_private.claim_notification_outbox(p_limit integer)
returns setof public.notification_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with picked as (
    select o.id
    from public.notification_outbox o
    where o.status = 'pending'
      and o.available_at <= now()
    order by o.available_at
    limit greatest(coalesce(p_limit, 20), 1)
    for update skip locked
  )
  update public.notification_outbox n
  set
    status = 'processing',
    attempt_count = n.attempt_count + 1
  from picked
  where n.id = picked.id
  returning n.*;
end;
$$;

create or replace function app_private.complete_notification_outbox(
  p_id uuid,
  p_status public.outbox_status,
  p_error_redacted text default null,
  p_available_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notification_outbox
  set
    status = p_status,
    last_error_redacted = p_error_redacted,
    available_at = coalesce(p_available_at, available_at)
  where id = p_id;
end;
$$;

create or replace function app_private.revoke_push_endpoint(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  hashed text;
begin
  hashed := encode(extensions.digest(convert_to(p_endpoint, 'UTF8'), 'sha256'), 'hex');
  update public.push_subscriptions
  set revoked_at = now()
  where endpoint_hash = hashed
    and revoked_at is null;
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

grant execute on function public.register_push_subscription(text, text, text, text, text) to authenticated;
grant execute on function public.revoke_push_subscription(text) to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
grant execute on function public.enqueue_score_notifications(uuid, text) to authenticated;
revoke execute on function public.register_push_subscription(text, text, text, text, text) from anon, public;
revoke execute on function public.revoke_push_subscription(text) from anon, public;
revoke execute on function public.mark_notifications_read(uuid[]) from anon, public;
revoke execute on function public.enqueue_score_notifications(uuid, text) from anon, public;

create or replace function public.claim_notification_outbox(p_limit integer)
returns setof public.notification_outbox
language sql
security definer
set search_path = ''
as $$
  select * from app_private.claim_notification_outbox(p_limit);
$$;

create or replace function public.complete_notification_outbox(
  p_id uuid,
  p_status public.outbox_status,
  p_error_redacted text default null,
  p_available_at timestamptz default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  select app_private.complete_notification_outbox(p_id, p_status, p_error_redacted, p_available_at);
$$;

create or replace function public.revoke_push_endpoint(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  select app_private.revoke_push_endpoint(p_endpoint);
$$;

revoke execute on function app_private.claim_notification_outbox(integer) from public, anon, authenticated;
revoke execute on function app_private.complete_notification_outbox(uuid, public.outbox_status, text, timestamptz) from public, anon, authenticated;
revoke execute on function app_private.revoke_push_endpoint(text) from public, anon, authenticated;
revoke execute on function public.claim_notification_outbox(integer) from public, anon, authenticated;
revoke execute on function public.complete_notification_outbox(uuid, public.outbox_status, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.revoke_push_endpoint(text) from public, anon, authenticated;
grant execute on function app_private.claim_notification_outbox(integer) to service_role;
grant execute on function app_private.complete_notification_outbox(uuid, public.outbox_status, text, timestamptz) to service_role;
grant execute on function app_private.revoke_push_endpoint(text) to service_role;
grant execute on function public.claim_notification_outbox(integer) to service_role;
grant execute on function public.complete_notification_outbox(uuid, public.outbox_status, text, timestamptz) to service_role;
grant execute on function public.revoke_push_endpoint(text) to service_role;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;

alter table public.notifications replica identity full;
