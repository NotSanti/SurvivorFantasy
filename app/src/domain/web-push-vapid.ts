const encoder = new TextEncoder()

export const DEFAULT_VAPID_SUBJECT = 'https://kindling-theta.vercel.app'

export function normalizeVapidPublicKey(raw: string) {
  return raw.trim().replace(/^["']+|["']+$/g, '').replace(/\s+/g, '')
}

export function resolveVapidSubject(raw: string | undefined, fallback = DEFAULT_VAPID_SUBJECT) {
  const value = raw?.trim() ?? ''
  if (!/^(mailto:[^\s@]+@[^\s@]+\.[^\s@]+|https:\/\/[^\s/]+(?:\/\S*)?)$/i.test(value)) {
    return fallback
  }
  if (/@localhost\b/i.test(value) || /kindling\.example/i.test(value) || /@[^@]+\.example$/i.test(value)) {
    return fallback
  }
  return value
}

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

export function ecdsaSignatureToJose(signature: Uint8Array) {
  if (signature.byteLength === 64) return signature
  if (signature[0] === 0x30) return derEcdsaToP1363(signature)
  throw new Error(`Unexpected ECDSA signature length ${signature.byteLength}`)
}

function derEcdsaToP1363(der: Uint8Array) {
  let offset = 0
  if (der[offset++] !== 0x30) throw new Error('VAPID signature is not a DER sequence')
  const seqLen = der[offset++]
  if (seqLen & 0x80) offset += seqLen & 0x7f
  if (der[offset++] !== 0x02) throw new Error('VAPID signature is missing r')
  const rLen = der[offset++]
  const r = der.subarray(offset, offset + rLen)
  offset += rLen
  if (der[offset++] !== 0x02) throw new Error('VAPID signature is missing s')
  const sLen = der[offset++]
  const s = der.subarray(offset, offset + sLen)
  const out = new Uint8Array(64)
  out.set(r.subarray(Math.max(0, r.byteLength - 32)), 32 - Math.min(32, r.byteLength))
  out.set(s.subarray(Math.max(0, s.byteLength - 32)), 64 - Math.min(32, s.byteLength))
  return out
}

export async function vapidPublicFromPrivate(privateKey: CryptoKey) {
  const jwk = await crypto.subtle.exportKey('jwk', privateKey)
  if (!jwk.x || !jwk.y) throw new Error('VAPID private key did not include public coordinates')
  const x = urlBase64ToBytes(jwk.x)
  const y = urlBase64ToBytes(jwk.y)
  if (x.byteLength !== 32 || y.byteLength !== 32) {
    throw new Error('VAPID public coordinates must be 32 bytes')
  }
  const raw = new Uint8Array(65)
  raw[0] = 4
  raw.set(x, 1)
  raw.set(y, 33)
  return toBase64Url(raw)
}

export async function verifyVapidJwt(token: string, publicKeyRaw: string) {
  const [header, payload, signature] = token.split('.')
  if (!header || !payload || !signature) return false
  const key = await crypto.subtle.importKey(
    'raw',
    urlBase64ToBytes(publicKeyRaw),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  )
  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    urlBase64ToBytes(signature),
    encoder.encode(`${header}.${payload}`),
  )
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
    exp: now + (options.expiresInSeconds ?? 12 * 60 * 60),
    sub: resolveVapidSubject(options.subject),
  }

  const unsigned = `${toBase64Url(encoder.encode(JSON.stringify(header)))}.${toBase64Url(
    encoder.encode(JSON.stringify(payload)),
  )}`
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    options.privateKey,
    encoder.encode(unsigned),
  )

  return `${unsigned}.${toBase64Url(ecdsaSignatureToJose(new Uint8Array(signature)))}`
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

function urlBase64ToBytes(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const binary = atob(padded + pad)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function fromBase64Url(value: string): string {
  return new TextDecoder().decode(urlBase64ToBytes(value))
}
