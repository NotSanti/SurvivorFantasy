import { describe, expect, it, vi } from 'vitest'
import { bytesToUrlBase64 } from '@/domain/web-push/keys'
import {
  clientErrorMessage,
  ensurePushSubscription,
  serializePushSubscription,
  vapidApplicationServerKey,
} from './subscribe'

describe('serializePushSubscription', () => {
  it('reads keys from getKey when toJSON omits them', () => {
    const p256dh = new Uint8Array(65).fill(4)
    const auth = new Uint8Array(16).fill(9)
    const serialized = serializePushSubscription({
      endpoint: 'https://web.push.apple.com/abc',
      toJSON: () => ({ endpoint: 'https://web.push.apple.com/abc', keys: {} }),
      getKey: (name) => (name === 'p256dh' ? p256dh.buffer : auth.buffer),
    })
    expect(serialized.p256dh).toEqual(bytesToUrlBase64(p256dh))
    expect(serialized.auth).toEqual(bytesToUrlBase64(auth))
  })
})

describe('clientErrorMessage', () => {
  it('reads PostgREST-style plain objects', () => {
    expect(clientErrorMessage({ message: 'Push subscription keys are required' }, 'fallback')).toBe(
      'Push subscription keys are required',
    )
  })
})

describe('ensurePushSubscription', () => {
  const publicKey = bytesToUrlBase64(
    Uint8Array.from({ length: 65 }, (_, index) => (index === 0 ? 4 : 1)),
  )

  it('reuses an existing browser subscription instead of failing', async () => {
    const existing = {
      endpoint: 'https://fcm.googleapis.com/x',
      options: { applicationServerKey: vapidApplicationServerKey(publicKey) },
    }
    const subscribe = vi.fn()
    const registration = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(existing),
        subscribe,
      },
    }
    await expect(ensurePushSubscription(registration, publicKey)).resolves.toBe(existing)
    expect(subscribe).not.toHaveBeenCalled()
  })

  it('replaces a subscription created with a different VAPID key', async () => {
    const stale = {
      endpoint: 'https://fcm.googleapis.com/old',
      unsubscribe: vi.fn().mockResolvedValue(true),
    }
    const next = { endpoint: 'https://fcm.googleapis.com/new' }
    const subscribe = vi.fn().mockResolvedValue(next)
    const registration = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(stale),
        subscribe,
      },
    }
    await expect(ensurePushSubscription(registration, publicKey)).resolves.toBe(next)
    expect(stale.unsubscribe).toHaveBeenCalled()
    expect(subscribe).toHaveBeenCalled()
  })

  it('falls back to getSubscription when subscribe throws', async () => {
    const existing = {
      endpoint: 'https://web.push.apple.com/abc',
      options: { applicationServerKey: vapidApplicationServerKey(publicKey) },
    }
    const registration = {
      pushManager: {
        getSubscription: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(existing),
        subscribe: vi.fn().mockRejectedValue(new Error('already subscribed')),
      },
    }
    await expect(ensurePushSubscription(registration, publicKey)).resolves.toBe(existing)
  })
})

describe('vapidApplicationServerKey', () => {
  it('returns a detached copy of the uncompressed key', () => {
    const key = vapidApplicationServerKey(
      bytesToUrlBase64(Uint8Array.from({ length: 65 }, (_, index) => (index === 0 ? 4 : 1))),
    )
    expect(key).toBeInstanceOf(Uint8Array)
    expect(key.byteLength).toBe(65)
    expect(key.buffer.byteLength).toBe(65)
    expect(key[0]).toBe(4)
  })
})
