import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getSupabaseClient } from '@/lib/supabase'
import { writeActiveLeagueId } from '@/features/league/active-league-storage'

export function CreateLeaguePage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [maxMembers, setMaxMembers] = useState(8)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const { data, error: rpcError } = await getSupabaseClient().rpc('create_league', {
      p_name: name,
      p_max_members: maxMembers,
    })
    setSaving(false)
    if (rpcError || !data) {
      setError(rpcError?.message ?? 'Could not create the league.')
      return
    }
    navigate(`/leagues/${data.id}`)
    writeActiveLeagueId(data.id)
  }

  return (
    <PageContainer>
      <h1 className="font-display text-2xl font-semibold">Create a league</h1>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="league-name">League name</Label>
          <Input
            id="league-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={2}
            maxLength={40}
            className="min-h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="max-members">Max members (2–20)</Label>
          <Input
            id="max-members"
            type="number"
            min={2}
            max={20}
            value={maxMembers}
            onChange={(event) => setMaxMembers(Number(event.target.value))}
            className="min-h-11"
          />
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not create league</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" className="min-h-11 w-full" disabled={saving}>
          {saving ? 'Creating…' : 'Create private league'}
        </Button>
      </form>
    </PageContainer>
  )
}
