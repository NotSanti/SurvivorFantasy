-- Fantasy tribe identity per league member (name + palette color), separate from show tribes.

alter table public.league_members
  add column if not exists fantasy_tribe_name text
    check (
      fantasy_tribe_name is null
      or char_length(btrim(fantasy_tribe_name)) between 2 and 32
    ),
  add column if not exists fantasy_tribe_color text
    check (
      fantasy_tribe_color is null
      or fantasy_tribe_color in (
        'ember', 'flame', 'clay', 'sand', 'gold',
        'moss', 'jungle', 'palm', 'lagoon', 'ocean',
        'dusk', 'violet', 'orchid', 'coral', 'crimson',
        'blood', 'smoke', 'bone', 'torchwood', 'sunrise'
      )
    );

comment on column public.league_members.fantasy_tribe_name is
  'Player-chosen fantasy tribe name for this league membership.';
comment on column public.league_members.fantasy_tribe_color is
  'Palette id for the fantasy tribe name color (not Savu/Toka).';

create or replace function public.update_fantasy_tribe(
  p_league_id uuid,
  p_name text,
  p_color text
)
returns public.league_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  cleaned text;
  row public.league_members;
begin
  uid := app_private.require_user_id();
  if not app_private.is_league_member(p_league_id) then
    raise exception 'Not a league member' using errcode = '42501';
  end if;

  cleaned := nullif(btrim(coalesce(p_name, '')), '');
  if cleaned is null or char_length(cleaned) < 2 or char_length(cleaned) > 32 then
    raise exception 'Tribe name must be 2 to 32 characters' using errcode = '22023';
  end if;

  if p_color is null or p_color not in (
    'ember', 'flame', 'clay', 'sand', 'gold',
    'moss', 'jungle', 'palm', 'lagoon', 'ocean',
    'dusk', 'violet', 'orchid', 'coral', 'crimson',
    'blood', 'smoke', 'bone', 'torchwood', 'sunrise'
  ) then
    raise exception 'Choose a valid tribe color' using errcode = '22023';
  end if;

  update public.league_members
  set fantasy_tribe_name = cleaned,
      fantasy_tribe_color = p_color
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
    'league.fantasy_tribe',
    'league',
    p_league_id,
    jsonb_build_object('name', cleaned, 'color', p_color)
  );

  return row;
end;
$$;

grant execute on function public.update_fantasy_tribe(uuid, text, text) to authenticated;
revoke execute on function public.update_fantasy_tribe(uuid, text, text) from anon, public;
