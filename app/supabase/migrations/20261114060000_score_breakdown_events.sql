-- Category-level score breakdowns: weekly rules, CSV review staging, publish RPC, client view.

create type public.score_breakdown_review_status as enum (
  'pending_review',
  'confirmed',
  'rejected'
);

create table public.score_breakdown_reviews (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  episode_id uuid not null references public.episodes (id) on delete cascade,
  episode_number smallint not null,
  source_image_url text,
  status public.score_breakdown_review_status not null default 'pending_review',
  proposal jsonb not null default '{}'::jsonb,
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, episode_number)
);

create trigger score_breakdown_reviews_updated_at
  before update on public.score_breakdown_reviews
  for each row execute function app_private.set_updated_at();

alter table public.score_breakdown_reviews enable row level security;

create policy score_breakdown_reviews_admin_read on public.score_breakdown_reviews
  for select to authenticated
  using ((select app_private.is_admin()));

create policy score_events_published_member_read on public.score_events
  for select to authenticated
  using (
    exists (
      select 1
      from public.castaway_episode_score_revisions r
      where r.id = score_events.score_revision_id
        and r.status = 'published'
        and (
          (select app_private.is_season_league_member(r.season_id))
          or (select app_private.is_admin())
        )
    )
  );

grant select on public.score_events to authenticated;
grant select on public.score_breakdown_reviews to authenticated;

-- Seed weekly categories (+ keep survival/placement/MVP) on every existing rule set.
insert into public.scoring_rules (
  rule_set_id, code, label, points, kind, phase, max_occurrences_per_castaway_episode, sort_order
)
select
  rs.id,
  v.code,
  v.label,
  v.points,
  v.kind::public.scoring_rule_kind,
  'any'::public.scoring_phase,
  1::smallint,
  v.sort_order
from public.rule_sets rs
cross join (
  values
    ('wc_group_immunity', 'Wins a group Immunity Challenge', 5, 'weekly_category', 100),
    ('wc_group_reward', 'Wins a group Reward Challenge', 5, 'weekly_category', 110),
    ('wc_chosen_reward', 'Gets chosen to go on reward', 5, 'weekly_category', 120),
    ('wc_game_advantage', 'Finds or gets a game advantage', 5, 'weekly_category', 130),
    ('wc_idol_self', 'Plays a hidden immunity idol on themselves at Tribal Council', 5, 'weekly_category', 140),
    ('wc_use_advantage_tribal', 'Uses a game advantage at Tribal Council', 5, 'weekly_category', 150),
    ('wc_cried_on_camera', 'Visually cries with tears on camera', 5, 'weekly_category', 160),
    ('wc_curse_word', 'Says a curse word that is bleeped/censored', 5, 'weekly_category', 170),
    ('wc_i_miss', 'Says, “I miss…”', 5, 'weekly_category', 180),
    ('wc_kisses', 'Kisses another player still in the game', 5, 'weekly_category', 190),
    ('wc_heated_argument', 'Gets into a heated argument and shouts at another player', 5, 'weekly_category', 200),
    ('wc_wardrobe', 'Has a wardrobe malfunction/shows nudity that is blurred on screen', 5, 'weekly_category', 210),
    ('wc_risk_vote', 'Chooses to risk their vote', 5, 'weekly_category', 220),
    ('wc_find_fake_idol', 'Finds a fake immunity idol', 5, 'weekly_category', 230),
    ('wc_hugs_jeff', 'Hugs Jeff', 5, 'weekly_category', 240),
    ('wc_fire_tokens', 'Buys something with fire tokens', 5, 'weekly_category', 250),
    ('wc_individual_reward', 'Wins an individual Reward Challenge', 10, 'weekly_category', 300),
    ('wc_find_idol', 'Finds a hidden immunity idol', 10, 'weekly_category', 310),
    ('wc_voted_with_advantage', 'Voted out while in possession of a hidden immunity idol or game advantage', 10, 'weekly_category', 320),
    ('wc_shot_in_the_dark', 'Plays their Shot in the Dark', 10, 'weekly_category', 330),
    ('wc_blindside', 'Torch gets snuffed as a result of a blindside', 10, 'weekly_category', 340),
    ('wc_medical', 'Gets treated for a medical emergency', 10, 'weekly_category', 350),
    ('wc_forfeit', 'Chooses to forfeit the game', 10, 'weekly_category', 360),
    ('wc_seafood', 'Catches seafood or wildlife', 10, 'weekly_category', 370),
    ('wc_tamper_food', 'Tampers with or steals the tribe’s food', 10, 'weekly_category', 380),
    ('wc_play_fake_idol', 'Plays a fake immunity idol at Tribal Council', 10, 'weekly_category', 390),
    ('wc_search_bag', 'Searches through someone else’s bag', 10, 'weekly_category', 400),
    ('wc_unanimous', 'Voted out unanimously', 10, 'weekly_category', 410),
    ('wc_idol_played_on_them', 'A hidden immunity idol is played on them by another player', 10, 'weekly_category', 420),
    ('wc_million_coin_chosen', 'Is chosen to flip the “million-dollar coin”', 10, 'weekly_category', 430),
    ('wc_journey', 'Is chosen to go on a journey or sent to Exile Island', 10, 'weekly_category', 440),
    ('wc_individual_immunity', 'Wins an individual Immunity Challenge', 15, 'weekly_category', 500),
    ('wc_safe_scroll', 'Draws a SAFE scroll as a result of playing their Shot in the Dark', 15, 'weekly_category', 510),
    ('wc_fire_making', 'Wins a fire-making challenge', 15, 'weekly_category', 520),
    ('wc_idol_for_another', 'Gives an immunity idol/necklace away or plays it for another player', 15, 'weekly_category', 530),
    ('wc_create_fake_idol', 'Creates a fake immunity idol', 15, 'weekly_category', 540),
    ('wc_fake_idol_success', 'Successfully gets another player to play their fake idol at Tribal Council', 15, 'weekly_category', 550),
    ('wc_forced_leave', 'Is forced to leave the game by no choice of their own (asides from being voted off)', 15, 'weekly_category', 560),
    ('wc_returns', 'Returns to the game after being voted off/eliminated', 15, 'weekly_category', 570),
    ('wc_million_coin_success', 'Successfully flips the “million-dollar” coin and isn’t eliminated', 15, 'weekly_category', 580)
) as v(code, label, points, kind, sort_order)
on conflict (rule_set_id, code) do update
  set label = excluded.label,
      points = excluded.points,
      kind = excluded.kind,
      phase = excluded.phase,
      max_occurrences_per_castaway_episode = excluded.max_occurrences_per_castaway_episode,
      sort_order = excluded.sort_order;

create or replace view public.published_castaway_score_events
with (security_invoker = true) as
select
  r.season_id,
  r.episode_id,
  e.episode_number,
  r.castaway_id,
  r.id as score_revision_id,
  r.revision,
  r.points_total,
  se.scoring_rule_id,
  sr.code as rule_code,
  sr.label as rule_label,
  sr.kind as rule_kind,
  se.occurrences,
  se.points,
  se.evidence_note
from public.castaway_episode_score_revisions r
join public.episodes e on e.id = r.episode_id
join public.score_events se on se.score_revision_id = r.id
join public.scoring_rules sr on sr.id = se.scoring_rule_id
where r.status = 'published'
  and e.published_score_revision = r.revision;

grant select on public.published_castaway_score_events to authenticated;

create or replace function public.publish_score_events(
  p_season_id uuid,
  p_episode_number smallint,
  p_events jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_episode_id uuid;
  v_rule_set_id uuid;
  v_castaway jsonb;
  v_line jsonb;
  v_revision_id uuid;
  v_rule_id uuid;
  v_count integer := 0;
begin
  if not app_private.is_admin() then
    raise exception 'admin required';
  end if;

  select e.id into v_episode_id
  from public.episodes e
  where e.season_id = p_season_id
    and e.episode_number = p_episode_number;
  if v_episode_id is null then
    raise exception 'episode not found';
  end if;

  -- Prefer a confirmed rule set for the season; fall back to any attached.
  select rs.id into v_rule_set_id
  from public.rule_sets rs
  where rs.season_id = p_season_id
  order by
    case when rs.status = 'confirmed' then 0 else 1 end,
    rs.version desc
  limit 1;
  if v_rule_set_id is null then
    raise exception 'rule set not found';
  end if;

  for v_castaway in
    select value from jsonb_array_elements(coalesce(p_events, '[]'::jsonb))
  loop
    select r.id into v_revision_id
    from public.castaway_episode_score_revisions r
    join public.episodes e on e.id = r.episode_id
    where r.season_id = p_season_id
      and r.castaway_id = (v_castaway->>'castaway_id')::uuid
      and e.episode_number = p_episode_number
      and r.status = 'published'
      and e.published_score_revision = r.revision
    limit 1;

    if v_revision_id is null then
      raise exception 'published revision missing for castaway %', v_castaway->>'castaway_id';
    end if;

    delete from public.score_events where score_revision_id = v_revision_id;

    for v_line in
      select value from jsonb_array_elements(coalesce(v_castaway->'lines', '[]'::jsonb))
    loop
      if coalesce(v_line->>'rule_code', '') = '' then
        raise exception 'unmapped rule for castaway %', v_castaway->>'castaway_id';
      end if;

      select sr.id into v_rule_id
      from public.scoring_rules sr
      where sr.rule_set_id = v_rule_set_id
        and sr.code = v_line->>'rule_code';
      if v_rule_id is null then
        raise exception 'unknown rule_code %', v_line->>'rule_code';
      end if;

      insert into public.score_events (
        score_revision_id, scoring_rule_id, occurrences, points, evidence_note
      ) values (
        v_revision_id,
        v_rule_id,
        greatest(coalesce((v_line->>'occurrences')::smallint, 1), 1),
        (v_line->>'points')::integer,
        nullif(v_line->>'evidence_note', '')
      );
      v_count := v_count + 1;
    end loop;
  end loop;

  update public.score_breakdown_reviews
  set
    status = 'confirmed',
    confirmed_at = now(),
    confirmed_by = auth.uid(),
    proposal = jsonb_build_object('castaways', coalesce(p_events, '[]'::jsonb))
  where season_id = p_season_id
    and episode_number = p_episode_number;

  if not found then
    insert into public.score_breakdown_reviews (
      season_id, episode_id, episode_number, status, proposal, confirmed_at, confirmed_by
    ) values (
      p_season_id,
      v_episode_id,
      p_episode_number,
      'confirmed',
      jsonb_build_object('castaways', coalesce(p_events, '[]'::jsonb)),
      now(),
      auth.uid()
    );
  end if;

  return jsonb_build_object('ok', true, 'event_count', v_count);
end;
$$;

create or replace function public.reject_score_breakdown_review(
  p_season_id uuid,
  p_episode_number smallint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not app_private.is_admin() then
    raise exception 'admin required';
  end if;

  update public.score_breakdown_reviews
  set status = 'rejected',
      confirmed_at = null,
      confirmed_by = null
  where season_id = p_season_id
    and episode_number = p_episode_number;

  if not found then
    raise exception 'review not found';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.upsert_score_breakdown_review(
  p_season_id uuid,
  p_episode_number smallint,
  p_source_image_url text,
  p_proposal jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_episode_id uuid;
  v_id uuid;
begin
  perform app_private.require_admin_actor();

  select e.id into v_episode_id
  from public.episodes e
  where e.season_id = p_season_id
    and e.episode_number = p_episode_number;
  if v_episode_id is null then
    raise exception 'episode not found';
  end if;

  insert into public.score_breakdown_reviews (
    season_id, episode_id, episode_number, source_image_url, status, proposal
  ) values (
    p_season_id, v_episode_id, p_episode_number, p_source_image_url, 'pending_review', p_proposal
  )
  on conflict (season_id, episode_number) do update
    set episode_id = excluded.episode_id,
        source_image_url = excluded.source_image_url,
        status = 'pending_review',
        proposal = excluded.proposal,
        confirmed_at = null,
        confirmed_by = null
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.publish_score_events(uuid, smallint, jsonb) to authenticated;
grant execute on function public.reject_score_breakdown_review(uuid, smallint) to authenticated;
grant execute on function public.upsert_score_breakdown_review(uuid, smallint, text, jsonb)
  to authenticated, service_role;

revoke execute on function public.publish_score_events(uuid, smallint, jsonb) from anon, public;
revoke execute on function public.reject_score_breakdown_review(uuid, smallint) from anon, public;
revoke execute on function public.upsert_score_breakdown_review(uuid, smallint, text, jsonb)
  from anon, public;
