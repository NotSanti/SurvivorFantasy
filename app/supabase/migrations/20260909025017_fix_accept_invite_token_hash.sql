-- Rename the PL/pgSQL variable so it does not collide with league_invites.token_hash.
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
