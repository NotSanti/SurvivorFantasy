export type MergeCastaway = {
  id: string
  status: 'active' | 'eliminated' | 'withdrawn'
  eliminatedEpisodeNumber: number | null
}

export type MergeRosterEntry = {
  id: string
  memberId: string
  castawayId: string
  startsEpisode: number
  endsEpisode: number | null
}

export type MergeMoveType = 'add' | 'swap'

export type MergeDecision =
  | { ok: true; moveType: MergeMoveType; aliveCount: number; effectiveEpisode: number }
  | { ok: false; code: MergeFailureReason }

export type MergeFailureReason =
  | 'window_closed'
  | 'merge_not_confirmed'
  | 'already_moved'
  | 'early'
  | 'invalid_incoming'
  | 'already_on_roster'
  | 'swap_required'
  | 'add_required'
  | 'invalid_outgoing'
  | 'capacity'
