-- Season 51 names from survivorstatsdb US51 castaways tab (data v1.0.16).
-- Original tribe membership is not posted there; do not invent Savu/Toka assignments.
-- No-op on a fresh reset until seed.sql inserts Season 51.

insert into public.castaways (season_id, display_name, slug, status)
select s.id, v.display_name, v.slug, 'active'
from public.seasons s
cross join (
  values
    ('Aaliyah', 'aaliyah'),
    ('Alexis', 'alexis'),
    ('An', 'an'),
    ('Ana', 'ana'),
    ('Angelica', 'angelica'),
    ('Brady', 'brady'),
    ('Carter', 'carter'),
    ('Cristian', 'cristian'),
    ('Danny', 'danny'),
    ('Devin', 'devin'),
    ('Eric', 'eric'),
    ('Jenna', 'jenna'),
    ('Kristin', 'kristin'),
    ('Lewis', 'lewis'),
    ('Linnea', 'linnea'),
    ('Maggie', 'maggie'),
    ('Mike', 'mike'),
    ('Ori', 'ori'),
    ('Patt', 'patt'),
    ('Rob', 'rob'),
    ('Sharonda', 'sharonda')
) as v(display_name, slug)
where s.number = 51
on conflict (season_id, slug) do update
  set display_name = excluded.display_name;

insert into public.castaway_source_aliases (
  season_id,
  source_key,
  normalized_source_name,
  castaway_id
)
select c.season_id, 'globaltv', a.normalized_source_name, c.id
from public.castaways c
join public.seasons s on s.id = c.season_id and s.number = 51
join (
  values
    ('aaliyah', 'aaliyah'),
    ('aaliyah', 'aaliyah puglia'),
    ('alexis', 'alexis'),
    ('alexis', 'alexis levine'),
    ('an', 'an'),
    ('an', 'an nguyen'),
    ('ana', 'ana'),
    ('ana', 'ana sani'),
    ('angelica', 'angelica'),
    ('angelica', 'angelica ''jelly'' loblack'),
    ('angelica', 'angelica jelly loblack'),
    ('angelica', 'jelly'),
    ('brady', 'brady'),
    ('brady', 'brady booker'),
    ('carter', 'carter'),
    ('carter', 'carter krull'),
    ('cristian', 'cristian'),
    ('cristian', 'cristian chavez'),
    ('danny', 'danny'),
    ('danny', 'danny kilby'),
    ('danny', 'kilby'),
    ('devin', 'devin'),
    ('devin', 'devin way'),
    ('eric', 'eric'),
    ('eric', 'eric macksoud'),
    ('jenna', 'jenna'),
    ('jenna', 'jenna doore'),
    ('kristin', 'kristin'),
    ('kristin', 'kristin flickinger'),
    ('lewis', 'lewis'),
    ('lewis', 'lewis kelly'),
    ('linnea', 'linnea'),
    ('linnea', 'linnea capobianco'),
    ('maggie', 'maggie'),
    ('maggie', 'maggie nestor'),
    ('mike', 'mike'),
    ('mike', 'mike pinsky'),
    ('ori', 'ori'),
    ('ori', 'ori jean-charles'),
    ('ori', 'ori-jean charles'),
    ('patt', 'patt'),
    ('patt', 'patt cannaday'),
    ('rob', 'rob'),
    ('rob', 'rob antonson'),
    ('sharonda', 'sharonda'),
    ('sharonda', 'sharonda cox')
) as a(slug, normalized_source_name) on a.slug = c.slug
on conflict (season_id, source_key, normalized_source_name) do update
  set castaway_id = excluded.castaway_id;
