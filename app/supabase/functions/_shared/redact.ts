const INVITE_TOKEN = /([?&]token=)[A-Fa-f0-9]{16,}/gi
const JWT = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const URL = /https?:\/\/[^\s]+/gi

export function redactForLog(value: string): string {
  return value
    .replace(INVITE_TOKEN, '$1[token]')
    .replace(JWT, '[jwt]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [credential]')
    .replace(/vapid[^\s]*/gi, '[credential]')
    .replace(EMAIL, '[redacted]')
    .replace(URL, '[url]')
    .slice(0, 280)
}

export function containsInviteTokenLeak(value: string): boolean {
  return /[?&]token=[A-Fa-f0-9]{32,}/i.test(value)
}

export function requestIdFrom(request: Request): string {
  return request.headers.get('x-request-id') ?? crypto.randomUUID()
}

export function logEvent(event: string, fields: Record<string, unknown>) {
  const safe: Record<string, unknown> = { event, ts: new Date().toISOString() }
  for (const [key, value] of Object.entries(fields)) {
    safe[key] = typeof value === 'string' ? redactForLog(value) : value
  }
  console.log(JSON.stringify(safe))
}
