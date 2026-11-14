import { describe, expect, it } from 'vitest'
import { parseBreakdownCsv, resolveBreakdownCsv } from './parse-breakdown-csv'

const sample = `episode,castaway,category,points
8,An,Cried on Camera,5
8,An,Survived the Week,3
8,Carter,Got an Advantage,5
8,Carter,Survived the Week,3
`

describe('parseBreakdownCsv', () => {
  it('parses long-form Global-style rows', () => {
    const result = parseBreakdownCsv(sample)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.episodeNumbers).toEqual([8])
    expect(result.rows).toHaveLength(4)
    expect(result.rows[0]).toMatchObject({
      castawayName: 'An',
      label: 'Cried on Camera',
      points: 5,
      episodeNumber: 8,
    })
  })

  it('accepts alternate headers and optional rule_code', () => {
    const result = parseBreakdownCsv(
      `ep,name,label,pts,rule_code\n2,Jelly,Hugs Jeff,5,wc_hugs_jeff\n`,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rows[0]?.ruleCode).toBe('wc_hugs_jeff')
  })

  it('fails closed on missing required headers', () => {
    const result = parseBreakdownCsv(`name,score\nAn,5\n`)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('missing_header')
  })
})

describe('resolveBreakdownCsv', () => {
  const castaways = [
    { id: 'a', displayName: 'Thien An' },
    { id: 'c', displayName: 'Carter' },
  ]
  const aliases = [
    { normalizedSourceName: 'an', castawayId: 'a' },
    { normalizedSourceName: 'carter', castawayId: 'c' },
  ]

  it('maps labels and groups lines per castaway', () => {
    const parsed = parseBreakdownCsv(sample)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const resolved = resolveBreakdownCsv({
      rows: parsed.rows,
      episodeNumber: 8,
      aliases,
      castaways,
      importedTotals: new Map([
        ['a', 8],
        ['c', 8],
      ]),
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.proposal.castaways).toHaveLength(2)
    const an = resolved.proposal.castaways.find((row) => row.castaway_id === 'a')
    expect(an?.lines.map((line) => line.rule_code)).toEqual([
      'wc_cried_on_camera',
      'survive_post_merge',
    ])
    expect(an?.total_mismatch).toBe(false)
  })

  it('rejects unknown castaway names', () => {
    const parsed = parseBreakdownCsv(
      `episode,castaway,category,points\n8,Nobody,Survived the Week,3\n`,
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const resolved = resolveBreakdownCsv({
      rows: parsed.rows,
      episodeNumber: 8,
      aliases,
      castaways,
    })
    expect(resolved.ok).toBe(false)
    if (resolved.ok) return
    expect(resolved.code).toBe('unknown_names')
  })
})
