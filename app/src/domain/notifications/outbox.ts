export const OUTBOX_MAX_ATTEMPTS = 8

const BACKOFF_SECONDS = [60, 120, 240, 480, 900, 1800, 3600]

export function shouldDeadLetter(attemptCount: number) {
  return attemptCount >= OUTBOX_MAX_ATTEMPTS
}

export function nextOutboxAvailableAt(attemptCount: number, now: Date) {
  const index = Math.max(0, Math.min(BACKOFF_SECONDS.length - 1, attemptCount - 1))
  return new Date(now.getTime() + BACKOFF_SECONDS[index] * 1000)
}

export function redactOutboxError(message: string) {
  return message
    .replace(/https?:\/\/[^\s]+/gi, '[endpoint]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted]')
    .replace(/vapid[^\s]*/gi, '[credential]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [credential]')
    .slice(0, 280)
}
