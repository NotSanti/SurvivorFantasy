import { describe, expect, it } from 'vitest'
import {
  claimCountsByCastaway,
  draftCurrentMemberId,
  draftCurrentTribeId,
  draftPickNumber,
  draftRoundNumber,
  isCastawayClaimedOut,
  isDraftRoundBoundary,
  MAX_CASTAWAY_CLAIMS,
} from '@/domain/draft/turn'

describe('draft turn helpers', () => {
  const order = ['a', 'b', 'c']
  const tribes = ['yellow', 'purple']

  it('rotates members by pick index', () => {
    expect(draftCurrentMemberId(order, 0)).toBe('a')
    expect(draftCurrentMemberId(order, 1)).toBe('b')
    expect(draftCurrentMemberId(order, 2)).toBe('c')
    expect(draftCurrentMemberId(order, 3)).toBe('a')
  })

  it('switches tribe after each full pass', () => {
    expect(draftCurrentTribeId(tribes, order, 0)).toBe('yellow')
    expect(draftCurrentTribeId(tribes, order, 2)).toBe('yellow')
    expect(draftCurrentTribeId(tribes, order, 3)).toBe('purple')
    expect(draftCurrentTribeId(tribes, order, 5)).toBe('purple')
    expect(draftCurrentTribeId(tribes, order, 6)).toBe('yellow')
  })

  it('detects round boundaries after each full member pass', () => {
    expect(isDraftRoundBoundary(order, 0)).toBe(false)
    expect(isDraftRoundBoundary(order, 1)).toBe(false)
    expect(isDraftRoundBoundary(order, 2)).toBe(false)
    expect(isDraftRoundBoundary(order, 3)).toBe(true)
    expect(isDraftRoundBoundary(order, 6)).toBe(true)
  })

  it('numbers rounds from the current pick index', () => {
    expect(draftRoundNumber(order, 0)).toBe(1)
    expect(draftRoundNumber(order, 2)).toBe(1)
    expect(draftRoundNumber(order, 3)).toBe(2)
    expect(draftRoundNumber(order, 5)).toBe(2)
    expect(draftRoundNumber(order, 6)).toBe(3)
  })

  it('returns 1-based pick number for a member', () => {
    expect(draftPickNumber(order, 'b')).toBe(2)
    expect(draftPickNumber(order, 'z')).toBeNull()
  })

  it('caps castaway claims at two', () => {
    const counts = claimCountsByCastaway([
      { castaway_id: 'x', ends_episode: null },
      { castaway_id: 'x', ends_episode: null },
      { castaway_id: 'y', ends_episode: null },
      { castaway_id: 'x', ends_episode: 3 },
    ])
    expect(counts.x).toBe(2)
    expect(counts.y).toBe(1)
    expect(isCastawayClaimedOut(counts.x)).toBe(true)
    expect(isCastawayClaimedOut(counts.y)).toBe(false)
    expect(MAX_CASTAWAY_CLAIMS).toBe(2)
  })
})
