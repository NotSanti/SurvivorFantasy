import { describe, expect, it } from 'vitest'
import { matchBreakdownLabel } from './match-breakdown-label'

describe('matchBreakdownLabel', () => {
  it('maps Global short labels from score graphics', () => {
    expect(matchBreakdownLabel('Cried on Camera', 5)?.code).toBe('wc_cried_on_camera')
    expect(matchBreakdownLabel('Got an Advantage', 5)?.code).toBe('wc_game_advantage')
    expect(matchBreakdownLabel('Chosen to Go On a Journey', 10)?.code).toBe('wc_journey')
    expect(matchBreakdownLabel("Played His 'Shot in the Dark'", 10)?.code).toBe(
      'wc_shot_in_the_dark',
    )
    expect(matchBreakdownLabel('Drew a Safe Scroll', 15)?.code).toBe('wc_safe_scroll')
    expect(matchBreakdownLabel('Survived the Week', 3)?.code).toBe('survive_post_merge')
    expect(matchBreakdownLabel('Survived the Week', 1)?.code).toBe('survive_pre_merge')
    expect(matchBreakdownLabel('Said a Curse Word', 5)?.code).toBe('wc_curse_word')
    expect(matchBreakdownLabel('Chosen for Reward', 5)?.code).toBe('wc_chosen_reward')
    expect(matchBreakdownLabel('Played an Immunity Idol on Herself', 5)?.code).toBe('wc_idol_self')
    expect(matchBreakdownLabel('Played an Immunity Idol for Another Player', 15)?.code).toBe(
      'wc_idol_for_another',
    )
    expect(matchBreakdownLabel('Won Group Reward', 5)?.code).toBe('wc_group_reward')
    expect(matchBreakdownLabel('Won Individual Immunity', 15)?.code).toBe('wc_individual_immunity')
    expect(matchBreakdownLabel('Played an Advantage at Tribal', 5)?.code).toBe(
      'wc_use_advantage_tribal',
    )
    expect(matchBreakdownLabel('Got an Advantage', 5)?.code).toBe('wc_game_advantage')
    expect(matchBreakdownLabel('Created a Fake Idol', 15)?.code).toBe('wc_create_fake_idol')
    expect(matchBreakdownLabel('Torch Snuffed Due to Blindside', 10)?.code).toBe('wc_blindside')
  })
})
