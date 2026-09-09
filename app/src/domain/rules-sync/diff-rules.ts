import type { ProposedRuleSet, RuleDiffEntry } from './types'

function flatten(proposed: ProposedRuleSet): Record<string, string | number> {
  const values: Record<string, string | number> = {
    rosterSize: proposed.rosterSize,
    wildcardSlots: proposed.wildcardSlots,
    firstScoredEpisode: proposed.firstScoredEpisode,
    perTribe: proposed.picksPerOriginalTribe.per_tribe,
    tribeCount: proposed.picksPerOriginalTribe.tribe_count,
    manualDistribution: proposed.picksPerOriginalTribe.manual_distribution.join(','),
  }
  for (const rule of proposed.scoringRules) {
    values[`rule.${rule.code}.points`] = rule.points
    values[`rule.${rule.code}.label`] = rule.label
    values[`rule.${rule.code}.kind`] = rule.kind
    values[`rule.${rule.code}.phase`] = rule.phase
  }
  return values
}

export function diffRuleSets(
  before: ProposedRuleSet | null,
  after: ProposedRuleSet,
): RuleDiffEntry[] {
  const left = before ? flatten(before) : {}
  const right = flatten(after)
  const keys = new Set([...Object.keys(left), ...Object.keys(right)])
  const entries: RuleDiffEntry[] = []
  for (const path of [...keys].sort()) {
    const previous = left[path] ?? null
    const next = right[path] ?? null
    if (previous !== next) {
      entries.push({ path, before: previous, after: next })
    }
  }
  return entries
}
