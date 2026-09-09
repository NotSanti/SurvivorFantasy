import { describe, expect, it } from 'vitest'
import { bytesToUrlBase64, urlBase64ToBytes, vapidPublicKeyBytes } from './keys'

describe('vapid key encoding', () => {
  it('round-trips url-safe base64', () => {
    const original = new Uint8Array([4, 1, 2, 255, 0])
    expect(urlBase64ToBytes(bytesToUrlBase64(original))).toEqual(original)
  })

  it('ignores wrapping whitespace in pasted secrets', () => {
    const original = new Uint8Array([4, 1, 2, 255, 0])
    const wrapped = `${bytesToUrlBase64(original)}\n`
    expect(urlBase64ToBytes(wrapped)).toEqual(original)
  })

  it('rejects a truncated application server key', () => {
    expect(() => vapidPublicKeyBytes(bytesToUrlBase64(new Uint8Array(8)))).toThrow(
      /uncompressed P-256/,
    )
  })
})
