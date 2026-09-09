import { describe, expect, it } from 'vitest'
import {
  canFitDistribution,
  evaluateManualPicks,
  parseManualDistribution,
  type ManualDistribution,
  type PickCandidate,
} from './quotas'

const dist: ManualDistribution = {
  perTribe: 3,
  tribeCount: 3,
  manualDistribution: [3, 3, 2],
}

function pick(id: string, tribe: string): PickCandidate {
  return {
    castawayId: id,
    seasonId: 'season-51',
    originalTribeId: tribe,
    status: 'active',
  }
}

describe('parseManualDistribution', () => {
  it('reads snake_case rule-set JSON', () => {
    expect(
      parseManualDistribution({
        per_tribe: 3,
        tribe_count: 3,
        manual_distribution: [3, 3, 2],
      }),
    ).toEqual(dist)
  })
})

describe('canFitDistribution', () => {
  it('allows 3/3/2 and its prefixes', () => {
    expect(canFitDistribution([3, 3, 2], dist)).toBe(true)
    expect(canFitDistribution([3, 2, 2], dist)).toBe(true)
    expect(canFitDistribution([3, 3], dist)).toBe(true)
    expect(canFitDistribution([2, 2, 2], dist)).toBe(true)
    expect(canFitDistribution([], dist)).toBe(true)
  })

  it('rejects 3/3/3 and 4-from-one-tribe', () => {
    expect(canFitDistribution([3, 3, 3], dist)).toBe(false)
    expect(canFitDistribution([4, 2, 1], dist)).toBe(false)
  })
})

describe('evaluateManualPicks', () => {
  it('accepts a complete 3/3/2 set and names the underfilled tribe', () => {
    const picks = [
      ...['a1', 'a2', 'a3'].map((id) => pick(id, 'alpha')),
      ...['b1', 'b2', 'b3'].map((id) => pick(id, 'bravo')),
      ...['c1', 'c2'].map((id) => pick(id, 'charlie')),
    ]
    const result = evaluateManualPicks(picks, 'season-51', dist)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.complete).toBe(true)
    expect(result.underfilledTribeId).toBe('charlie')
  })

  it('rejects duplicates, inactive, missing tribe, and wrong season', () => {
    expect(evaluateManualPicks([pick('a1', 'alpha'), pick('a1', 'alpha')], 'season-51', dist).ok).toBe(
      false,
    )
    expect(
      evaluateManualPicks(
        [{ ...pick('a1', 'alpha'), status: 'eliminated' }],
        'season-51',
        dist,
      ).ok,
    ).toBe(false)
    expect(
      evaluateManualPicks([{ ...pick('a1', 'alpha'), originalTribeId: null }], 'season-51', dist)
        .ok,
    ).toBe(false)
    expect(evaluateManualPicks([pick('a1', 'alpha')], 'other-season', dist).ok).toBe(false)
  })

  it('rejects a ninth manual pick', () => {
    const picks = [
      ...['a1', 'a2', 'a3'].map((id) => pick(id, 'alpha')),
      ...['b1', 'b2', 'b3'].map((id) => pick(id, 'bravo')),
      ...['c1', 'c2', 'c3'].map((id) => pick(id, 'charlie')),
    ]
    const result = evaluateManualPicks(picks, 'season-51', dist)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('too_many')
  })
})
