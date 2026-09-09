export function urlBase64ToBytes(value: string) {
  const padded = value.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const binary = atob(padded + pad)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function bytesToUrlBase64(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function vapidPublicKeyBytes(publicKey: string) {
  const bytes = urlBase64ToBytes(publicKey.trim())
  if (bytes.byteLength < 65) {
    throw new Error('VAPID public key is not an uncompressed P-256 key')
  }
  return bytes
}
