import { normalizeForMatch } from './normalize.ts'
import type { AliasRecord, ParsedEpisode, ResolvedScore } from './score-types.ts'

export function resolveEpisodeAliases(
  episode: ParsedEpisode,
  aliases: AliasRecord[],
):
  | { ok: true; scores: ResolvedScore[] }
  | { ok: false; code: 'unknown_names' | 'ambiguous_alias'; unknownNames: string[]; detail: string } {
  const byName = new Map<string, string[]>()
  for (const alias of aliases) {
    const key = normalizeForMatch(alias.normalizedSourceName)
    const ids = byName.get(key) ?? []
    ids.push(alias.castawayId)
    byName.set(key, ids)
  }

  const scores: ResolvedScore[] = []
  const unknown: string[] = []
  for (const row of episode.scores) {
    const ids = [...new Set(byName.get(normalizeForMatch(row.sourceName)) ?? [])]
    if (ids.length === 0) {
      unknown.push(row.sourceName)
      continue
    }
    if (ids.length > 1) {
      return {
        ok: false,
        code: 'ambiguous_alias',
        unknownNames: [row.sourceName],
        detail: `${row.sourceName} matches more than one castaway.`,
      }
    }
    scores.push({ sourceName: row.sourceName, castawayId: ids[0], points: row.points })
  }
  if (unknown.length > 0) {
    return {
      ok: false,
      code: 'unknown_names',
      unknownNames: unknown,
      detail: 'One or more source names are not in the exact alias list.',
    }
  }
  return { ok: true, scores }
}
