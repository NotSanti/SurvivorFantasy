export type CronAuthResult = { ok: true } | { ok: false; code: 'missing_secret' | 'forged' }

function bytesOf(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

export function authorizeCronRequest(input: {
  expectedSecret: string | undefined
  providedSecret: string | null
}): CronAuthResult {
  if (!input.expectedSecret) return { ok: false, code: 'missing_secret' }
  if (!input.providedSecret) return { ok: false, code: 'forged' }

  const expected = bytesOf(input.expectedSecret)
  const provided = bytesOf(input.providedSecret)
  const length = Math.max(expected.length, provided.length)
  let diff = expected.length === provided.length ? 0 : 1
  for (let index = 0; index < length; index += 1) {
    diff |= (expected[index] ?? 0) ^ (provided[index] ?? 0)
  }
  return diff === 0 ? { ok: true } : { ok: false, code: 'forged' }
}
