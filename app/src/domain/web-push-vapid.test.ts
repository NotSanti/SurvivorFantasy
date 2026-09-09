import { describe, expect, it } from 'vitest'
import { createVapidJwt, decodeJwtParts, generateVapidKeys } from './web-push-vapid'

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
    expect(payload.sub).toBe('mailto:ops@kindling.example')
  })
})
