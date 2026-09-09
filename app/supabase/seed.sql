-- Provisional Season 51 metadata.
-- Castaways come from the survivorstatsdb US51 list. Do not invent original-tribe membership.
-- Season 50-derived rules are draft / pending confirmation.

insert into public.seasons (
  id,
  number,
  name,
  status,
  premiere_at,
  timezone,
  source_page_url,
  first_scored_episode
) values (
  '11111111-1111-4111-8111-111111111111',
  51,
  'Survivor 51',
  'upcoming',
  timestamptz '2026-09-23 20:00:00-04',
  'America/Toronto',
  'https://www.globaltv.com/survivor-51-fantasy-tribe/',
  2
);

insert into public.rule_sets (
  id,
  season_id,
  version,
  status,
  source_url,
  source_hash,
  effective_from_episode,
  roster_size,
  wildcard_slots,
  picks_per_original_tribe,
  first_scored_episode,
  pending_confirmation
) values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  1,
  'draft',
  'https://www.globaltv.com/survivor-50-fantasy-tribe/',
  'pending-season-51-confirmation',
  2,
  9,
  1,
  '{"per_tribe": 3, "tribe_count": 3, "manual_distribution": [3, 3, 2]}'::jsonb,
  2,
  true
);

insert into public.scoring_rules (rule_set_id, code, label, points, kind, phase, max_occurrences_per_castaway_episode, sort_order)
values
  ('22222222-2222-4222-8222-222222222222', 'survive_pre_merge', 'Survive a pre-merge scoring episode', 1, 'survival', 'pre_merge', 1, 10),
  ('22222222-2222-4222-8222-222222222222', 'survive_post_merge', 'Survive a post-merge scoring episode', 3, 'survival', 'post_merge', 1, 20),
  ('22222222-2222-4222-8222-222222222222', 'place_third', 'Finish third', 10, 'placement', 'finale', 1, 30),
  ('22222222-2222-4222-8222-222222222222', 'place_second', 'Finish second', 20, 'placement', 'finale', 1, 40),
  ('22222222-2222-4222-8222-222222222222', 'place_first', 'Win the season', 30, 'placement', 'finale', 1, 50),
  ('22222222-2222-4222-8222-222222222222', 'mvp_win', 'MVP wins', 30, 'mvp', 'finale', 1, 60);

-- Season 51 names from survivorstatsdb US51 castaways tab (data v1.0.16).
-- Original tribe membership is not posted there; do not invent Savu/Toka assignments.

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
