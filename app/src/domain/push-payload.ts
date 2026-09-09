import { z } from 'zod'

export const pushPayloadSchema = z.object({
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(180),
  url: z
    .string()
    .min(1)
    .refine((value) => value.startsWith('/') && !value.startsWith('//'), {
      message: 'Push deep links must be same-origin paths',
    }),
  tag: z.string().min(1).max(80).optional(),
})

export type PushPayload = z.infer<typeof pushPayloadSchema>

export function parsePushPayload(data: unknown): PushPayload | null {
  const source =
    typeof data === 'string'
      ? safeJsonParse(data)
      : data && typeof data === 'object'
        ? data
        : null

  const result = pushPayloadSchema.safeParse(source)
  return result.success ? result.data : null
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

export function resolveSameOriginUrl(path: string, origin: string): string {
  const url = new URL(path, origin)
  if (url.origin !== origin) {
    return new URL('/', origin).toString()
  }
  return url.toString()
}
