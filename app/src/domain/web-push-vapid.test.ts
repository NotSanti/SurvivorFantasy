import { describe, expect, it } from 'vitest'
import {
  createVapidJwt,
  decodeJwtParts,
  generateVapidKeys,
  resolveVapidSubject,
  vapidPublicFromPrivate,
  verifyVapidJwt,
} from './web-push-vapid'

describe('web-push vapid spike', () => {
  it('creates an ES256 JWT with Web Crypto, without Node-only web-push', async () => {
    const keys = await generateVapidKeys()
    const token = await createVapidJwt({
      audience: 'https://fcm.googleapis.com',
      subject: 'mailto:ops@kindling.example',
      privateKey: keys.privateKey,
    })

    const { header, payload } = decodeJwtParts(token)
    expect(header.alg).toBe('ES256')
    expect(payload.aud).toBe('https://fcm.googleapis.com')
    expect(payload.sub).toBe('https://kindling-theta.vercel.app')
    expect(payload.exp).toEqual(expect.any(Number))
    const publicKey = await vapidPublicFromPrivate(keys.privateKey)
    const exported = await crypto.subtle.exportKey('raw', keys.publicKey)
    expect(publicKey).toBe(toUrl(new Uint8Array(exported)))
    await expect(verifyVapidJwt(token, publicKey)).resolves.toBe(true)
  })
})

function toUrl(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

describe('resolveVapidSubject', () => {
  it('rejects placeholder and localhost subjects that Apple 403s', () => {
    expect(resolveVapidSubject('mailto:ops@kindling.example')).toBe('https://kindling-theta.vercel.app')
    expect(resolveVapidSubject('mailto:admin@localhost')).toBe('https://kindling-theta.vercel.app')
    expect(resolveVapidSubject('ops@example.com')).toBe('https://kindling-theta.vercel.app')
    expect(resolveVapidSubject('mailto:ops@example.com')).toBe('mailto:ops@example.com')
  })
})
