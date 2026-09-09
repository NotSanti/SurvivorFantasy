import { describe, expect, it, vi } from 'vitest'
import { diffRuleSets } from './diff-rules'
import { discoverSeason51Source } from './discover-source'
import { parseRulesHtml } from './parse-rules'
import { CANONICAL_PAGE_URL, WP_POSTS_URL } from './types'

const sanitized = `<article>
  <h2>How to Play</h2>
  <p>
    Pick three castaways from each of three original tribes, for nine total picks.
    Choose one of those nine as MVP. Points begin accumulating with Episode 2.
  </p>
  <h2>Scoring</h2>
  <ul>
    <li>Survive a pre-merge scoring episode: 1 point</li>
    <li>Survive a post-merge scoring episode: 3 points</li>
    <li>Finish third: 10 points</li>
    <li>Finish second: 20 points</li>
    <li>Win the season: 30 points</li>
    <li>MVP wins: 30 points</li>
  </ul>
</article>`

const changed = sanitized.replace('Episode 2', 'Episode 3')

const unknownRules = `<article>
  <h2>How to Play</h2>
  <p>
    Pick three castaways from each of three original tribes, for nine total picks.
    Points begin accumulating with Episode 2.
  </p>
  <h2>Scoring</h2>
  <ul>
    <li>Survive a pre-merge scoring episode: 1 point</li>
    <li>Teleport to another island: 100 points</li>
  </ul>
</article>`

const malformed = `<div><p>This page has no usable fantasy rules.</p></div>`

describe('parseRulesHtml', () => {
  it('parses the sanitized Season 50 structure', async () => {
    const result = await parseRulesHtml(sanitized)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.proposed.rosterSize).toBe(9)
    expect(result.proposed.picksPerOriginalTribe.per_tribe).toBe(3)
    expect(result.proposed.firstScoredEpisode).toBe(2)
    expect(result.proposed.scoringRules.map((rule) => rule.code)).toContain('survive_pre_merge')
    expect(result.proposed.scoringRules.map((rule) => rule.code)).toContain('mvp_win')
  })

  it('treats identical content as the same hash', async () => {
    const first = await parseRulesHtml(sanitized)
    const second = await parseRulesHtml(sanitized)
    expect(first.ok && second.ok && first.contentHash === second.contentHash).toBe(true)
  })

  it('diffs a first-scored-episode change', async () => {
    const before = await parseRulesHtml(sanitized)
    const after = await parseRulesHtml(changed)
    expect(before.ok && after.ok).toBe(true)
    if (!before.ok || !after.ok) return
    const diff = diffRuleSets(before.proposed, after.proposed)
    expect(diff.some((entry) => entry.path === 'firstScoredEpisode' && entry.after === 3)).toBe(true)
  })

  it('fails closed on unknown scoring lines', async () => {
    const result = await parseRulesHtml(unknownRules)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('unknown_rules')
  })

  it('fails closed on malformed HTML without quotas', async () => {
    const result = await parseRulesHtml(malformed)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('missing_quotas')
  })

  it('fails closed on empty content', async () => {
    const result = await parseRulesHtml('   ')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('empty_content')
  })
})

describe('discoverSeason51Source', () => {
  it('returns not_published_yet for an empty WordPress list', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }),
    )
    const result = await discoverSeason51Source({ fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('not_published_yet')
    expect(fetchImpl).toHaveBeenCalled()
    expect(String(fetchImpl.mock.calls.at(0)?.at(0))).toContain(WP_POSTS_URL)
  })

  it('prefers WordPress REST content when present', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify([
          {
            id: 99,
            modified: '2026-09-01T00:00:00',
            link: 'https://www.globaltv.com/survivor-51-fantasy-tribe/',
            content: { rendered: sanitized },
          },
        ]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )
    const result = await discoverSeason51Source({ fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.document.via).toBe('wordpress_rest')
    expect(result.document.wpPostId).toBe(99)
    expect(result.document.html).toContain('How to Play')
  })

  it('falls back to canonical HTML when REST fails', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const href = String(input)
      if (href.includes('wp-json')) throw new Error('REST down')
      return new Response(sanitized, { status: 200, headers: { 'content-type': 'text/html' } })
    })
    const result = await discoverSeason51Source({ fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.document.via).toBe('html_fallback')
    expect(result.document.url).toContain(new URL(CANONICAL_PAGE_URL).hostname)
  })

  it('rejects redirects off Global TV', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://evil.example/phish' },
        }),
    )
    const result = await discoverSeason51Source({ fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('redirect_blocked')
  })

  it('rejects oversized payloads', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('[]', {
          status: 200,
          headers: { 'content-type': 'application/json', 'content-length': '2000000' },
        }),
    )
    const result = await discoverSeason51Source({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      maxBytes: 100,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('too_large')
  })

  it('maps timeouts', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new DOMException('The operation was aborted.', 'TimeoutError')
    })
    const result = await discoverSeason51Source({ fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('timeout')
  })
})
