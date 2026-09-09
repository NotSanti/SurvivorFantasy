import { describe, expect, it } from 'vitest'
import { parsePushPayload, resolveSameOriginUrl } from './push-payload'

describe('parsePushPayload', () => {
  it('accepts a spoiler-safe same-origin notification', () => {
    expect(
      parsePushPayload({
        title: 'Episode 4 scores are in',
        body: 'Your tribe earned 31 points.',
        url: '/standings',
      }),
    ).toMatchObject({ url: '/standings' })
  })

  it('rejects off-origin or protocol-relative urls', () => {
    expect(
      parsePushPayload({
        title: 'Scores',
        body: 'Updated',
        url: 'https://evil.example/phish',
      }),
    ).toBeNull()
    expect(
      parsePushPayload({
        title: 'Scores',
        body: 'Updated',
        url: '//evil.example',
      }),
    ).toBeNull()
  })
})

describe('resolveSameOriginUrl', () => {
  it('keeps in-app paths and falls back to home for a mismatched origin', () => {
    expect(resolveSameOriginUrl('/league', 'https://kindling.app')).toBe(
      'https://kindling.app/league',
    )
    expect(
      resolveSameOriginUrl('https://other.example/x', 'https://kindling.app'),
    ).toBe('https://kindling.app/')
  })
})
