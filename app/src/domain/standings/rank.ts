/**
 * SQL RANK() semantics: tied totals share a rank, and the next rank skips.
 * Display order is total desc, then display name, then member id — ties are not broken
 * into a winner.
 */
export function rankWithTies(
  rows: Array<{ totalPoints: number; displayName: string; memberId: string }>,
): number[] {
  const sortedIndexes = rows
    .map((_, index) => index)
    .sort((a, b) => compareStandingKeys(rows[a], rows[b]))

  const ranks = Array.from({ length: rows.length }, () => 0)
  let position = 0
  while (position < sortedIndexes.length) {
    const start = position
    const current = rows[sortedIndexes[start]]
    position += 1
    while (
      position < sortedIndexes.length &&
      rows[sortedIndexes[position]].totalPoints === current.totalPoints
    ) {
      position += 1
    }
    const rank = start + 1
    for (let i = start; i < position; i += 1) {
      ranks[sortedIndexes[i]] = rank
    }
  }
  return ranks
}

export function compareStandingKeys(
  a: { totalPoints: number; displayName: string; memberId: string },
  b: { totalPoints: number; displayName: string; memberId: string },
): number {
  if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
  const name = a.displayName.localeCompare(b.displayName)
  if (name !== 0) return name
  return a.memberId.localeCompare(b.memberId)
}

export function rankDelta(currentRank: number, previousRank: number | null): number | null {
  if (previousRank == null) return null
  return previousRank - currentRank
}
