import { useState, type FormEvent } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { DisclaimerBanner } from '@/components/layout/DisclaimerBanner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PRODUCT_NAME } from '@/domain/product'
import { useAuth } from '@/features/auth/use-auth'

export function WelcomePage() {
  const { user, configured, signInWithEmail, signInWithPassword } = useAuth()
  const [params] = useSearchParams()
  const next = params.get('next')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  if (user) {
    return <Navigate to={next && next.startsWith('/') ? next : '/leagues'} replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setStatus('sending')
    try {
      if (next?.startsWith('/')) {
        sessionStorage.setItem('kindling.auth.next', next)
      }
      if (password) {
        await signInWithPassword(email.trim(), password)
        return
      }
      await signInWithEmail(email.trim())
      setStatus('sent')
    } catch (cause) {
      setStatus('idle')
      setError(cause instanceof Error ? cause.message : 'Could not send a sign-in link.')
    }
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-between px-4 py-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="space-y-4">
        <p className="text-sm font-medium tracking-[0.2em] text-ember uppercase">
          Private fantasy camp
        </p>
        <h1 className="font-display text-4xl leading-tight font-semibold text-foreground">
          {PRODUCT_NAME}
        </h1>
        <p className="max-w-prose text-base text-muted-foreground">
          Pick your tribe, lock a league with friends, and follow Global&apos;s weekly
          scores. No public leaderboards. No official affiliation.
        </p>
      </div>
      <div className="space-y-4">
        {!configured ? (
          <Alert>
            <AlertTitle>Local configuration needed</AlertTitle>
            <AlertDescription>
              Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and
              `VITE_SUPABASE_ANON_KEY`.
            </AlertDescription>
          </Alert>
        ) : (
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password (optional)</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="min-h-11"
              />
            </div>
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Sign-in failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {status === 'sent' ? (
              <Alert>
                <AlertTitle>Check your email</AlertTitle>
                <AlertDescription>
                  If an account exists or can be created, a magic link is on the way. Local
                  development uses Mailpit at port 55424.
                </AlertDescription>
              </Alert>
            ) : (
              <Button type="submit" className="min-h-11 w-full" disabled={status === 'sending'}>
                {status === 'sending' ? 'Signing in…' : password ? 'Sign in' : 'Email me a sign-in link'}
              </Button>
            )}
          </form>
        )}
        <DisclaimerBanner />
      </div>
    </main>
  )
}
