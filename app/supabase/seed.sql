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
  ('22222222-2222-4222-8222-222222222222', 'mvp_win', 'MVP wins', 30, 'mvp', 'finale', 1, 60),
  ('22222222-2222-4222-8222-222222222222', 'wc_group_immunity', 'Wins a group Immunity Challenge', 5, 'weekly_category', 'any', 1, 100),
  ('22222222-2222-4222-8222-222222222222', 'wc_group_reward', 'Wins a group Reward Challenge', 5, 'weekly_category', 'any', 1, 110),
  ('22222222-2222-4222-8222-222222222222', 'wc_chosen_reward', 'Gets chosen to go on reward', 5, 'weekly_category', 'any', 1, 120),
  ('22222222-2222-4222-8222-222222222222', 'wc_game_advantage', 'Finds or gets a game advantage', 5, 'weekly_category', 'any', 1, 130),
  ('22222222-2222-4222-8222-222222222222', 'wc_idol_self', 'Plays a hidden immunity idol on themselves at Tribal Council', 5, 'weekly_category', 'any', 1, 140),
  ('22222222-2222-4222-8222-222222222222', 'wc_use_advantage_tribal', 'Uses a game advantage at Tribal Council', 5, 'weekly_category', 'any', 1, 150),
  ('22222222-2222-4222-8222-222222222222', 'wc_cried_on_camera', 'Visually cries with tears on camera', 5, 'weekly_category', 'any', 1, 160),
  ('22222222-2222-4222-8222-222222222222', 'wc_curse_word', 'Says a curse word that is bleeped/censored', 5, 'weekly_category', 'any', 1, 170),
  ('22222222-2222-4222-8222-222222222222', 'wc_i_miss', 'Says, “I miss…”', 5, 'weekly_category', 'any', 1, 180),
  ('22222222-2222-4222-8222-222222222222', 'wc_kisses', 'Kisses another player still in the game', 5, 'weekly_category', 'any', 1, 190),
  ('22222222-2222-4222-8222-222222222222', 'wc_heated_argument', 'Gets into a heated argument and shouts at another player', 5, 'weekly_category', 'any', 1, 200),
  ('22222222-2222-4222-8222-222222222222', 'wc_wardrobe', 'Has a wardrobe malfunction/shows nudity that is blurred on screen', 5, 'weekly_category', 'any', 1, 210),
  ('22222222-2222-4222-8222-222222222222', 'wc_risk_vote', 'Chooses to risk their vote', 5, 'weekly_category', 'any', 1, 220),
  ('22222222-2222-4222-8222-222222222222', 'wc_find_fake_idol', 'Finds a fake immunity idol', 5, 'weekly_category', 'any', 1, 230),
  ('22222222-2222-4222-8222-222222222222', 'wc_hugs_jeff', 'Hugs Jeff', 5, 'weekly_category', 'any', 1, 240),
  ('22222222-2222-4222-8222-222222222222', 'wc_fire_tokens', 'Buys something with fire tokens', 5, 'weekly_category', 'any', 1, 250),
  ('22222222-2222-4222-8222-222222222222', 'wc_individual_reward', 'Wins an individual Reward Challenge', 10, 'weekly_category', 'any', 1, 300),
  ('22222222-2222-4222-8222-222222222222', 'wc_find_idol', 'Finds a hidden immunity idol', 10, 'weekly_category', 'any', 1, 310),
  ('22222222-2222-4222-8222-222222222222', 'wc_voted_with_advantage', 'Voted out while in possession of a hidden immunity idol or game advantage', 10, 'weekly_category', 'any', 1, 320),
  ('22222222-2222-4222-8222-222222222222', 'wc_shot_in_the_dark', 'Plays their Shot in the Dark', 10, 'weekly_category', 'any', 1, 330),
  ('22222222-2222-4222-8222-222222222222', 'wc_blindside', 'Torch gets snuffed as a result of a blindside', 10, 'weekly_category', 'any', 1, 340),
  ('22222222-2222-4222-8222-222222222222', 'wc_medical', 'Gets treated for a medical emergency', 10, 'weekly_category', 'any', 1, 350),
  ('22222222-2222-4222-8222-222222222222', 'wc_forfeit', 'Chooses to forfeit the game', 10, 'weekly_category', 'any', 1, 360),
  ('22222222-2222-4222-8222-222222222222', 'wc_seafood', 'Catches seafood or wildlife', 10, 'weekly_category', 'any', 1, 370),
  ('22222222-2222-4222-8222-222222222222', 'wc_tamper_food', 'Tampers with or steals the tribe’s food', 10, 'weekly_category', 'any', 1, 380),
  ('22222222-2222-4222-8222-222222222222', 'wc_play_fake_idol', 'Plays a fake immunity idol at Tribal Council', 10, 'weekly_category', 'any', 1, 390),
  ('22222222-2222-4222-8222-222222222222', 'wc_search_bag', 'Searches through someone else’s bag', 10, 'weekly_category', 'any', 1, 400),
  ('22222222-2222-4222-8222-222222222222', 'wc_unanimous', 'Voted out unanimously', 10, 'weekly_category', 'any', 1, 410),
  ('22222222-2222-4222-8222-222222222222', 'wc_idol_played_on_them', 'A hidden immunity idol is played on them by another player', 10, 'weekly_category', 'any', 1, 420),
  ('22222222-2222-4222-8222-222222222222', 'wc_million_coin_chosen', 'Is chosen to flip the “million-dollar coin”', 10, 'weekly_category', 'any', 1, 430),
  ('22222222-2222-4222-8222-222222222222', 'wc_journey', 'Is chosen to go on a journey or sent to Exile Island', 10, 'weekly_category', 'any', 1, 440),
  ('22222222-2222-4222-8222-222222222222', 'wc_individual_immunity', 'Wins an individual Immunity Challenge', 15, 'weekly_category', 'any', 1, 500),
  ('22222222-2222-4222-8222-222222222222', 'wc_safe_scroll', 'Draws a SAFE scroll as a result of playing their Shot in the Dark', 15, 'weekly_category', 'any', 1, 510),
  ('22222222-2222-4222-8222-222222222222', 'wc_fire_making', 'Wins a fire-making challenge', 15, 'weekly_category', 'any', 1, 520),
  ('22222222-2222-4222-8222-222222222222', 'wc_idol_for_another', 'Gives an immunity idol/necklace away or plays it for another player', 15, 'weekly_category', 'any', 1, 530),
  ('22222222-2222-4222-8222-222222222222', 'wc_create_fake_idol', 'Creates a fake immunity idol', 15, 'weekly_category', 'any', 1, 540),
  ('22222222-2222-4222-8222-222222222222', 'wc_fake_idol_success', 'Successfully gets another player to play their fake idol at Tribal Council', 15, 'weekly_category', 'any', 1, 550),
  ('22222222-2222-4222-8222-222222222222', 'wc_forced_leave', 'Is forced to leave the game by no choice of their own (asides from being voted off)', 15, 'weekly_category', 'any', 1, 560),
  ('22222222-2222-4222-8222-222222222222', 'wc_returns', 'Returns to the game after being voted off/eliminated', 15, 'weekly_category', 'any', 1, 570),
  ('22222222-2222-4222-8222-222222222222', 'wc_million_coin_success', 'Successfully flips the “million-dollar” coin and isn’t eliminated', 15, 'weekly_category', 'any', 1, 580)
on conflict (rule_set_id, code) do nothing;

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
