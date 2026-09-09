const encoder = new TextEncoder()

export function pushCopyFromOutbox(eventType: string, payload: Record<string, unknown>) {
  const route =
    typeof payload.route === 'string' && payload.route.startsWith('/') && !payload.route.startsWith('//')
      ? payload.route
      : eventType === 'merge_window'
        ? '/league/merge'
        : '/standings'
  const episodeNumber = typeof payload.episode_number === 'number' ? payload.episode_number : null
  if (eventType === 'score_corrections' && episodeNumber != null) {
    return {
      title: `Episode ${episodeNumber} totals were updated`,
      body: 'Open Kindling to see your tribe score.',
      url: route,
      tag: eventType,
    }
  }
  if ((eventType === 'scores_published' || eventType === 'scores') && episodeNumber != null) {
    return {
      title: `Episode ${episodeNumber} scores are in`,
      body: 'Open Kindling to see your tribe score.',
      url: route,
      tag: eventType,
    }
  }
  if (eventType === 'merge_window') {
    return {
      title: 'Merge window is open',
      body: 'Your one add or swap starts next episode.',
      url: route,
      tag: eventType,
    }
  }
  if (typeof payload.title === 'string' && typeof payload.body === 'string') {
    return { title: payload.title, body: payload.body, url: route, tag: eventType }
  }
  return {
    title: 'Kindling update',
    body: 'Open Kindling for the latest from your camp.',
    url: route,
    tag: eventType,
  }
}

export function urlBase64ToBytes(value: string) {
  const padded = value.replaceAll(/\s+/g, '').replaceAll('-', '+').replaceAll('_', '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const binary = atob(padded + pad)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function bytesToUrlBase64(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '')
}

function concat(chunks: Uint8Array[]) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const out = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

async function hkdf(ikm: BufferSource, salt: BufferSource, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8),
  )
}

export async function encryptWebPush(input: {
  payload: string
  p256dh: string
  auth: string
}) {
  const uaPublic = urlBase64ToBytes(input.p256dh)
  const authSecret = urlBase64ToBytes(input.auth)
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey))
  const userKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: userKey }, local.privateKey, 256)
  const keyInfo = concat([encoder.encode('WebPush: info'), new Uint8Array([0]), uaPublic, asPublic])
  const ikm = await hkdf(shared, authSecret, keyInfo, 32)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(ikm, salt, concat([encoder.encode('Content-Encoding: aes128gcm'), new Uint8Array([0])]), 16)
  const nonce = await hkdf(ikm, salt, concat([encoder.encode('Content-Encoding: nonce'), new Uint8Array([0])]), 12)
  const padded = concat([encoder.encode(input.payload), new Uint8Array([2])])
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded),
  )
  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, 4096)
  return concat([salt, rs, new Uint8Array([asPublic.byteLength]), asPublic, ciphertext])
}
