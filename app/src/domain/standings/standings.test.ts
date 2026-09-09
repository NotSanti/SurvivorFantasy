import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { buildStandings } from './build-standings'
import { isCorrectedRevision, isRosterEligible } from './eligibility'
import { leagueNextAction } from './next-action'
import { invalidateLeagueScoreQueries } from './query-keys'
import { rankWithTies } from './rank'
import {
  correctionDelta,
  importedPointsForMemberEpisode,
  memberEpisodeTotals,
  mvpBonusForEpisode,
} from './totals'
import type { LeagueMember, MvpSelection, PublishedCastawayScore, RosterSlice } from './types'

const leagueA = 'league-a'
const leagueB = 'league-b'
const cam = 'cam'
const river = 'river'
const ness = 'ness'

const members: LeagueMember[] = [
  { leagueId: leagueA, memberId: cam, displayName: 'Camp Cam' },
  { leagueId: leagueA, memberId: river, displayName: 'River' },
  { leagueId: leagueA, memberId: ness, displayName: 'Ness' },
]

function entry(
  memberId: string,
  castawayId: string,
  starts: number,
  ends: number | null = null,
  leagueId = leagueA,
): RosterSlice {
  return { leagueId, memberId, castawayId, startsEpisode: starts, endsEpisode: ends }
}

function score(
  episodeNumber: number,
  castawayId: string,
  points: number,
  revision = 1,
): PublishedCastawayScore {
  return { seasonId: 's51', episodeNumber, castawayId, points, revision }
}

describe('isRosterEligible', () => {
  it('counts only episodes inside starts/ends inclusive', () => {
    const swapped = entry(cam, 'alexis', 2, 4)
    expect(isRosterEligible(swapped, 1)).toBe(false)
    expect(isRosterEligible(swapped, 2)).toBe(true)
    expect(isRosterEligible(swapped, 4)).toBe(true)
    expect(isRosterEligible(swapped, 5)).toBe(false)
  })
})

describe('importedPointsForMemberEpisode', () => {
  it('keeps swapped-out history only on eligible episodes', () => {
    const roster = [
      entry(cam, 'alexis', 2, 4),
      entry(cam, 'brady', 5, null),
    ]
    const scores = [
      score(3, 'alexis', 4),
      score(5, 'alexis', 9),
      score(5, 'brady', 2),
    ]
    expect(importedPointsForMemberEpisode(roster, scores, leagueA, cam, 3)).toBe(4)
    expect(importedPointsForMemberEpisode(roster, scores, leagueA, cam, 5)).toBe(2)
  })
})

describe('mvpBonusForEpisode', () => {
  const mvps: MvpSelection[] = [{ leagueId: leagueA, memberId: cam, castawayId: 'ori' }]

  it('adds the bonus only to the owner on the finale when that castaway won', () => {
    expect(
      mvpBonusForEpisode({
        mvps,
        winnerCastawayId: 'ori',
        finaleEpisodeNumber: 13,
        leagueId: leagueA,
        memberId: cam,
        episodeNumber: 13,
        bonusPoints: 30,
      }),
    ).toBe(30)
    expect(
      mvpBonusForEpisode({
        mvps,
        winnerCastawayId: 'ori',
        finaleEpisodeNumber: 13,
        leagueId: leagueA,
        memberId: river,
        episodeNumber: 13,
        bonusPoints: 30,
      }),
    ).toBe(0)
    expect(
      mvpBonusForEpisode({
        mvps,
        winnerCastawayId: 'ori',
        finaleEpisodeNumber: 13,
        leagueId: leagueA,
        memberId: cam,
        episodeNumber: 12,
        bonusPoints: 30,
      }),
    ).toBe(0)
  })

  it('adds nothing until a winner is published', () => {
    expect(
      mvpBonusForEpisode({
        mvps,
        winnerCastawayId: null,
        finaleEpisodeNumber: 13,
        leagueId: leagueA,
        memberId: cam,
        episodeNumber: 13,
        bonusPoints: 30,
      }),
    ).toBe(0)
  })
})

describe('rankWithTies', () => {
  it('shares a rank and uses name only for display order', () => {
    const ranks = rankWithTies([
      { totalPoints: 10, displayName: 'Zed', memberId: 'z' },
      { totalPoints: 12, displayName: 'Ann', memberId: 'a' },
      { totalPoints: 10, displayName: 'Bea', memberId: 'b' },
    ])
    expect(ranks).toEqual([2, 1, 2])
  })
})

describe('buildStandings', () => {
  it('matches a hand-calculated week and rank movement', () => {
    const episodePoints = memberEpisodeTotals({
      roster: [
        entry(cam, 'aaliyah', 2),
        entry(river, 'alexis', 2),
        entry(ness, 'ana', 2),
      ],
      scores: [
        score(2, 'aaliyah', 4),
        score(2, 'alexis', 4),
        score(2, 'ana', 1),
        score(3, 'aaliyah', 3),
        score(3, 'alexis', 1),
        score(3, 'ana', 6),
      ],
      mvps: [],
      members,
      winnerCastawayId: null,
      finaleEpisodeNumber: null,
      bonusPoints: 30,
      episodeNumbers: [2, 3],
    })

    const week2 = buildStandings({
      members,
      episodePoints,
      latestEpisode: 2,
      previousEpisode: null,
    })
    expect(week2.map((row) => ({ name: row.displayName, rank: row.rank, total: row.totalPoints }))).toEqual([
      { name: 'Camp Cam', rank: 1, total: 4 },
      { name: 'River', rank: 1, total: 4 },
      { name: 'Ness', rank: 3, total: 1 },
    ])

    const week3 = buildStandings({
      members,
      episodePoints,
      latestEpisode: 3,
      previousEpisode: 2,
    })
    expect(week3.map((row) => ({ name: row.displayName, rank: row.rank, delta: row.rankDelta, total: row.totalPoints, weekly: row.weeklyPoints }))).toEqual([
      { name: 'Camp Cam', rank: 1, delta: 0, total: 7, weekly: 3 },
      { name: 'Ness', rank: 1, delta: 2, total: 7, weekly: 6 },
      { name: 'River', rank: 3, delta: -2, total: 5, weekly: 1 },
    ])
  })

  it('applies a correction only to the affected episode', () => {
    const before = memberEpisodeTotals({
      roster: [entry(cam, 'aaliyah', 2), entry(river, 'alexis', 2)],
      scores: [score(2, 'aaliyah', 4), score(2, 'alexis', 4)],
      mvps: [],
      members: members.slice(0, 2),
      winnerCastawayId: null,
      finaleEpisodeNumber: null,
      bonusPoints: 30,
      episodeNumbers: [2],
    })
    const after = memberEpisodeTotals({
      roster: [entry(cam, 'aaliyah', 2), entry(river, 'alexis', 2)],
      scores: [score(2, 'aaliyah', 6, 2), score(2, 'alexis', 4, 1)],
      mvps: [],
      members: members.slice(0, 2),
      winnerCastawayId: null,
      finaleEpisodeNumber: null,
      bonusPoints: 30,
      episodeNumbers: [2],
    })
    expect(correctionDelta(before[0].points, after[0].points)).toBe(2)
    expect(after.find((row) => row.memberId === river)?.points).toBe(4)
    expect(isCorrectedRevision(2)).toBe(true)
  })

  it('isolates two leagues that share a castaway', () => {
    const rows = memberEpisodeTotals({
      roster: [entry(cam, 'aaliyah', 2, null, leagueA), entry(cam, 'aaliyah', 2, null, leagueB)],
      scores: [score(2, 'aaliyah', 5)],
      mvps: [],
      members: [
        { leagueId: leagueA, memberId: cam },
        { leagueId: leagueB, memberId: cam },
      ],
      winnerCastawayId: null,
      finaleEpisodeNumber: null,
      bonusPoints: 30,
      episodeNumbers: [2],
    })
    expect(rows).toEqual([
      { leagueId: leagueA, memberId: cam, episodeNumber: 2, points: 5 },
      { leagueId: leagueB, memberId: cam, episodeNumber: 2, points: 5 },
    ])
  })

  it('hides the latest episode in spoiler mode', () => {
    const episodePoints = memberEpisodeTotals({
      roster: [entry(cam, 'aaliyah', 2), entry(river, 'alexis', 2)],
      scores: [score(2, 'aaliyah', 4), score(2, 'alexis', 1), score(3, 'aaliyah', 10), score(3, 'alexis', 1)],
      mvps: [],
      members: members.slice(0, 2),
      winnerCastawayId: null,
      finaleEpisodeNumber: null,
      bonusPoints: 30,
      episodeNumbers: [2, 3],
    })
    const hidden = buildStandings({
      members: members.slice(0, 2),
      episodePoints,
      latestEpisode: 3,
      previousEpisode: 2,
      spoilerMode: 'hide_latest_episode',
    })
    expect(hidden[0]).toMatchObject({ displayName: 'Camp Cam', totalPoints: 4, weeklyPoints: 0 })
  })
})

describe('leagueNextAction', () => {
  it('routes selecting leagues to the draft room', () => {
    expect(
      leagueNextAction({
        leagueId: leagueA,
        status: 'selecting',
        hasPublishedScores: false,
        latestEpisode: null,
      }).to,
    ).toBe(`/leagues/${leagueA}/draft`)
  })

  it('routes merge-window leagues to the merge move', () => {
    expect(
      leagueNextAction({
        leagueId: leagueA,
        status: 'merge_window',
        hasPublishedScores: true,
        latestEpisode: 8,
      }).to,
    ).toBe('/league/merge')
  })
})

describe('invalidateLeagueScoreQueries', () => {
  it('invalidates scoped standings keys, not unrelated queries', () => {
    const client = new QueryClient()
    client.setQueryData(['league-standings', leagueA], { ok: true })
    client.setQueryData(['league-standings', leagueB], { keep: true })
    invalidateLeagueScoreQueries(client, leagueA, 's51')
    expect(client.getQueryState(['league-standings', leagueA])?.isInvalidated).toBe(true)
    expect(client.getQueryState(['league-standings', leagueB])?.isInvalidated).toBe(false)
  })
})
