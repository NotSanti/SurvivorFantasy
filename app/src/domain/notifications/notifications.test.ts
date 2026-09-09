import { describe, expect, it } from 'vitest'
import { pushPayloadForOutbox } from './copy'
import { nextOutboxAvailableAt, redactOutboxError, shouldDeadLetter } from './outbox'
import { parsePushPayload } from '@/domain/push-payload'

describe('lock-screen copy', () => {
  it('keeps score push text spoiler-safe and same-origin', () => {
    const payload = pushPayloadForOutbox({
      eventType: 'scores_published',
      payload: { episode_number: 4, points: 31, league_id: 'abc' },
    })
    expect(payload.body).not.toMatch(/31/)
    expect(payload.body.toLowerCase()).not.toContain('boot')
    expect(payload.url).toBe('/standings')
    expect(parsePushPayload(payload)).toMatchObject({ url: '/standings' })
  })
})

describe('outbox retry', () => {
  it('backs off, then dead-letters after eight attempts', () => {
    const first = nextOutboxAvailableAt(1, new Date('2026-09-09T00:00:00Z'))
    expect(first.toISOString()).toBe('2026-09-09T00:01:00.000Z')
    expect(shouldDeadLetter(7)).toBe(false)
    expect(shouldDeadLetter(8)).toBe(true)
  })

  it('redacts endpoints and credentials from stored errors', () => {
    expect(
      redactOutboxError('410 Gone https://fcm.googleapis.com/x vapid=secret user@example.com'),
    ).toBe('410 Gone [endpoint] [credential] [redacted]')
  })
})
