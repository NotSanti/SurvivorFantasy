import { useState, type FormEvent } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ProductMark } from '@/components/brand/ProductMark'
import { useAuth } from '@/features/auth/use-auth'

export function WelcomePage() {
  const { user, configured, signInWithEmail, verifyEmailOtp } = useAuth()
  const [params] = useSearchParams()
  const next = params.get('next')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [status, setStatus] = useState<'idle' | 'sending' | 'verifying'>('idle')
  const [error, setError] = useState<string | null>(null)

  if (user) {
    return <Navigate to={next && next.startsWith('/') ? next : '/leagues'} replace />
  }

  async function onSendCode(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setStatus('sending')
    try {
      if (next?.startsWith('/')) {
        sessionStorage.setItem('sfl.auth.next', next)
      }
      const trimmed = email.trim()
      await signInWithEmail(trimmed)
      setEmail(trimmed)
      setOtp('')
      setStep('code')
      setStatus('idle')
    } catch (cause) {
      setStatus('idle')
      setError(cause instanceof Error ? cause.message : 'Could not send a sign-in code.')
    }
  }

  async function onVerifyCode(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const code = otp.trim()
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your email.')
      return
    }
    setStatus('verifying')
    try {
      await verifyEmailOtp(email.trim(), code)
    } catch (cause) {
      setStatus('idle')
      setError(cause instanceof Error ? cause.message : 'That code did not work. Try again.')
    }
  }

  async function onResend() {
    setError(null)
    setStatus('sending')
    try {
      await signInWithEmail(email.trim())
      setOtp('')
      setStatus('idle')
    } catch (cause) {
      setStatus('idle')
      setError(cause instanceof Error ? cause.message : 'Could not resend the code.')
    }
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-between px-4 py-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="space-y-4">
        <p className="text-sm font-medium tracking-[0.2em] text-ember uppercase">
          Private fantasy camp
        </p>
        <h1 className="font-display text-4xl leading-tight font-semibold">
          <ProductMark />
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
        ) : step === 'email' ? (
          <form className="space-y-3" onSubmit={(event) => void onSendCode(event)}>
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
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Sign-in failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" className="min-h-11 w-full" disabled={status === 'sending'}>
              {status === 'sending' ? 'Sending code…' : 'Email me a code'}
            </Button>
            <p className="text-xs text-muted-foreground">
              Works in the home-screen app: enter the code here after it arrives. A magic link
              still works in a normal browser tab.
            </p>
          </form>
        ) : (
          <form className="space-y-3" onSubmit={(event) => void onVerifyCode(event)}>
            <Alert>
              <AlertTitle>Check your email</AlertTitle>
              <AlertDescription>
                Enter the 6-digit code sent to <span className="font-medium">{email}</span>. Stay
                in this app after you copy it.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="otp">Sign-in code</Label>
              <Input
                id="otp"
                name="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                required
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                className="min-h-11 tracking-[0.3em]"
                autoFocus
              />
            </div>
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Could not verify</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" className="min-h-11 w-full" disabled={status === 'verifying'}>
              {status === 'verifying' ? 'Verifying…' : 'Verify and sign in'}
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 flex-1"
                disabled={status !== 'idle'}
                onClick={() => void onResend()}
              >
                {status === 'sending' ? 'Resending…' : 'Resend code'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 flex-1"
                disabled={status !== 'idle'}
                onClick={() => {
                  setStep('email')
                  setOtp('')
                  setError(null)
                  setStatus('idle')
                }}
              >
                Different email
              </Button>
            </div>
          </form>
        )}
      </div>
    </main>
  )
}
