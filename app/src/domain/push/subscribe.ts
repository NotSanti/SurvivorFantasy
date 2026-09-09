import { bytesToUrlBase64, vapidPublicKeyBytes } from '@/domain/web-push/keys'

export type SerializedPushSubscription = {
  endpoint: string
  p256dh: string
  auth: string
}

export function clientErrorMessage(cause: unknown, fallback: string) {
  if (cause instanceof Error && cause.message.trim()) return cause.message
  if (typeof cause === 'object' && cause && 'message' in cause) {
    const message = Reflect.get(cause, 'message')
    if (typeof message === 'string' && message.trim()) return message
  }
  return fallback
}

export function vapidApplicationServerKey(publicKey: string) {
  const bytes = vapidPublicKeyBytes(publicKey)
  return new Uint8Array(bytes.subarray(0, 65))
}

export function serializePushSubscription(subscription: {
  endpoint: string
  toJSON?: () => { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  getKey?: (name: 'p256dh' | 'auth') => ArrayBuffer | null
}): SerializedPushSubscription {
  const json = subscription.toJSON?.() ?? {}
  const p256dh =
    json.keys?.p256dh ??
    encodeKey(subscription.getKey?.('p256dh') ?? null)
  const auth = json.keys?.auth ?? encodeKey(subscription.getKey?.('auth') ?? null)
  const endpoint = json.endpoint ?? subscription.endpoint
  if (!endpoint || !p256dh || !auth) {
    throw new Error('The browser did not return a complete subscription.')
  }
  return { endpoint, p256dh, auth }
}

function encodeKey(value: ArrayBuffer | ArrayBufferView | null) {
  if (!value) return ''
  const bytes =
    value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  return bytesToUrlBase64(bytes)
}

export async function ensurePushSubscription(
  registration: {
    pushManager: {
      getSubscription: () => Promise<PushSubscription | null>
      subscribe: (options: PushSubscriptionOptionsInit) => Promise<PushSubscription>
    }
  },
  publicKey: string,
) {
  const existing = await registration.pushManager.getSubscription()
  if (existing) return existing
  try {
    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidApplicationServerKey(publicKey),
    })
  } catch (cause) {
    const fallback = await registration.pushManager.getSubscription()
    if (fallback) return fallback
    throw cause
  }
}

export async function waitForPushRegistration(timeoutMs = 12_000) {
  if (!('serviceWorker' in navigator)) {
    throw new Error('This browser does not support Web Push.')
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Kindling is still installing. Wait a moment and tap again.'))
    }, timeoutMs)
  })
  try {
    return await Promise.race([navigator.serviceWorker.ready, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
