-- Castaway portraits for Season 51 draft UI.
-- Assets live in app/public/castaways/{slug}.png (sourced once from survivorstatsdb US51).

update public.castaways c
set photo_url = '/castaways/' || c.slug || '.png'
from public.seasons s
where s.id = c.season_id
  and s.number = 51
  and c.slug in (
    'aaliyah', 'alexis', 'an', 'ana', 'angelica', 'brady', 'carter', 'cristian',
    'danny', 'devin', 'eric', 'jenna', 'kristin', 'lewis', 'linnea', 'maggie',
    'mike', 'ori', 'patt', 'rob', 'sharonda'
  );

-- Align display names with Global / survivorstatsdb short labels used in photos.
update public.castaways c
set display_name = v.display_name
from public.seasons s
join (
  values
    ('angelica', 'Jelly'),
    ('an', 'Thien An')
) as v(slug, display_name) on true
where s.id = c.season_id
  and s.number = 51
  and c.slug = v.slug;
