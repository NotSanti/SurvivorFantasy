import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { LoadingState } from '@/components/states/LoadingState'
import { ErrorState } from '@/components/states/ErrorState'
import { getSupabaseClient } from '@/lib/supabase'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = getSupabaseClient()
    const url = new URL(window.location.href)
    const code = url.searchParams.get('code')
    const tokenHash = url.searchParams.get('token_hash')
    const type = url.searchParams.get('type')
    const next =
      url.searchParams.get('next') ?? sessionStorage.getItem('kindling.auth.next')
    sessionStorage.removeItem('kindling.auth.next')
    let cancelled = false

    async function complete() {
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) throw exchangeError
      } else if (tokenHash) {
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type === 'signup' ? 'signup' : 'magiclink',
        })
        if (otpError) throw otpError
      }
      if (!cancelled) {
        navigate(next && next.startsWith('/') ? next : '/leagues', { replace: true })
      }
    }

    void complete().catch((cause: unknown) => {
      if (!cancelled) {
        setError(cause instanceof Error ? cause.message : 'Could not complete sign-in.')
      }
    })

    return () => {
      cancelled = true
    }
  }, [navigate])

  if (error) {
    return (
      <main className="mx-auto flex min-h-svh max-w-lg items-center px-4">
        <ErrorState title="Sign-in link failed" description={error} />
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-lg items-center px-4">
      <LoadingState label="Finishing sign-in" />
    </main>
  )
}
