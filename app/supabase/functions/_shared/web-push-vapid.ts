const encoder = new TextEncoder()

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
        sub: options.subject,
        exp: now + (options.expiresInSeconds ?? 12 * 60 * 60),
      }),
    ),
  )}`
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    options.privateKey,
    encoder.encode(unsigned),
  )
  return `${unsigned}.${toBase64Url(new Uint8Array(signature))}`
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '')
}
