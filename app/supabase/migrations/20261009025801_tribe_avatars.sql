-- Per-league tribe avatar: a castaway headshot, an uploaded image, or neither (letter fallback).

alter table public.league_members
  add column avatar_castaway_id uuid references public.castaways (id) on delete set null,
  add column avatar_path text,
  add column avatar_updated_at timestamptz,
  add constraint league_members_avatar_one_source check (
    avatar_castaway_id is null or avatar_path is null
  ),
  add constraint league_members_avatar_path_shape check (
    avatar_path is null
    or avatar_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'
  );

comment on column public.league_members.avatar_castaway_id is
  'Castaway whose photo is this membership''s tribe avatar. Null when using an upload or the letter.';
comment on column public.league_members.avatar_path is
  'Storage object key in tribe-avatars for a custom image. Shape {user_id}/{league_id}.webp.';
comment on column public.league_members.avatar_updated_at is
  'Cache-buster for the public avatar URL.';

create index league_members_avatar_castaway_id_idx
  on public.league_members (avatar_castaway_id)
  where avatar_castaway_id is not null;

create or replace function public.set_tribe_avatar(
  p_league_id uuid,
  p_castaway_id uuid default null,
  p_avatar_path text default null
)
returns public.league_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  season uuid;
  cleaned_path text;
  expected_path text;
  row public.league_members;
begin
  uid := app_private.require_user_id();
  if not app_private.is_league_member(p_league_id) then
    raise exception 'Not a league member' using errcode = '42501';
  end if;

  cleaned_path := nullif(btrim(coalesce(p_avatar_path, '')), '');

  if p_castaway_id is not null and cleaned_path is not null then
    raise exception 'Choose a castaway or an upload, not both' using errcode = '22023';
  end if;

  if p_castaway_id is not null then
    select l.season_id into season
    from public.leagues l
    where l.id = p_league_id;

    if season is null then
      raise exception 'League not found' using errcode = '22023';
    end if;

    if not exists (
      select 1
      from public.castaways c
      where c.id = p_castaway_id
        and c.season_id = season
    ) then
      raise exception 'Castaway is not in this season' using errcode = '22023';
    end if;
  elsif cleaned_path is not null then
    expected_path := uid::text || '/' || p_league_id::text || '.webp';
    if cleaned_path is distinct from expected_path then
      raise exception 'Invalid avatar path' using errcode = '22023';
    end if;
  end if;

  update public.league_members
  set
    avatar_castaway_id = p_castaway_id,
    avatar_path = cleaned_path,
    avatar_updated_at = now()
  where league_id = p_league_id
    and user_id = uid
    and status = 'active'
  returning * into row;

  if row.user_id is null then
    raise exception 'Active membership not found' using errcode = '22023';
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    uid,
    'league.tribe_avatar',
    'league',
    p_league_id,
    jsonb_build_object('castaway_id', p_castaway_id, 'avatar_path', cleaned_path)
  );

  return row;
end;
$$;

grant execute on function public.set_tribe_avatar(uuid, uuid, text) to authenticated;
revoke execute on function public.set_tribe_avatar(uuid, uuid, text) from anon, public;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tribe-avatars',
  'tribe-avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
);

create policy tribe_avatars_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'tribe-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy tribe_avatars_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'tribe-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy tribe_avatars_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'tribe-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'tribe-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy tribe_avatars_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'tribe-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
