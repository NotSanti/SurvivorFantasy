import { describe, expect, it } from 'vitest'
import { authorizeCronRequest } from './cron-auth'
import { classifySourceCheck, cronIsStale } from './health'
import { containsInviteTokenLeak, redactForLog } from './redact'
import {
  FORBIDDEN_REALTIME_TABLES,
  isForbiddenRealtimeTable,
  isLeagueRealtimeTable,
  SERVICE_ROLE_ONLY_RPCS,
} from './realtime-access'
import { classifyResultsWindow, isInResultsWindow } from './schedule-window'

describe('Toronto results window', () => {
  it('opens Thursday after 6 p.m. Eastern in summer (EDT)', () => {
    expect(classifyResultsWindow(new Date('2026-09-10T21:59:00.000Z'))).toBe('outside')
    expect(classifyResultsWindow(new Date('2026-09-10T22:00:00.000Z'))).toBe('primary')
    expect(isInResultsWindow(new Date('2026-09-11T09:59:00.000Z'))).toBe(true)
    expect(classifyResultsWindow(new Date('2026-09-11T10:00:00.000Z'))).toBe('outside')
  })

  it('opens Thursday after 6 p.m. Eastern in winter (EST)', () => {
    expect(classifyResultsWindow(new Date('2026-01-08T22:59:00.000Z'))).toBe('outside')
    expect(classifyResultsWindow(new Date('2026-01-08T23:00:00.000Z'))).toBe('primary')
  })

  it('follows the March 2026 spring-forward (EDT)', () => {
    expect(classifyResultsWindow(new Date('2026-03-12T21:59:00.000Z'))).toBe('outside')
    expect(classifyResultsWindow(new Date('2026-03-12T22:00:00.000Z'))).toBe('primary')
  })

  it('follows the November 2026 fall-back (EST)', () => {
    expect(classifyResultsWindow(new Date('2026-11-05T22:59:00.000Z'))).toBe('outside')
    expect(classifyResultsWindow(new Date('2026-11-05T23:00:00.000Z'))).toBe('primary')
  })

  it('includes a Friday daytime fallback', () => {
    expect(classifyResultsWindow(new Date('2026-09-11T16:00:00.000Z'))).toBe('friday_fallback')
    expect(classifyResultsWindow(new Date('2026-09-11T21:59:00.000Z'))).toBe('friday_fallback')
    expect(classifyResultsWindow(new Date('2026-09-11T22:00:00.000Z'))).toBe('outside')
    expect(classifyResultsWindow(new Date('2026-01-09T17:00:00.000Z'))).toBe('friday_fallback')
  })
})

describe('cron authorization', () => {
  it('rejects a forged or missing secret', () => {
    expect(authorizeCronRequest({ expectedSecret: 'correct-secret-value', providedSecret: 'forged' }).ok).toBe(
      false,
    )
    const missingHeader = authorizeCronRequest({
      expectedSecret: 'correct-secret-value',
      providedSecret: null,
    })
    expect(missingHeader.ok).toBe(false)
    if (!missingHeader.ok) expect(missingHeader.code).toBe('forged')
    const missingExpected = authorizeCronRequest({ expectedSecret: undefined, providedSecret: 'anything' })
    expect(missingExpected.ok).toBe(false)
    if (!missingExpected.ok) expect(missingExpected.code).toBe('missing_secret')
  })

  it('accepts an exact match and rejects a prefix match', () => {
    expect(authorizeCronRequest({ expectedSecret: 'kindling-cron', providedSecret: 'kindling-cron' }).ok).toBe(
      true,
    )
    expect(
      authorizeCronRequest({ expectedSecret: 'kindling-cron', providedSecret: 'kindling-cron-extra' }).ok,
    ).toBe(false)
  })
})

describe('ops health classification', () => {
  it('distinguishes unpublished source from importer failure', () => {
    expect(classifySourceCheck(null)).toBe('none')
    expect(classifySourceCheck({ status: 'noop', errorCode: 'not_published_yet' })).toBe('no_result_yet')
    expect(classifySourceCheck({ status: 'noop', errorCode: 'outside_window' })).toBe('no_result_yet')
    expect(classifySourceCheck({ status: 'succeeded', errorCode: null })).toBe('success')
    expect(classifySourceCheck({ status: 'needs_review', errorCode: 'unknown_names' })).toBe('needs_review')
    expect(classifySourceCheck({ status: 'failed', errorCode: 'http_error' })).toBe('failure')
    expect(classifySourceCheck({ status: 'failed', errorCode: 'not_published_yet' })).toBe('failure')
  })

  it('marks cron stale after eight days', () => {
    expect(cronIsStale(null)).toBe(true)
    expect(cronIsStale('2026-09-01T00:00:00.000Z', new Date('2026-09-09T00:00:01.000Z'))).toBe(true)
    expect(cronIsStale('2026-09-01T00:00:00.000Z', new Date('2026-09-09T00:00:00.000Z'))).toBe(false)
  })
})

describe('redaction and invite leakage', () => {
  it('strips invite tokens, JWTs, and emails from log snapshots', () => {
    const leak = 'https://kindling.example/join?token=aabbccddeeff00112233445566778899abcdef0123456789'
    expect(containsInviteTokenLeak(leak)).toBe(true)
    const redacted = redactForLog(`Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig ${leak} ops@example.com`)
    expect(containsInviteTokenLeak(redacted)).toBe(false)
    expect(redacted).not.toContain('aabbccddeeff')
    expect(redacted).not.toContain('eyJhbGci')
    expect(redacted).not.toContain('ops@example.com')
  })
})

describe('Realtime and privileged RPC boundaries', () => {
  it('allows only league score tables on the member channel', () => {
    expect(isLeagueRealtimeTable('episodes')).toBe(true)
    expect(isLeagueRealtimeTable('league_invites')).toBe(false)
    for (const table of FORBIDDEN_REALTIME_TABLES) {
      expect(isForbiddenRealtimeTable(table)).toBe(true)
      expect(isLeagueRealtimeTable(table)).toBe(false)
    }
    expect(SERVICE_ROLE_ONLY_RPCS).toContain('claim_notification_outbox')
  })
})
