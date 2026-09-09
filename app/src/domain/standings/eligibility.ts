import type { RosterSlice } from './types'

/** A roster entry scores an episode when it covers that episode number, inclusive. */
export function isRosterEligible(entry: RosterSlice, episodeNumber: number): boolean {
  if (episodeNumber < entry.startsEpisode) return false
  if (entry.endsEpisode == null) return true
  return episodeNumber <= entry.endsEpisode
}

export function isCorrectedRevision(revision: number): boolean {
  return revision > 1
}
