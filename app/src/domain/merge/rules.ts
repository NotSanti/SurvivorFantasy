import type { MergeCastaway, MergeRosterEntry } from './types'

export function effectiveEpisodeAfterMerge(mergeEpisode: number): number {
  return mergeEpisode + 1
}

export function isAliveAtEpisode(castaway: MergeCastaway, episodeNumber: number): boolean {
  if (castaway.eliminatedEpisodeNumber != null && castaway.eliminatedEpisodeNumber <= episodeNumber) {
    return false
  }
  return castaway.status === 'active'
}

export function coversEpisode(entry: MergeRosterEntry, episodeNumber: number): boolean {
  if (episodeNumber < entry.startsEpisode) return false
  if (entry.endsEpisode == null) return true
  return episodeNumber <= entry.endsEpisode
}

export function aliveRosterCount(
  roster: MergeRosterEntry[],
  castaways: MergeCastaway[],
  memberId: string,
  asOfEpisode: number,
): number {
  const byId = new Map(castaways.map((castaway) => [castaway.id, castaway]))
  return roster.filter((entry) => {
    if (entry.memberId !== memberId) return false
    if (!coversEpisode(entry, asOfEpisode)) return false
    const castaway = byId.get(entry.castawayId)
    return Boolean(castaway && isAliveAtEpisode(castaway, asOfEpisode))
  }).length
}

export function decideMergeMoveType(
  aliveCount: number,
  rosterSize: number,
): 'add' | 'swap' | null {
  if (rosterSize <= 0) return null
  if (aliveCount < rosterSize) return 'add'
  if (aliveCount === rosterSize) return 'swap'
  return null
}
