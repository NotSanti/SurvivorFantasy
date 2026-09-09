import { describe, expect, it } from 'vitest'
import { assertAllowedRedirect, assertAllowedSourceUrl } from './allowlist'

describe('source fetch allowlist', () => {
  it('allows Global TV HTTPS hosts only', () => {
    expect(assertAllowedSourceUrl('https://www.globaltv.com/survivor-51-fantasy-tribe/').ok).toBe(true)
    expect(assertAllowedSourceUrl('https://evil.example/phish').ok).toBe(false)
    expect(assertAllowedSourceUrl('http://www.globaltv.com/survivor-51-fantasy-tribe/').ok).toBe(false)
    expect(assertAllowedSourceUrl('not-a-url').ok).toBe(false)
  })

  it('blocks SSRF redirects off Global TV', () => {
    const from = new URL('https://www.globaltv.com/survivor-51-fantasy-tribe/')
    const blocked = assertAllowedRedirect('https://evil.example/phish', from)
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.code).toBe('redirect_blocked')
    const httpBlocked = assertAllowedRedirect('http://www.globaltv.com/still-http', from)
    expect(httpBlocked.ok).toBe(false)
    if (!httpBlocked.ok) expect(httpBlocked.code).toBe('redirect_blocked')
    expect(assertAllowedRedirect('/wp-json/wp/v2/posts', from).ok).toBe(true)
  })
})
