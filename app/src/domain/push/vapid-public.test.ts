import { describe, expect, it } from 'vitest'
import { vapidPublicKeyBytes } from '@/domain/web-push/keys'
import { EDGE_VAPID_PUBLIC_KEY } from './vapid-public'

describe('EDGE_VAPID_PUBLIC_KEY', () => {
  it('is an uncompressed P-256 application server key', () => {
    const bytes = vapidPublicKeyBytes(EDGE_VAPID_PUBLIC_KEY)
    expect(bytes.byteLength).toBe(65)
    expect(bytes[0]).toBe(4)
  })
})
