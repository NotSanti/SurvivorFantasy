const encoder = new TextEncoder()

export type VapidKeyPair = {
  publicKey: CryptoKey
  privateKey: CryptoKey
}

export async function generateVapidKeys(): Promise<VapidKeyPair> {
  return crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])
}

export async function createVapidJwt(options: {
  audience: string
  subject: string
  privateKey: CryptoKey
  expiresInSeconds?: number
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { typ: 'JWT', alg: 'ES256' }
  const payload = {
    aud: options.audience,
    sub: options.subject,
    exp: now + (options.expiresInSeconds ?? 12 * 60 * 60),
  }

  const unsigned = `${toBase64Url(encoder.encode(JSON.stringify(header)))}.${toBase64Url(
    encoder.encode(JSON.stringify(payload)),
  )}`
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    options.privateKey,
    encoder.encode(unsigned),
  )

  return `${unsigned}.${toBase64Url(new Uint8Array(signature))}`
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function decodeJwtParts(token: string): {
  header: Record<string, unknown>
  payload: Record<string, unknown>
} {
  const [headerPart, payloadPart] = token.split('.')
  return {
    header: JSON.parse(fromBase64Url(headerPart)) as Record<string, unknown>,
    payload: JSON.parse(fromBase64Url(payloadPart)) as Record<string, unknown>,
  }
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  return atob(padded + pad)
}
