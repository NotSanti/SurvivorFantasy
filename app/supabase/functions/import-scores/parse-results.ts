import { parseHTML } from 'linkedom'
import { normalizeForMatch, normalizeText, sha256Hex } from './normalize.ts'
import type { ParseResult, ParsedEpisode, ParsedScore } from './score-types.ts'

const HEADING = /episode\s+(\d+)\s+points:?/i
const PAIR = /^(.+?)\s+total points:\s*(\d+)$/i

function walkAfter(results: Element): Element[] {
  const out: Element[] = []
  const visit = (el: Element) => {
    out.push(el)
    for (const child of [...el.children]) visit(child)
  }
  for (const child of [...results.children]) visit(child)
  let sibling = results.nextElementSibling
  while (sibling) {
    visit(sibling)
    sibling = sibling.nextElementSibling
  }
  return out
}

function headingNumber(el: Element): number | null {
  const text = normalizeForMatch(el.textContent ?? '')
  const match = text.match(HEADING)
  if (!match) return null
  const episode = Number(match[1])
  return Number.isInteger(episode) && episode > 0 ? episode : null
}

export function parseAltScores(
  alt: string,
): { ok: true; scores: ParsedScore[] } | { ok: false; code: 'malformed_alt' | 'duplicate_names' | 'empty_episode'; detail: string } {
  const parts = normalizeText(alt)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0) {
    return { ok: false, code: 'empty_episode', detail: 'Result image alt text had no totals.' }
  }
  const scores: ParsedScore[] = []
  const seen = new Set<string>()
  for (const part of parts) {
    const match = part.match(PAIR)
    if (!match) {
      return { ok: false, code: 'malformed_alt', detail: `Could not parse score pair: ${part}` }
    }
    const sourceName = normalizeText(match[1])
    const points = Number(match[2])
    if (!Number.isInteger(points) || points < 0) {
      return { ok: false, code: 'malformed_alt', detail: `Non-integer total for ${sourceName}` }
    }
    const key = normalizeForMatch(sourceName)
    if (seen.has(key)) {
      return { ok: false, code: 'duplicate_names', detail: `Duplicate source name ${sourceName}` }
    }
    seen.add(key)
    scores.push({ sourceName, points })
  }
  return { ok: true, scores }
}

export async function parseResultsHtml(html: string): Promise<ParseResult> {
  const trimmed = html.trim()
  if (!trimmed) {
    return { ok: false, code: 'empty_content', detail: 'Source document was empty.' }
  }
  const document = parseHTML(trimmed).document
  const results = document.getElementById('results')
  if (!results) {
    return { ok: false, code: 'missing_results', detail: 'No #results section was found.' }
  }

  const episodes: ParsedEpisode[] = []
  let pending: number | null = null
  for (const el of walkAfter(results)) {
    const heading = headingNumber(el)
    if (heading != null) {
      pending = heading
      continue
    }
    if (el.tagName !== 'IMG' || pending == null) continue
    const alt = el.getAttribute('alt') ?? ''
    const parsed = parseAltScores(alt)
    if (!parsed.ok) return parsed
    episodes.push({
      episodeNumber: pending,
      imageUrl: el.getAttribute('src'),
      altText: normalizeText(alt),
      scores: parsed.scores,
    })
    pending = null
  }

  if (episodes.length === 0) {
    return { ok: false, code: 'empty_content', detail: 'No episode result images were found after #results.' }
  }

  const contentHash = await sha256Hex(JSON.stringify(episodes))
  return { ok: true, episodes, contentHash }
}
