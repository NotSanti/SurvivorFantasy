import { compareStandingKeys, rankDelta, rankWithTies } from './rank'
import { cumulativeThrough, pointsOnEpisode } from './totals'
import type { LeagueMember, MemberEpisodePoints, StandingRow } from './types'

export function buildStandings(input: {
  members: LeagueMember[]
  episodePoints: MemberEpisodePoints[]
  latestEpisode: number | null
  previousEpisode: number | null
}): StandingRow[] {
  const withTotals = input.members.map((member) => ({
    ...member,
    totalPoints:
      input.latestEpisode == null
        ? 0
        : cumulativeThrough(
            input.episodePoints,
            member.leagueId,
            member.memberId,
            input.latestEpisode,
          ),
    weeklyPoints:
      input.latestEpisode == null
        ? 0
        : pointsOnEpisode(
            input.episodePoints,
            member.leagueId,
            member.memberId,
            input.latestEpisode,
          ),
  }))

  const ranks = rankWithTies(withTotals)
  const previousTotals =
    input.previousEpisode == null
      ? null
      : input.members.map((member) => ({
          ...member,
          totalPoints: cumulativeThrough(
            input.episodePoints,
            member.leagueId,
            member.memberId,
            input.previousEpisode!,
          ),
        }))
  const previousRanks = previousTotals ? rankWithTies(previousTotals) : null

  return withTotals
    .map((row, index) => {
      const previousRank = previousRanks ? previousRanks[index] : null
      return {
        leagueId: row.leagueId,
        memberId: row.memberId,
        displayName: row.displayName,
        fantasyTribeColor: row.fantasyTribeColor,
        totalPoints: row.totalPoints,
        weeklyPoints: row.weeklyPoints,
        rank: ranks[index],
        previousRank,
        rankDelta: rankDelta(ranks[index], previousRank),
      }
    })
    .sort(compareStandingKeys)
}

export function lastUpdatedLabel(publishedAt: string | null | undefined): string | null {
  if (!publishedAt) return null
  const date = new Date(publishedAt)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString()
}
