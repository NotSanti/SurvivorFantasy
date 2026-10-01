export const MAX_CASTAWAY_CLAIMS = 2

export type DraftPhase = 'revealing' | 'picking' | 'mvp' | 'locked'

export type DraftSessionState = {
  pickOrder: string[]
  tribeOrder: string[]
  currentPickIndex: number
  draftPhase: DraftPhase
  orderSeed: string | null
}

export function draftMemberCount(pickOrder: string[]): number {
  return pickOrder.length
}

export function draftCurrentMemberId(
  pickOrder: string[],
  currentPickIndex: number,
): string | null {
  const n = pickOrder.length
  if (n === 0) return null
  return pickOrder[((currentPickIndex % n) + n) % n] ?? null
}

export function draftCurrentTribeId(
  tribeOrder: string[],
  pickOrder: string[],
  currentPickIndex: number,
): string | null {
  const n = pickOrder.length
  const t = tribeOrder.length
  if (n === 0 || t === 0) return null
  const pass = Math.floor(currentPickIndex / n)
  return tribeOrder[((pass % t) + t) % t] ?? null
}

/** True when the next pick starts a new member pass (round boundary after index advances). */
export function isDraftRoundBoundary(pickOrder: string[], currentPickIndex: number): boolean {
  const n = pickOrder.length
  return n > 0 && currentPickIndex > 0 && currentPickIndex % n === 0
}

/** 1-based round number for the pick about to happen at currentPickIndex. */
export function draftRoundNumber(pickOrder: string[], currentPickIndex: number): number {
  const n = pickOrder.length
  if (n === 0) return 1
  return Math.floor(currentPickIndex / n) + 1
}

export function draftPickNumber(pickOrder: string[], userId: string): number | null {
  const index = pickOrder.indexOf(userId)
  return index >= 0 ? index + 1 : null
}

export function claimCountsByCastaway(
  roster: Array<{ castaway_id: string; ends_episode: number | null }>,
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const row of roster) {
    if (row.ends_episode != null) continue
    counts[row.castaway_id] = (counts[row.castaway_id] ?? 0) + 1
  }
  return counts
}

export function isCastawayClaimedOut(claimCount: number): boolean {
  return claimCount >= MAX_CASTAWAY_CLAIMS
}

export function parseDraftSession(row: {
  pick_order: string[] | null
  tribe_order: string[] | null
  current_pick_index: number | null
  draft_phase: string | null
  order_seed: string | null
}): DraftSessionState {
  const phase = row.draft_phase
  const draftPhase: DraftPhase =
    phase === 'picking' || phase === 'mvp' || phase === 'locked' || phase === 'revealing'
      ? phase
      : 'revealing'
  return {
    pickOrder: row.pick_order ?? [],
    tribeOrder: row.tribe_order ?? [],
    currentPickIndex: row.current_pick_index ?? 0,
    draftPhase,
    orderSeed: row.order_seed,
  }
}
