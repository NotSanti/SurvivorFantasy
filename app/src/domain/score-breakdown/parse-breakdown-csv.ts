import { matchBreakdownLabel } from '@/domain/score-import/match-breakdown-label'
import type { BreakdownCastawayProposal, BreakdownProposal } from './types'

export type BreakdownCsvRow = {
  episodeNumber: number | null
  castawayName: string
  label: string
  points: number
  ruleCode: string | null
  occurrences: number
  line: number
}

export type ParseBreakdownCsvSuccess = {
  ok: true
  rows: BreakdownCsvRow[]
  episodeNumbers: number[]
}

export type ParseBreakdownCsvFailure = {
  ok: false
  code: 'empty' | 'missing_header' | 'invalid_row'
  detail: string
  line?: number
}

export type ParseBreakdownCsvResult = ParseBreakdownCsvSuccess | ParseBreakdownCsvFailure

function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ',' || ch === ';' || ch === '\t') {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  cells.push(current.trim())
  return cells
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

const CASTAWAY_HEADERS = new Set(['castaway', 'name', 'player', 'castawayname'])
const LABEL_HEADERS = new Set([
  'category',
  'label',
  'rule',
  'scoringrule',
  'breakdown',
  'event',
])
const POINTS_HEADERS = new Set(['points', 'pts', 'point', 'score'])
const EPISODE_HEADERS = new Set(['episode', 'episodenumber', 'ep'])
const RULE_CODE_HEADERS = new Set(['rulecode', 'code', 'scoringrulecode'])
const OCCURRENCE_HEADERS = new Set(['occurrences', 'occurrence', 'count'])

function findColumn(headers: string[], names: Set<string>): number {
  return headers.findIndex((header) => names.has(normalizeHeader(header)))
}

/** Parse a long-form points breakdown CSV into rows. */
export function parseBreakdownCsv(text: string): ParseBreakdownCsvResult {
  const rawLines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))

  if (rawLines.length === 0) {
    return { ok: false, code: 'empty', detail: 'CSV is empty.' }
  }

  const headers = splitCsvLine(rawLines[0]!)
  const castawayIdx = findColumn(headers, CASTAWAY_HEADERS)
  const labelIdx = findColumn(headers, LABEL_HEADERS)
  const pointsIdx = findColumn(headers, POINTS_HEADERS)
  const episodeIdx = findColumn(headers, EPISODE_HEADERS)
  const ruleCodeIdx = findColumn(headers, RULE_CODE_HEADERS)
  const occurrencesIdx = findColumn(headers, OCCURRENCE_HEADERS)

  if (castawayIdx < 0 || labelIdx < 0 || pointsIdx < 0) {
    return {
      ok: false,
      code: 'missing_header',
      detail:
        'CSV needs headers for castaway, category/label, and points. Optional: episode, rule_code, occurrences.',
    }
  }

  const rows: BreakdownCsvRow[] = []
  for (let i = 1; i < rawLines.length; i += 1) {
    const lineNumber = i + 1
    const cells = splitCsvLine(rawLines[i]!)
    const castawayName = cells[castawayIdx]?.trim() ?? ''
    const label = cells[labelIdx]?.trim() ?? ''
    const pointsRaw = cells[pointsIdx]?.trim() ?? ''
    if (!castawayName && !label && !pointsRaw) continue

    const points = Number(pointsRaw.replace(/^\+/, ''))
    if (!castawayName || !label || !Number.isFinite(points)) {
      return {
        ok: false,
        code: 'invalid_row',
        detail: `Row ${lineNumber} needs castaway, category, and numeric points.`,
        line: lineNumber,
      }
    }

    let episodeNumber: number | null = null
    if (episodeIdx >= 0) {
      const episodeRaw = cells[episodeIdx]?.trim() ?? ''
      if (episodeRaw) {
        const parsed = Number(episodeRaw)
        if (!Number.isInteger(parsed) || parsed <= 0) {
          return {
            ok: false,
            code: 'invalid_row',
            detail: `Row ${lineNumber} has an invalid episode number.`,
            line: lineNumber,
          }
        }
        episodeNumber = parsed
      }
    }

    let occurrences = 1
    if (occurrencesIdx >= 0) {
      const occRaw = cells[occurrencesIdx]?.trim() ?? ''
      if (occRaw) {
        const parsed = Number(occRaw)
        if (!Number.isInteger(parsed) || parsed <= 0) {
          return {
            ok: false,
            code: 'invalid_row',
            detail: `Row ${lineNumber} has an invalid occurrences value.`,
            line: lineNumber,
          }
        }
        occurrences = parsed
      }
    }

    const ruleCode =
      ruleCodeIdx >= 0 ? (cells[ruleCodeIdx]?.trim() || null) : null

    rows.push({
      episodeNumber,
      castawayName,
      label,
      points,
      ruleCode,
      occurrences,
      line: lineNumber,
    })
  }

  if (rows.length === 0) {
    return { ok: false, code: 'empty', detail: 'CSV has a header but no data rows.' }
  }

  const episodeNumbers = [
    ...new Set(rows.map((row) => row.episodeNumber).filter((n): n is number => n != null)),
  ].sort((a, b) => a - b)

  return { ok: true, rows, episodeNumbers }
}

export type AliasRecord = {
  normalizedSourceName: string
  castawayId: string
}

export type CastawayRecord = {
  id: string
  displayName: string
}

function normalizeName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export type ResolveBreakdownCsvResult =
  | {
      ok: true
      proposal: BreakdownProposal
      unknownNames: string[]
      unmappedLabels: string[]
    }
  | {
      ok: false
      code: 'unknown_names' | 'mixed_episodes' | 'missing_episode'
      detail: string
      unknownNames?: string[]
    }

/** Resolve parsed CSV rows against castaway aliases and scoring rules. */
export function resolveBreakdownCsv(input: {
  rows: BreakdownCsvRow[]
  episodeNumber: number
  aliases: AliasRecord[]
  castaways: CastawayRecord[]
  importedTotals?: Map<string, number>
}): ResolveBreakdownCsvResult {
  const { rows, episodeNumber, aliases, castaways, importedTotals } = input

  const episodeMismatch = rows.find(
    (row) => row.episodeNumber != null && row.episodeNumber !== episodeNumber,
  )
  if (episodeMismatch) {
    return {
      ok: false,
      code: 'mixed_episodes',
      detail: `CSV includes episode ${episodeMismatch.episodeNumber}, but the form is set to episode ${episodeNumber}.`,
    }
  }

  const byName = new Map<string, string[]>()
  for (const alias of aliases) {
    const key = normalizeName(alias.normalizedSourceName)
    const ids = byName.get(key) ?? []
    ids.push(alias.castawayId)
    byName.set(key, ids)
  }
  for (const castaway of castaways) {
    const key = normalizeName(castaway.displayName)
    const ids = byName.get(key) ?? []
    if (!ids.includes(castaway.id)) ids.push(castaway.id)
    byName.set(key, ids)
  }

  const unknownNames = new Set<string>()
  const unmappedLabels = new Set<string>()
  const byCastaway = new Map<string, BreakdownCastawayProposal>()

  for (const row of rows) {
    const ids = [...new Set(byName.get(normalizeName(row.castawayName)) ?? [])]
    if (ids.length !== 1) {
      unknownNames.add(row.castawayName)
      continue
    }
    const castawayId = ids[0]!
    const castaway = castaways.find((c) => c.id === castawayId)
    const matched =
      row.ruleCode
        ? { code: row.ruleCode, label: row.label }
        : matchBreakdownLabel(row.label, Math.abs(row.points))

    if (!matched && !row.ruleCode) {
      unmappedLabels.add(row.label)
    }

    const current = byCastaway.get(castawayId) ?? {
      castaway_id: castawayId,
      display_name: castaway?.displayName ?? row.castawayName,
      points_total: importedTotals?.get(castawayId) ?? 0,
      lines: [],
      line_sum: 0,
      total_mismatch: false,
    }

    const ruleCode = matched?.code ?? row.ruleCode
    const existing =
      ruleCode != null
        ? current.lines.findIndex((line) => line.rule_code === ruleCode)
        : -1
    if (existing >= 0) {
      const prior = current.lines[existing]!
      current.lines[existing] = {
        ...prior,
        points: prior.points + row.points,
        occurrences: prior.occurrences + row.occurrences,
        source_label: prior.source_label
          ? `${prior.source_label}; ${row.label}`
          : row.label,
      }
    } else {
      current.lines.push({
        rule_code: ruleCode,
        label: matched?.label ?? row.label,
        source_label: row.label,
        points: row.points,
        occurrences: row.occurrences,
      })
    }
    current.line_sum = current.lines.reduce((sum, line) => sum + line.points, 0)
    current.total_mismatch =
      importedTotals != null &&
      importedTotals.has(castawayId) &&
      current.line_sum !== importedTotals.get(castawayId)
    byCastaway.set(castawayId, current)
  }

  if (unknownNames.size > 0) {
    return {
      ok: false,
      code: 'unknown_names',
      detail: `Unknown castaway names: ${[...unknownNames].join(', ')}`,
      unknownNames: [...unknownNames],
    }
  }

  return {
    ok: true,
    proposal: {
      castaways: [...byCastaway.values()].sort((a, b) =>
        a.display_name.localeCompare(b.display_name),
      ),
    },
    unknownNames: [],
    unmappedLabels: [...unmappedLabels],
  }
}
