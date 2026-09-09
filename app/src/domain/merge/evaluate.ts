import { aliveRosterCount, decideMergeMoveType, effectiveEpisodeAfterMerge, isAliveAtEpisode } from './rules'
import type {
  MergeCastaway,
  MergeDecision,
  MergeFailureReason,
  MergeRosterEntry,
} from './types'

export function evaluateMergeMove(input: {
  leagueStatus: string
  mergeEpisode: number | null
  alreadyMoved: boolean
  rosterSize: number
  memberId: string
  roster: MergeRosterEntry[]
  castaways: MergeCastaway[]
  incomingId: string
  outgoingEntryId: string | null
}): MergeDecision {
  if (!input.mergeEpisode) {
    return { ok: false, code: 'merge_not_confirmed' }
  }
  if (input.leagueStatus === 'active_post_merge' || input.leagueStatus === 'finished') {
    return { ok: false, code: 'window_closed' }
  }
  if (input.leagueStatus !== 'merge_window') {
    return { ok: false, code: 'early' }
  }
  if (input.alreadyMoved) return { ok: false, code: 'already_moved' }

  const aliveCount = aliveRosterCount(
    input.roster,
    input.castaways,
    input.memberId,
    input.mergeEpisode,
  )
  const moveType = decideMergeMoveType(aliveCount, input.rosterSize)
  if (!moveType) return { ok: false, code: 'capacity' }

  const incoming = input.castaways.find((castaway) => castaway.id === input.incomingId)
  if (!incoming || !isAliveAtEpisode(incoming, input.mergeEpisode)) {
    return { ok: false, code: 'invalid_incoming' }
  }

  const alreadyOwned = input.roster.some(
    (entry) =>
      entry.memberId === input.memberId &&
      entry.castawayId === input.incomingId &&
      entry.endsEpisode == null,
  )
  if (alreadyOwned) return { ok: false, code: 'already_on_roster' }

  if (moveType === 'add') {
    if (input.outgoingEntryId) return { ok: false, code: 'add_required' }
    return {
      ok: true,
      moveType: 'add',
      aliveCount,
      effectiveEpisode: effectiveEpisodeAfterMerge(input.mergeEpisode),
    }
  }

  if (!input.outgoingEntryId) return { ok: false, code: 'swap_required' }
  const outgoing = input.roster.find(
    (entry) =>
      entry.id === input.outgoingEntryId &&
      entry.memberId === input.memberId &&
      entry.endsEpisode == null,
  )
  if (!outgoing || outgoing.castawayId === input.incomingId) {
    return { ok: false, code: 'invalid_outgoing' }
  }
  return {
    ok: true,
    moveType: 'swap',
    aliveCount,
    effectiveEpisode: effectiveEpisodeAfterMerge(input.mergeEpisode),
  }
}

export function classifyMergeError(message: string | null | undefined): MergeFailureReason | 'unknown' {
  const text = (message ?? '').toLowerCase()
  if (!text) return 'unknown'
  if (text.includes('not confirmed') || text.includes('merge episode')) return 'merge_not_confirmed'
  if (text.includes('already') && text.includes('move')) return 'already_moved'
  if (text.includes('merge window') || text.includes('not open')) return 'early'
  if (text.includes('closed') || text.includes('post-merge') || text.includes('post merge')) {
    return 'window_closed'
  }
  if (text.includes('already on')) return 'already_on_roster'
  if (text.includes('not eligible') || text.includes('invalid incoming')) return 'invalid_incoming'
  if (text.includes('must add') || text.includes('addition')) return 'add_required'
  if (text.includes('must swap') || text.includes('swap one')) return 'swap_required'
  if (text.includes('outgoing') || text.includes('swap out')) return 'invalid_outgoing'
  if (text.includes('capacity') || text.includes('more than')) return 'capacity'
  return 'unknown'
}

export function mergeErrorCopy(reason: MergeFailureReason | 'unknown'): string {
  switch (reason) {
    case 'merge_not_confirmed':
      return 'The merge window opens only after the merge episode is confirmed. We will not guess it.'
    case 'early':
      return 'The merge move is not open for this league yet.'
    case 'window_closed':
      return 'The merge window is closed. New picks start after the merge episode and cannot be changed now.'
    case 'already_moved':
      return 'This camp already used its one merge move.'
    case 'invalid_incoming':
      return 'That castaway is not eligible to join your roster.'
    case 'already_on_roster':
      return 'That castaway is already on this roster.'
    case 'add_required':
      return 'Your camp has a free slot, so this move must be an add, not a swap.'
    case 'swap_required':
      return 'All nine are still active, so you must swap one pick.'
    case 'invalid_outgoing':
      return 'Choose one current roster entry to swap out.'
    case 'capacity':
      return 'A roster cannot go over the configured maximum.'
    default:
      return 'That merge move could not be saved.'
  }
}
