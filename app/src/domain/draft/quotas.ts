export type ManualDistribution = {
  perTribe: number
  tribeCount: number
  manualDistribution: number[]
}

export type PickCandidate = {
  castawayId: string
  seasonId: string
  originalTribeId: string | null
  status: 'active' | 'eliminated' | 'withdrawn'
}

export type QuotaFailure =
  | 'duplicate'
  | 'wrong_season'
  | 'missing_tribe'
  | 'inactive'
  | 'too_many'
  | 'quota'

export type QuotaResult =
  | {
      ok: true
      total: number
      complete: boolean
      countsByTribe: Record<string, number>
      underfilledTribeId: string | null
    }
  | {
      ok: false
      code: QuotaFailure
      total: number
      countsByTribe: Record<string, number>
      underfilledTribeId: null
    }

export function parseManualDistribution(value: unknown): ManualDistribution | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const perTribe = Number(record.per_tribe ?? record.perTribe)
  const tribeCount = Number(record.tribe_count ?? record.tribeCount)
  const raw = record.manual_distribution ?? record.manualDistribution
  if (!Array.isArray(raw) || !Number.isInteger(perTribe) || !Number.isInteger(tribeCount)) {
    return null
  }
  const manualDistribution = raw.map((entry) => Number(entry))
  if (manualDistribution.some((entry) => !Number.isInteger(entry) || entry < 0)) return null
  if (perTribe <= 0 || tribeCount <= 0) return null
  return { perTribe, tribeCount, manualDistribution }
}

export function manualSlotCount(distribution: ManualDistribution): number {
  return distribution.manualDistribution.reduce((sum, value) => sum + value, 0)
}

export function canFitDistribution(counts: number[], distribution: ManualDistribution): boolean {
  const padded = [...counts].sort((left, right) => right - left)
  while (padded.length < distribution.tribeCount) padded.push(0)
  if (padded.length > distribution.tribeCount) return false
  const target = [...distribution.manualDistribution].sort((left, right) => right - left)
  while (target.length < distribution.tribeCount) target.push(0)
  return padded.every((count, index) => count <= target[index])
}

export function evaluateManualPicks(
  picks: PickCandidate[],
  leagueSeasonId: string,
  distribution: ManualDistribution,
): QuotaResult {
  const countsByTribe: Record<string, number> = {}
  const seen = new Set<string>()
  const empty = {
    total: picks.length,
    countsByTribe,
    underfilledTribeId: null as null,
  }

  if (picks.length > manualSlotCount(distribution)) {
    return { ok: false, code: 'too_many', ...empty }
  }

  for (const pick of picks) {
    if (seen.has(pick.castawayId)) {
      return { ok: false, code: 'duplicate', ...empty }
    }
    seen.add(pick.castawayId)
    if (pick.seasonId !== leagueSeasonId) {
      return { ok: false, code: 'wrong_season', ...empty }
    }
    if (pick.status !== 'active') {
      return { ok: false, code: 'inactive', ...empty }
    }
    if (!pick.originalTribeId) {
      return { ok: false, code: 'missing_tribe', ...empty }
    }
    countsByTribe[pick.originalTribeId] = (countsByTribe[pick.originalTribeId] ?? 0) + 1
  }

  const counts = Object.values(countsByTribe)
  if (!canFitDistribution(counts, distribution)) {
    return { ok: false, code: 'quota', total: picks.length, countsByTribe, underfilledTribeId: null }
  }

  const complete = picks.length === manualSlotCount(distribution)
  let underfilledTribeId: string | null = null
  if (complete) {
    const minCount = Math.min(...Object.values(countsByTribe))
    const underfilled = Object.entries(countsByTribe).filter(([, count]) => count === minCount)
    underfilledTribeId = underfilled.length === 1 ? underfilled[0][0] : null
  }

  return {
    ok: true,
    total: picks.length,
    complete,
    countsByTribe,
    underfilledTribeId,
  }
}
