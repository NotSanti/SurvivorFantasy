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

export function ecdsaSignatureToJose(signature: Uint8Array) {
  if (signature.byteLength === 64) return signature
  return derEcdsaToP1363(signature)
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
  return concatFixed(r, s)
}

function concatFixed(r: Uint8Array, s: Uint8Array) {
  const out = new Uint8Array(64)
  out.set(r.subarray(Math.max(0, r.byteLength - 32)), 32 - Math.min(32, r.byteLength))
  out.set(s.subarray(Math.max(0, s.byteLength - 32)), 64 - Math.min(32, s.byteLength))
  return out
}

export async function generateVapidKeys(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  )
}

export async function createVapidJwt(options: {
  audience: string
  subject: string
  privateKey: CryptoKey
  expiresInSeconds?: number
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${toBase64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))}.${toBase64Url(
    encoder.encode(
      JSON.stringify({
        aud: options.audience,
        sub: resolveVapidSubject(options.subject),
        iat: now,
        exp: now + (options.expiresInSeconds ?? 12 * 60 * 60),
      }),
    ),
  )}`
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    options.privateKey,
    encoder.encode(unsigned),
  )
  return `${unsigned}.${toBase64Url(ecdsaSignatureToJose(new Uint8Array(signature)))}`
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '')
}
