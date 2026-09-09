import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getSupabaseClient } from '@/lib/supabase'

export function AdminMergeSection() {
  const queryClient = useQueryClient()
  const [mergeEpisode, setMergeEpisode] = useState('')
  const [bootEpisode, setBootEpisode] = useState('')
  const [bootId, setBootId] = useState('')

  const seasonQuery = useQuery({
    queryKey: ['admin-season-51'],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('seasons')
        .select('id, merge_episode_number, finale_episode_number')
        .eq('number', 51)
        .single()
      if (error) throw error
      return data
    },
  })

  const castawaysQuery = useQuery({
    queryKey: ['admin-castaways', seasonQuery.data?.id],
    enabled: Boolean(seasonQuery.data?.id),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('castaways')
        .select('id, display_name, status, eliminated_episode_number')
        .eq('season_id', seasonQuery.data!.id)
        .order('display_name')
      if (error) throw error
      return data
    },
  })

  const setMerge = useMutation({
    mutationFn: async () => {
      const { error } = await getSupabaseClient().rpc('set_season_merge_episode', {
        p_season_id: seasonQuery.data!.id,
        p_episode_number: Number(mergeEpisode),
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-season-51'] })
      void queryClient.invalidateQueries({ queryKey: ['season'] })
      void queryClient.invalidateQueries({ queryKey: ['leagues'] })
    },
  })

  const markBoot = useMutation({
    mutationFn: async () => {
      const { error } = await getSupabaseClient().rpc('mark_castaway_eliminated', {
        p_castaway_id: bootId,
        p_episode_number: Number(bootEpisode),
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-castaways'] })
      void queryClient.invalidateQueries({ queryKey: ['castaways'] })
      void queryClient.invalidateQueries({ queryKey: ['roster'] })
    },
  })

  return (
    <section className="space-y-3">
      <h2 className="font-medium">Merge and boots</h2>
      <p className="text-sm text-muted-foreground">
        Record the merge episode and boots only after they are confirmed. Kindling will not guess
        them. Merge picks start scoring the following episode.
      </p>
      <p className="text-sm">
        Current merge episode:{' '}
        {seasonQuery.data?.merge_episode_number ?? 'not confirmed'}
      </p>
      <div className="space-y-2">
        <Label htmlFor="merge-episode">Merge episode number</Label>
        <Input
          id="merge-episode"
          type="number"
          min={1}
          value={mergeEpisode}
          onChange={(event) => setMergeEpisode(event.target.value)}
          className="min-h-11"
        />
        <Button
          type="button"
          className="min-h-11"
          disabled={!mergeEpisode || setMerge.isPending}
          onClick={() => void setMerge.mutateAsync()}
        >
          {setMerge.isPending ? 'Saving…' : 'Confirm merge episode'}
        </Button>
      </div>
      {setMerge.error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not set merge</AlertTitle>
          <AlertDescription>
            {setMerge.error instanceof Error ? setMerge.error.message : 'Try again.'}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="boot-castaway">Mark eliminated</Label>
        <select
          id="boot-castaway"
          className="min-h-11 w-full rounded-md border bg-background px-3"
          value={bootId}
          onChange={(event) => setBootId(event.target.value)}
        >
          <option value="">Select a castaway</option>
          {(castawaysQuery.data ?? []).map((row) => (
            <option key={row.id} value={row.id}>
              {row.display_name}
              {row.eliminated_episode_number ? ` · out ep ${row.eliminated_episode_number}` : ''}
            </option>
          ))}
        </select>
        <Label htmlFor="boot-episode">Boot episode</Label>
        <Input
          id="boot-episode"
          type="number"
          min={1}
          value={bootEpisode}
          onChange={(event) => setBootEpisode(event.target.value)}
          className="min-h-11"
        />
        <Button
          type="button"
          variant="secondary"
          className="min-h-11"
          disabled={!bootId || !bootEpisode || markBoot.isPending}
          onClick={() => void markBoot.mutateAsync()}
        >
          {markBoot.isPending ? 'Saving…' : 'Mark eliminated'}
        </Button>
      </div>
    </section>
  )
}
