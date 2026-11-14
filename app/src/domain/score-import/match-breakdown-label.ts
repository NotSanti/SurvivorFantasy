import { KNOWN_SCORING_RULES } from '@/domain/rules-sync/types'

function normalizeForMatch(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, "'")
    .replace(/[^a-z0-9+\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function ruleNeedlesMatch(
  haystack: string,
  rule: (typeof KNOWN_SCORING_RULES)[number],
): boolean {
  if (rule.exclude?.some((needle) => haystack.includes(needle))) return false
  const sets = [rule.needles, ...(rule.altNeedleSets ?? [])]
  return sets.some((set) => set.every((needle) => haystack.includes(needle)))
}

/** Map a Global graphic line label + points to a known scoring rule code. */
export function matchBreakdownLabel(
  label: string,
  points: number,
): { code: string; label: string } | null {
  const haystack = normalizeForMatch(label)
  const match = KNOWN_SCORING_RULES.find(
    (rule) => rule.points === points && ruleNeedlesMatch(haystack, rule),
  )
  if (!match) return null
  return { code: match.code, label: match.label }
}
