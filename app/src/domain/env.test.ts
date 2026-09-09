import { describe, expect, it } from 'vitest'
import {
  ClientEnvError,
  isSupabaseConfigured,
  parseClientEnv,
  requireSupabaseEnv,
} from './env'

describe('parseClientEnv', () => {
  it('defaults the product name and allows empty supabase keys during foundation setup', () => {
    const env = parseClientEnv({})
    expect(env.VITE_APP_NAME).toBe('Kindling')
    expect(env.VITE_SUPABASE_URL).toBeUndefined()
    expect(isSupabaseConfigured(env)).toBe(false)
  })

  it('rejects a malformed supabase url', () => {
    expect(() =>
      parseClientEnv({ VITE_SUPABASE_URL: 'not-a-url' }),
    ).toThrow(ClientEnvError)
  })

  it('treats blank strings as unset rather than invalid', () => {
    const env = parseClientEnv({
      VITE_SUPABASE_URL: '   ',
      VITE_SUPABASE_ANON_KEY: '',
    })
    expect(env.VITE_SUPABASE_URL).toBeUndefined()
    expect(env.VITE_SUPABASE_ANON_KEY).toBeUndefined()
  })
})

describe('requireSupabaseEnv', () => {
  it('lists every missing required client variable', () => {
    try {
      requireSupabaseEnv(parseClientEnv({}))
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(ClientEnvError)
      expect((error as ClientEnvError).missing).toEqual([
        'VITE_SUPABASE_URL',
        'VITE_SUPABASE_ANON_KEY',
      ])
    }
  })

  it('returns configured supabase values', () => {
    const required = requireSupabaseEnv(
      parseClientEnv({
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      }),
    )
    expect(required.VITE_SUPABASE_URL).toBe('http://127.0.0.1:54321')
  })
})
