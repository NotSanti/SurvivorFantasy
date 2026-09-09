import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ClientEnvError, isSupabaseConfigured } from '@/domain/env'
import { AuthContext, type AuthState } from '@/features/auth/auth-context'
import { readViteEnv } from '@/lib/client-env'
import { getSupabaseClient } from '@/lib/supabase'

export function AuthProvider({ children }: { children: ReactNode }) {
  const env = useMemo(() => readViteEnv(), [])
  const configured = isSupabaseConfigured(env)
  const [loading, setLoading] = useState(configured)
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!configured) return

    const supabase = getSupabaseClient()
    let cancelled = false

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (cancelled) return
      if (sessionError) setError(sessionError.message)
      setSession(data.session)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [configured])

  const value = useMemo<AuthState>(
    () => ({
      loading,
      configured,
      session,
      user: session?.user ?? null,
      error,
      async signInWithEmail(email: string) {
        if (!configured) {
          throw new ClientEnvError(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])
        }
        const supabase = getSupabaseClient()
        const next = new URLSearchParams(window.location.search).get('next')
        const redirect = new URL(`${window.location.origin}/auth/callback`)
        if (next?.startsWith('/')) {
          redirect.searchParams.set('next', next)
        }
        const { error: signInError } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirect.toString(), shouldCreateUser: true },
        })
        if (signInError) throw signInError
      },
      async signInWithPassword(email: string, password: string) {
        if (!configured) {
          throw new ClientEnvError(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])
        }
        const { error: signInError } = await getSupabaseClient().auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
      },
      async signOut() {
        if (!configured) return
        await getSupabaseClient().auth.signOut()
      },
    }),
    [configured, error, loading, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
