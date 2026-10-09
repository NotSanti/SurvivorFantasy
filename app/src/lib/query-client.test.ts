import { describe, expect, it } from 'vitest'
import { isTransientQueryError } from './query-client'

describe('isTransientQueryError', () => {
  it('retries dropped and timed-out PWA fetches', () => {
    expect(isTransientQueryError(new TypeError('Load failed'))).toBe(true)
    expect(isTransientQueryError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isTransientQueryError(new DOMException('The request timed out.', 'TimeoutError'))).toBe(
      true,
    )
  })

  it('does not retry a cancelled read or a signed-out session', () => {
    expect(isTransientQueryError(new DOMException('The operation was aborted.', 'AbortError'))).toBe(
      false,
    )
    expect(isTransientQueryError(new Error('Not signed in'))).toBe(false)
    expect(isTransientQueryError(new Error('permission denied'))).toBe(false)
  })
})