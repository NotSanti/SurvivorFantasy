import { compareStandingKeys, rankDelta, rankWithTies } from './rank'
import { cumulativeThrough, pointsOnEpisode } from './totals'
import type { LeagueMember, MemberEpisodePoints, SpoilerMode, StandingRow } from './types'

export function buildStandings(input: {
  members: LeagueMember[]
  episodePoints: MemberEpisodePoints[]
  latestEpisode: number | null
  previousEpisode: number | null
  spoilerMode?: SpoilerMode
}): StandingRow[] {
  const hideLatest = input.spoilerMode === 'hide_latest_episode' && input.latestEpisode != null
  const totalThrough = hideLatest ? input.previousEpisode : input.latestEpisode
  const weeklyEpisode = hideLatest ? null : input.latestEpisode
  const previousThrough = hideLatest
    ? previousOf(input.previousEpisode)
    : input.previousEpisode

  const withTotals = input.members.map((member) => ({
    ...member,
    totalPoints:
      totalThrough == null
        ? 0
        : cumulativeThrough(input.episodePoints, member.leagueId, member.memberId, totalThrough),
    weeklyPoints:
      weeklyEpisode == null
        ? 0
        : pointsOnEpisode(input.episodePoints, member.leagueId, member.memberId, weeklyEpisode),
  }))

  const ranks = rankWithTies(withTotals)
  const previousTotals =
    previousThrough == null
      ? null
      : input.members.map((member) => ({
          ...member,
          totalPoints: cumulativeThrough(
            input.episodePoints,
            member.leagueId,
            member.memberId,
            previousThrough,
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
        totalPoints: row.totalPoints,
        weeklyPoints: row.weeklyPoints,
        rank: ranks[index],
        previousRank,
        rankDelta: rankDelta(ranks[index], previousRank),
      }
    })
    .sort(compareStandingKeys)
}

function previousOf(episode: number | null): number | null {
  if (episode == null || episode <= 1) return null
  return episode - 1
}

export function lastUpdatedLabel(publishedAt: string | null | undefined): string | null {
  if (!publishedAt) return null
  const date = new Date(publishedAt)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString()
}
