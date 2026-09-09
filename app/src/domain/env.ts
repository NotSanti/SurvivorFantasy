import { z } from 'zod'

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === '' ? undefined : value))
  .pipe(z.string().url().optional())

const optionalKey = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === '' ? undefined : value))

export const clientEnvSchema = z.object({
  VITE_APP_NAME: z.string().trim().min(1).default('Kindling'),
  VITE_SUPABASE_URL: optionalUrl,
  VITE_SUPABASE_ANON_KEY: optionalKey,
  VITE_VAPID_PUBLIC_KEY: optionalKey,
})

export type ClientEnv = z.infer<typeof clientEnvSchema>
export type ClientEnvInput = Record<string, string | undefined>

export class ClientEnvError extends Error {
  readonly missing: string[]

  constructor(missing: string[], message?: string) {
    super(
      message ??
        `Missing required client environment variables: ${missing.join(', ')}. Copy .env.example to .env.local and fill the named keys.`,
    )
    this.name = 'ClientEnvError'
    this.missing = missing
  }
}

export function parseClientEnv(source: ClientEnvInput): ClientEnv {
  const result = clientEnvSchema.safeParse({
    VITE_APP_NAME: source.VITE_APP_NAME || 'Kindling',
    VITE_SUPABASE_URL: source.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: source.VITE_SUPABASE_ANON_KEY,
    VITE_VAPID_PUBLIC_KEY: source.VITE_VAPID_PUBLIC_KEY,
  })

  if (!result.success) {
    const missing = result.error.issues.map(
      (issue) => issue.path.join('.') || 'unknown',
    )
    throw new ClientEnvError(
      missing,
      `Invalid client environment variables: ${result.error.issues
        .map((issue) => `${issue.path.join('.') || 'unknown'}: ${issue.message}`)
        .join('; ')}`,
    )
  }

  return result.data
}

export function isSupabaseConfigured(env: ClientEnv): boolean {
  return Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY)
}

export function requireSupabaseEnv(env: ClientEnv): {
  VITE_SUPABASE_URL: string
  VITE_SUPABASE_ANON_KEY: string
} {
  const url = env.VITE_SUPABASE_URL
  const anonKey = env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    const missing: string[] = []
    if (!url) missing.push('VITE_SUPABASE_URL')
    if (!anonKey) missing.push('VITE_SUPABASE_ANON_KEY')
    throw new ClientEnvError(missing)
  }

  return {
    VITE_SUPABASE_URL: url,
    VITE_SUPABASE_ANON_KEY: anonKey,
  }
}
