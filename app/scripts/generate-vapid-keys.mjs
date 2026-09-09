#!/usr/bin/env node
/**
 * Prints a VAPID key pair for Kindling Web Push.
 * Put the public key in VITE_VAPID_PUBLIC_KEY.
 * Store the private key only in Supabase Edge secrets as VAPID_PRIVATE_KEY (PKCS8 url-safe base64).
 * Never commit the private key.
 */
const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
])
const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
const privatePkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))

function toUrlBase64(bytes) {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '')
}

console.log('VITE_VAPID_PUBLIC_KEY=' + toUrlBase64(publicRaw))
console.log('VAPID_PRIVATE_KEY=' + toUrlBase64(privatePkcs8))
console.log('VAPID_SUBJECT=mailto:you@example.com')
