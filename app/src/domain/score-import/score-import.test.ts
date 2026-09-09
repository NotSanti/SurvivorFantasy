import { describe, expect, it } from 'vitest'
import { decideEpisodeImport, runIndependentNotify } from './decide-episode'
import { parseAltScores, parseResultsHtml } from './parse-results'
import { resolveEpisodeAliases } from './resolve-aliases'

const ids = { a: '11111111-1111-4111-8111-111111111111', b: '22222222-2222-4222-8222-222222222222', c: '33333333-3333-4333-8333-333333333333' }
const aliases = [
  { normalizedSourceName: 'camper a', castawayId: ids.a },
  { normalizedSourceName: 'camper b', castawayId: ids.b },
  { normalizedSourceName: 'camper c', castawayId: ids.c },
]

const fixture = `<article>
  <h2 id="results">Results</h2>
  <p>Check back Thursday evening. Points begin with episode 2.</p>
  <p><strong>EPISODE 3 POINTS:</strong></p>
  <p><img src="https://www.globaltv.com/wp-content/uploads/episode-3.png" alt="Camper A total points: 4; Camper B total points: 7;"></p>
  <p><strong>EPISODE 2 POINTS:</strong></p>
  <p><img src="https://www.globaltv.com/wp-content/uploads/episode-2.png" alt="Camper A total points: 1; Camper B total points: 3; Camper C total points: 2;"></p>
</article>`

const correction = fixture.replace(
  'episode-3.png" alt="Camper A total points: 4; Camper B total points: 7;"',
  'episode-3_v2.png" alt="Camper A total points: 9; Camper B total points: 7;"',
)

describe('parseResultsHtml', () => {
  it('parses episode headings and semicolon alt totals', async () => {
    const result = await parseResultsHtml(fixture)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.episodes.map((row) => row.episodeNumber)).toEqual([3, 2])
    expect(result.episodes[1].scores).toEqual([
      { sourceName: 'Camper A', points: 1 },
      { sourceName: 'Camper B', points: 3 },
      { sourceName: 'Camper C', points: 2 },
    ])
  })

  it('treats identical documents as the same hash', async () => {
    const first = await parseResultsHtml(fixture)
    const second = await parseResultsHtml(fixture)
    expect(first.ok && second.ok && first.contentHash === second.contentHash).toBe(true)
  })

  it('fails closed on malformed totals', () => {
    const parsed = parseAltScores('Camper A total points: twelve')
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.code).toBe('malformed_alt')
  })

  it('fails closed on duplicate names', () => {
    const parsed = parseAltScores('Camper A total points: 1; Camper A total points: 2')
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.code).toBe('duplicate_names')
  })

  it('fails closed when #results is missing or empty', async () => {
    const missing = await parseResultsHtml('<article><p>No results yet.</p></article>')
    expect(missing.ok).toBe(false)
    const empty = await parseResultsHtml('<article><h2 id="results">Results</h2><p>Check back later.</p></article>')
    expect(empty.ok).toBe(false)
  })

  it('ignores script and event-handler markup outside result image alt text', async () => {
    const malicious = `<article>
      <script>window.alert('xss')</script>
      <img src="javascript:alert(1)" alt="ignore me">
      <h2 id="results">Results</h2>
      <p><strong>EPISODE 2 POINTS:</strong></p>
      <p><img src="https://www.globaltv.com/wp-content/uploads/episode-2.png" onerror="alert(1)" alt="Camper A total points: 1; Camper B total points: 3; Camper C total points: 2;"></p>
    </article>`
    const result = await parseResultsHtml(malicious)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.episodes).toHaveLength(1)
    expect(result.episodes[0].scores.map((row) => row.sourceName)).toEqual(['Camper A', 'Camper B', 'Camper C'])
  })
})

describe('resolveEpisodeAliases', () => {
  it('resolves exact normalized names and rejects unknown spelling', async () => {
    const parsed = await parseResultsHtml(fixture)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const ok = resolveEpisodeAliases(parsed.episodes[1], aliases)
    expect(ok.ok).toBe(true)
    const misspelled = {
      ...parsed.episodes[1],
      scores: [{ sourceName: 'Campper A', points: 1 }],
    }
    const failed = resolveEpisodeAliases(misspelled, aliases)
    expect(failed.ok).toBe(false)
    if (failed.ok) return
    expect(failed.code).toBe('unknown_names')
  })
})

describe('decideEpisodeImport', () => {
  it('publishes new results and no-ops identical reruns', async () => {
    const parsed = await parseResultsHtml(fixture)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const first = await decideEpisodeImport(parsed.episodes[1], aliases, [], { firstScoredEpisode: 2 })
    expect(first.status).toBe('publish')
    if (first.status !== 'publish') return
    const again = await decideEpisodeImport(
      parsed.episodes[1],
      aliases,
      first.scores.map((row) => ({ castawayId: row.castawayId, points: row.points })),
      { firstScoredEpisode: 2 },
    )
    expect(again.status).toBe('noop')
  })

  it('treats a _v2 alt change as a correction', async () => {
    const before = await parseResultsHtml(fixture)
    const after = await parseResultsHtml(correction)
    expect(before.ok && after.ok).toBe(true)
    if (!before.ok || !after.ok) return
    const published = (await decideEpisodeImport(before.episodes[0], aliases, [], { firstScoredEpisode: 2 }))
    expect(published.status).toBe('publish')
    if (published.status !== 'publish') return
    const next = await decideEpisodeImport(
      after.episodes[0],
      aliases,
      published.scores.map((row) => ({ castawayId: row.castawayId, points: row.points })),
      { firstScoredEpisode: 2 },
    )
    expect(next.status).toBe('publish')
    if (next.status !== 'publish') return
    expect(next.kind).toBe('correction')
    expect(next.imageUrl).toContain('_v2')
    expect(next.scores.find((row) => row.castawayId === ids.a)?.points).toBe(9)
  })
})

describe('runIndependentNotify', () => {
  it('keeps the published result when notification delivery throws', async () => {
    const result = await runIndependentNotify({ episodeNumber: 2, published: true }, async () => {
      throw new Error('push 503')
    })
    expect(result.published.published).toBe(true)
    expect(result.notifyFailed).toBe(true)
  })
})

describe('source fetch failures', () => {
  it('maps a network error without mutating scores', async () => {
    const { discoverSeason51Source } = await import('@/domain/rules-sync/discover-source')
    const result = await discoverSeason51Source({
      fetchImpl: async () => {
        throw new TypeError('Failed to fetch')
      },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code === 'network' || result.code === 'timeout' || result.code === 'http_error').toBe(
      true,
    )
  })
})
