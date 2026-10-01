-- Allow members to dismiss (delete) their own in-app notifications.

create or replace function public.dismiss_notifications(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  uid := app_private.require_user_id();
  if p_ids is null or cardinality(p_ids) = 0 then
    return;
  end if;
  delete from public.notifications
  where user_id = uid
    and id = any(p_ids);
end;
$$;

comment on function public.dismiss_notifications(uuid[]) is
  'Deletes the caller''s notifications by id so they leave the Activity feed.';

grant execute on function public.dismiss_notifications(uuid[]) to authenticated;
revoke execute on function public.dismiss_notifications(uuid[]) from anon, public;
