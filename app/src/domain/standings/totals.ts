import { isRosterEligible } from './eligibility'
import type {
  MemberEpisodePoints,
  MvpSelection,
  PublishedCastawayScore,
  RosterSlice,
} from './types'

export function importedPointsForMemberEpisode(
  roster: RosterSlice[],
  scores: PublishedCastawayScore[],
  leagueId: string,
  memberId: string,
  episodeNumber: number,
): number {
  const owned = roster.filter(
    (entry) =>
      entry.leagueId === leagueId &&
      entry.memberId === memberId &&
      isRosterEligible(entry, episodeNumber),
  )
  const ownedIds = new Set(owned.map((entry) => entry.castawayId))
  return scores
    .filter((score) => score.episodeNumber === episodeNumber && ownedIds.has(score.castawayId))
    .reduce((sum, score) => sum + score.points, 0)
}

/** Extra fantasy MVP points. Applied only on the finale, only to the owner, only when that castaway is the published winner. */
export function mvpBonusForEpisode(input: {
  mvps: MvpSelection[]
  winnerCastawayId: string | null
  finaleEpisodeNumber: number | null
  leagueId: string
  memberId: string
  episodeNumber: number
  bonusPoints: number
}): number {
  if (!input.winnerCastawayId || input.finaleEpisodeNumber == null) return 0
  if (input.episodeNumber !== input.finaleEpisodeNumber) return 0
  const pick = input.mvps.find(
    (mvp) => mvp.leagueId === input.leagueId && mvp.memberId === input.memberId,
  )
  if (!pick || pick.castawayId !== input.winnerCastawayId) return 0
  return input.bonusPoints
}

export function memberEpisodeTotals(input: {
  roster: RosterSlice[]
  scores: PublishedCastawayScore[]
  mvps: MvpSelection[]
  members: Array<{ leagueId: string; memberId: string }>
  winnerCastawayId: string | null
  finaleEpisodeNumber: number | null
  bonusPoints: number
  episodeNumbers: number[]
}): MemberEpisodePoints[] {
  const rows: MemberEpisodePoints[] = []
  for (const member of input.members) {
    for (const episodeNumber of input.episodeNumbers) {
      const imported = importedPointsForMemberEpisode(
        input.roster,
        input.scores,
        member.leagueId,
        member.memberId,
        episodeNumber,
      )
      const bonus = mvpBonusForEpisode({
        mvps: input.mvps,
        winnerCastawayId: input.winnerCastawayId,
        finaleEpisodeNumber: input.finaleEpisodeNumber,
        leagueId: member.leagueId,
        memberId: member.memberId,
        episodeNumber,
        bonusPoints: input.bonusPoints,
      })
      const points = imported + bonus
      if (points === 0) continue
      rows.push({
        leagueId: member.leagueId,
        memberId: member.memberId,
        episodeNumber,
        points,
      })
    }
  }
  return rows
}

export function cumulativeThrough(
  rows: MemberEpisodePoints[],
  leagueId: string,
  memberId: string,
  throughEpisode: number,
): number {
  return rows
    .filter(
      (row) =>
        row.leagueId === leagueId &&
        row.memberId === memberId &&
        row.episodeNumber <= throughEpisode,
    )
    .reduce((sum, row) => sum + row.points, 0)
}

export function pointsOnEpisode(
  rows: MemberEpisodePoints[],
  leagueId: string,
  memberId: string,
  episodeNumber: number,
): number {
  return rows
    .filter(
      (row) =>
        row.leagueId === leagueId &&
        row.memberId === memberId &&
        row.episodeNumber === episodeNumber,
    )
    .reduce((sum, row) => sum + row.points, 0)
}

export function correctionDelta(previousPoints: number | null, currentPoints: number): number | null {
  if (previousPoints == null) return null
  return currentPoints - previousPoints
}
