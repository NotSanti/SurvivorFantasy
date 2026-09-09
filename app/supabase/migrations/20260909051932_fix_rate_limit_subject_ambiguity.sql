-- PL/pgSQL treated the local variable `subject` as the table column in
-- WHERE clauses, so register_push_subscription failed with:
-- column reference "subject" is ambiguous

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
  v_subject text;
  hits integer;
begin
  if app_private.is_service_role() then
    return;
  end if;

  v_subject := coalesce((select auth.uid())::text, 'anon:' || p_action);

  delete from app_private.rate_limit_hits
  where rate_limit_hits.subject = v_subject
    and rate_limit_hits.action = p_action
    and rate_limit_hits.hit_at < now() - p_window;

  select count(*) into hits
  from app_private.rate_limit_hits
  where rate_limit_hits.subject = v_subject
    and rate_limit_hits.action = p_action
    and rate_limit_hits.hit_at >= now() - p_window;

  if hits >= p_limit then
    raise exception 'Too many attempts. Try again shortly.' using errcode = '54000';
  end if;

  insert into app_private.rate_limit_hits (subject, action)
  values (v_subject, p_action);
end;
$$;
