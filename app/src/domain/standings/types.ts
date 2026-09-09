export type RosterSlice = {
  leagueId: string
  memberId: string
  castawayId: string
  startsEpisode: number
  endsEpisode: number | null
}

export type PublishedCastawayScore = {
  seasonId: string
  episodeNumber: number
  castawayId: string
  points: number
  revision: number
}

export type MemberEpisodePoints = {
  leagueId: string
  memberId: string
  episodeNumber: number
  points: number
}

export type LeagueMember = {
  leagueId: string
  memberId: string
  displayName: string
}

export type MvpSelection = {
  leagueId: string
  memberId: string
  castawayId: string
}

export type StandingRow = {
  leagueId: string
  memberId: string
  displayName: string
  totalPoints: number
  weeklyPoints: number
  rank: number
  previousRank: number | null
  rankDelta: number | null
}

export type SpoilerMode = 'show' | 'hide_latest_episode'
