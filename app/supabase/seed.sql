-- Provisional Season 51 metadata.
-- Castaways and original tribes come from Global's Fantasy Tribe page / survivorstatsdb.

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
  'https://www.globaltv.com/survivor-51-fantasy-tribe/',
  'season-51-global-4-4',
  2,
  8,
  0,
  '{"per_tribe": 4, "tribe_count": 2, "manual_distribution": [4, 4]}'::jsonb,
  2,
  true
);

insert into public.scoring_rules (rule_set_id, code, label, points, kind, phase, max_occurrences_per_castaway_episode, sort_order)
values
  ('22222222-2222-4222-8222-222222222222', 'survive_pre_merge', 'Survive a pre merge episode', 1, 'survival', 'pre_merge', 1, 10),
  ('22222222-2222-4222-8222-222222222222', 'survive_post_merge', 'Survive a post merge episode', 3, 'survival', 'post_merge', 1, 20),
  ('22222222-2222-4222-8222-222222222222', 'place_third', 'Finish third', 10, 'placement', 'finale', 1, 30),
  ('22222222-2222-4222-8222-222222222222', 'place_second', 'Finish second', 20, 'placement', 'finale', 1, 40),
  ('22222222-2222-4222-8222-222222222222', 'place_first', 'Win the season', 30, 'placement', 'finale', 1, 50),
  ('22222222-2222-4222-8222-222222222222', 'mvp_win', 'MVP wins', 30, 'mvp', 'finale', 1, 60);

-- Season 51 names from survivorstatsdb US51 castaways tab.

insert into public.tribes (season_id, name, color_name, color_token, sort_order)
select s.id, v.name, v.color_name, v.color_token, v.sort_order
from public.seasons s
cross join (
  values
    ('Savu', 'Purple', 'purple', 1::smallint),
    ('Toka', 'Yellow', 'yellow', 2::smallint)
) as v(name, color_name, color_token, sort_order)
where s.number = 51
on conflict (season_id, name) do update
  set color_name = excluded.color_name,
      color_token = excluded.color_token,
      sort_order = excluded.sort_order;

insert into public.castaways (season_id, display_name, slug, status, photo_url, original_tribe_id)
select
  s.id,
  v.display_name,
  v.slug,
  case when v.slug = 'aaliyah' then 'eliminated'::public.castaway_status else 'active'::public.castaway_status end,
  '/castaways/' || v.slug || '.png',
  t.id
from public.seasons s
cross join (
  values
    ('Aaliyah', 'aaliyah', 'Toka'),
    ('Alexis', 'alexis', 'Savu'),
    ('Thien An', 'an', 'Toka'),
    ('Ana', 'ana', 'Savu'),
    ('Jelly', 'angelica', 'Toka'),
    ('Brady', 'brady', 'Toka'),
    ('Carter', 'carter', 'Savu'),
    ('Cristian', 'cristian', 'Savu'),
    ('Danny', 'danny', 'Toka'),
    ('Devin', 'devin', 'Toka'),
    ('Eric', 'eric', 'Savu'),
    ('Jenna', 'jenna', 'Toka'),
    ('Kristin', 'kristin', 'Savu'),
    ('Lewis', 'lewis', 'Toka'),
    ('Linnea', 'linnea', 'Savu'),
    ('Maggie', 'maggie', 'Toka'),
    ('Mike', 'mike', 'Toka'),
    ('Ori', 'ori', 'Savu'),
    ('Patt', 'patt', 'Toka'),
    ('Rob', 'rob', 'Savu'),
    ('Sharonda', 'sharonda', 'Savu')
) as v(display_name, slug, tribe_name)
join public.tribes t on t.season_id = s.id and t.name = v.tribe_name
where s.number = 51
on conflict (season_id, slug) do update
  set display_name = excluded.display_name,
      photo_url = excluded.photo_url,
      original_tribe_id = excluded.original_tribe_id,
      status = excluded.status;

update public.castaways c
set eliminated_episode_number = 1,
    final_placement = 21
from public.seasons s
where s.id = c.season_id
  and s.number = 51
  and c.slug = 'aaliyah';

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
