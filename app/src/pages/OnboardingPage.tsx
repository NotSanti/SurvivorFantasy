import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useAuth } from '@/features/auth/use-auth'
import { getSupabaseClient } from '@/lib/supabase'

export function OnboardingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const from = (location.state as { from?: string } | null)?.from ?? '/leagues'
  const [name, setName] = useState(() => user?.email?.split('@')[0]?.slice(0, 40) ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const { data, error: rpcError } = await getSupabaseClient().rpc('complete_onboarding', {
      p_display_name: name,
    })
    setSaving(false)
    if (rpcError || !data) {
      setError(rpcError?.message ?? 'Could not save your camp name.')
      return
    }
    queryClient.setQueryData(['profile', user?.id], data)
    navigate(from, { replace: true })
  }

  return (
    <main className="min-h-svh">
      <PageContainer className="justify-center py-12">
        <h1 className="font-display text-2xl font-semibold">Choose a camp name</h1>
        <p className="text-sm text-muted-foreground">
          Other league members will see this after you join. You can change it later.
        </p>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              value={name}
              minLength={2}
              maxLength={40}
              required
              onChange={(event) => setName(event.target.value)}
              className="min-h-11"
            />
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Could not save</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" className="min-h-11 w-full" disabled={saving}>
            {saving ? 'Saving…' : 'Continue'}
          </Button>
        </form>
      </PageContainer>
    </main>
  )
}
