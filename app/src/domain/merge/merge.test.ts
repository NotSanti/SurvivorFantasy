import { describe, expect, it } from 'vitest'
import { evaluateMergeMove } from './evaluate'
import { aliveRosterCount, decideMergeMoveType, effectiveEpisodeAfterMerge } from './rules'
import type { MergeCastaway, MergeRosterEntry } from './types'

const member = 'cam'
const mergeEpisode = 8

function person(
  id: string,
  status: MergeCastaway['status'] = 'active',
  eliminatedEpisodeNumber: number | null = null,
): MergeCastaway {
  return { id, status, eliminatedEpisodeNumber }
}

function entry(
  id: string,
  castawayId: string,
  ends: number | null = null,
): MergeRosterEntry {
  return { id, memberId: member, castawayId, startsEpisode: 2, endsEpisode: ends }
}

const nine = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']

describe('effectiveEpisodeAfterMerge', () => {
  it('starts scoring the episode after merge, never the merge itself', () => {
    expect(effectiveEpisodeAfterMerge(8)).toBe(9)
  })
})

describe('decideMergeMoveType', () => {
  it('adds below capacity and swaps at capacity', () => {
    expect(decideMergeMoveType(8, 9)).toBe('add')
    expect(decideMergeMoveType(9, 9)).toBe('swap')
    expect(decideMergeMoveType(10, 9)).toBeNull()
  })
})

describe('aliveRosterCount', () => {
  it('treats eliminated picks as holes and keeps historical closed rows out of the count', () => {
    const roster = [
      ...nine.map((id) => entry(`r-${id}`, id)),
      entry('old', 'z', 5),
    ]
    const castaways = [
      ...nine.map((id) => person(id)),
      person('z', 'eliminated', 5),
    ]
    expect(aliveRosterCount(roster, castaways, member, mergeEpisode)).toBe(9)
    const withBoot = castaways.map((row) =>
      row.id === 'a' ? person('a', 'eliminated', 6) : row,
    )
    expect(aliveRosterCount(roster, withBoot, member, mergeEpisode)).toBe(8)
  })
})

describe('evaluateMergeMove', () => {
  const roster = nine.map((id) => entry(`r-${id}`, id))
  const alive = nine.map((id) => person(id))

  it('rejects moves before the merge episode is confirmed', () => {
    const result = evaluateMergeMove({
      leagueStatus: 'merge_window',
      mergeEpisode: null,
      alreadyMoved: false,
      rosterSize: 9,
      memberId: member,
      roster,
      castaways: [...alive, person('new')],
      incomingId: 'new',
      outgoingEntryId: 'r-a',
    })
    expect(result).toEqual({ ok: false, code: 'merge_not_confirmed' })
  })

  it('rejects early access and repeat moves', () => {
    expect(
      evaluateMergeMove({
        leagueStatus: 'locked',
        mergeEpisode,
        alreadyMoved: false,
        rosterSize: 9,
        memberId: member,
        roster,
        castaways: [...alive, person('new')],
        incomingId: 'new',
        outgoingEntryId: 'r-a',
      }).ok,
    ).toBe(false)
    expect(
      evaluateMergeMove({
        leagueStatus: 'merge_window',
        mergeEpisode,
        alreadyMoved: true,
        rosterSize: 9,
        memberId: member,
        roster,
        castaways: [...alive, person('new')],
        incomingId: 'new',
        outgoingEntryId: 'r-a',
      }),
    ).toEqual({ ok: false, code: 'already_moved' })
  })

  it('requires a swap when nine are still alive', () => {
    const missingOut = evaluateMergeMove({
      leagueStatus: 'merge_window',
      mergeEpisode,
      alreadyMoved: false,
      rosterSize: 9,
      memberId: member,
      roster,
      castaways: [...alive, person('new')],
      incomingId: 'new',
      outgoingEntryId: null,
    })
    expect(missingOut).toEqual({ ok: false, code: 'swap_required' })

    const ok = evaluateMergeMove({
      leagueStatus: 'merge_window',
      mergeEpisode,
      alreadyMoved: false,
      rosterSize: 9,
      memberId: member,
      roster,
      castaways: [...alive, person('new')],
      incomingId: 'new',
      outgoingEntryId: 'r-a',
    })
    expect(ok).toEqual({
      ok: true,
      moveType: 'swap',
      aliveCount: 9,
      effectiveEpisode: 9,
    })
  })

  it('requires an add when a pick is already out, and keeps the old row eligible through merge', () => {
    const booted = alive.map((row) => (row.id === 'a' ? person('a', 'eliminated', 6) : row))
    const add = evaluateMergeMove({
      leagueStatus: 'merge_window',
      mergeEpisode,
      alreadyMoved: false,
      rosterSize: 9,
      memberId: member,
      roster,
      castaways: [...booted, person('new')],
      incomingId: 'new',
      outgoingEntryId: null,
    })
    expect(add).toEqual({
      ok: true,
      moveType: 'add',
      aliveCount: 8,
      effectiveEpisode: 9,
    })
  })

  it('rejects incoming people who are eliminated or already owned', () => {
    expect(
      evaluateMergeMove({
        leagueStatus: 'merge_window',
        mergeEpisode,
        alreadyMoved: false,
        rosterSize: 9,
        memberId: member,
        roster: nine.slice(0, 8).map((id) => entry(`r-${id}`, id)),
        castaways: [...nine.slice(0, 8).map((id) => person(id)), person('dead', 'eliminated', 4)],
        incomingId: 'dead',
        outgoingEntryId: null,
      }),
    ).toEqual({ ok: false, code: 'invalid_incoming' })
    expect(
      evaluateMergeMove({
        leagueStatus: 'merge_window',
        mergeEpisode,
        alreadyMoved: false,
        rosterSize: 9,
        memberId: member,
        roster,
        castaways: alive,
        incomingId: 'a',
        outgoingEntryId: 'r-b',
      }),
    ).toEqual({ ok: false, code: 'already_on_roster' })
  })
})
