import { parseHTML } from 'linkedom'
import { normalizeForMatch, normalizeText, sha256Hex } from './normalize'
import {
  KNOWN_SCORING_RULES,
  type ParseResult,
  type ProposedRuleSet,
  type ProposedScoringRule,
} from './types'

function textContent(node: { textContent?: string | null }): string {
  return normalizeText(node.textContent ?? '')
}

function ruleNeedlesMatch(haystack: string, rule: (typeof KNOWN_SCORING_RULES)[number]): boolean {
  if (rule.exclude?.some((needle) => haystack.includes(needle))) return false
  const sets = [rule.needles, ...(rule.altNeedleSets ?? [])]
  return sets.some((set) => set.every((needle) => haystack.includes(needle)))
}

function matchKnownRule(label: string, points: number): ProposedScoringRule | null {
  const haystack = normalizeForMatch(label)
  const match = KNOWN_SCORING_RULES.find(
    (rule) => rule.points === points && ruleNeedlesMatch(haystack, rule),
  )
  if (!match) return null
  return {
    code: match.code,
    label: match.label,
    points: match.points,
    kind: match.kind,
    phase: match.phase,
    maxOccurrencesPerCastawayEpisode: match.maxOccurrencesPerCastawayEpisode,
    sortOrder: 0,
  }
}

function lineScore(text: string): { label: string; points: number } | null {
  const scored = text.match(/^(.*?)\s*[:—-]\s*(\d+)\s*points?$/i)
  const scoredFlip = text.match(/^(\d+)\s*points?\s*[:—-]\s*(.+)$/i)
  const prose = text.match(/^score\s+(\d+)\s+(?:bonus\s+)?points?\s+(.+)$/i)
  if (scored) return { label: scored[1], points: Number(scored[2]) }
  if (scoredFlip) return { label: scoredFlip[2], points: Number(scoredFlip[1]) }
  if (prose) return { label: prose[2], points: Number(prose[1]) }
  return null
}

function parseScoringItems(document: Document): {
  rules: ProposedScoringRule[]
  unknown: string[]
} {
  const items = [...document.querySelectorAll('li, p, td')]
  const rules: ProposedScoringRule[] = []
  const unknown: string[] = []
  const seen = new Set<string>()

  for (const item of items) {
    const text = textContent(item)
    const scored = lineScore(text)
    if (!scored) continue
    const { label, points } = scored
    if (!Number.isInteger(points) || points < 0) {
      unknown.push(text)
      continue
    }
    const known = matchKnownRule(label, points)
    if (!known) {
      unknown.push(text)
      continue
    }
    if (seen.has(known.code)) continue
    seen.add(known.code)
    rules.push(known)
  }

  return {
    rules: rules.map((rule, index) => ({ ...rule, sortOrder: (index + 1) * 10 })),
    unknown,
  }
}

const COUNT = String.raw`(\d+|one|two|three|four|five|six|seven|eight|nine|ten)`

function sourceText(document: Document): string {
  const fragment = [...document.childNodes].map((node) => node.textContent ?? '').join('\n')
  return normalizeForMatch(
    fragment.trim() || document.body?.textContent || document.documentElement?.textContent || '',
  )
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
}

function parseCount(value: string): number | null {
  if (/^\d+$/.test(value)) return Number(value)
  return NUMBER_WORDS[value] ?? null
}

function parseQuotas(document: Document): Pick<
  ProposedRuleSet,
  'rosterSize' | 'wildcardSlots' | 'picksPerOriginalTribe' | 'firstScoredEpisode'
> | null {
  const body = sourceText(document)
  const classic = body.match(
    new RegExp(`${COUNT}\\s+castaways from each of ${COUNT} original tribes`),
  )
  const eachTribe = body.match(new RegExp(`${COUNT}\\s+castaways from each tribe\\b`))
  const namedTribes = body.match(new RegExp(`\\b${COUNT}\\s+tribes\\b`))
  const firstEpisode =
    body.match(/points begin[^.]*episode\s+(\d+)/) ?? body.match(/episode\s+(\d+)\b/)
  if (!firstEpisode) return null

  const perTribe = classic
    ? parseCount(classic[1])
    : eachTribe
      ? parseCount(eachTribe[1])
      : null
  const tribeCount = classic
    ? parseCount(classic[2])
    : namedTribes
      ? parseCount(namedTribes[1])
      : null
  const firstScoredEpisode = Number(firstEpisode[1])
  if (
    perTribe == null ||
    tribeCount == null ||
    !Number.isInteger(firstScoredEpisode) ||
    firstScoredEpisode <= 0
  ) {
    return null
  }

  const rosterSize = perTribe * tribeCount
  return {
    rosterSize,
    wildcardSlots: 1,
    picksPerOriginalTribe: {
      per_tribe: perTribe,
      tribe_count: tribeCount,
      manual_distribution: Array.from({ length: tribeCount }, () => perTribe),
    },
    firstScoredEpisode,
  }
}

export async function parseRulesHtml(html: string): Promise<ParseResult> {
  const trimmed = html.trim()
  if (!trimmed) {
    return { ok: false, code: 'empty_content', detail: 'Source document was empty.' }
  }

  let document: Document
  try {
    document = parseHTML(trimmed).document
  } catch {
    return { ok: false, code: 'malformed_html', detail: 'HTML could not be parsed.' }
  }

  if (!document.body && !document.documentElement) {
    return { ok: false, code: 'malformed_html', detail: 'HTML did not contain a usable document.' }
  }

  const quotas = parseQuotas(document)
  if (!quotas) {
    return {
      ok: false,
      code: 'missing_quotas',
      detail: 'Could not find tribe quotas or first scored episode.',
    }
  }

  const { rules, unknown } = parseScoringItems(document)
  if (unknown.length > 0) {
    return {
      ok: false,
      code: 'unknown_rules',
      detail: 'Source listed scoring lines that are not in the known catalog.',
      unknownLabels: unknown,
    }
  }
  if (rules.length === 0) {
    return { ok: false, code: 'malformed_html', detail: 'No scoring rules were found.' }
  }

  const proposed: ProposedRuleSet = {
    ...quotas,
    scoringRules: rules,
  }
  const contentHash = await sha256Hex(JSON.stringify(proposed))
  return { ok: true, proposed, contentHash }
}
