import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorState } from '@/components/states/ErrorState'
import { parseAltScores } from '@/domain/score-import/parse-results'
import { getSupabaseClient } from '@/lib/supabase'

export function AdminScoresSection() {
  const queryClient = useQueryClient()
  const [episodeNumber, setEpisodeNumber] = useState('2')
  const [altText, setAltText] = useState('')
  const preview = altText.trim() ? parseAltScores(altText) : null

  const runsQuery = useQuery({
    queryKey: ['admin-score-import-runs'],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('score_import_runs')
        .select('id, status, error_code, source_url, finished_at, summary')
        .order('started_at', { ascending: false })
        .limit(8)
      if (error) throw error
      return data
    },
  })

  const importNow = useMutation({
    mutationFn: async () => {
      const { data, error } = await getSupabaseClient().functions.invoke('import-scores', {
        body: {},
      })
      if (error) throw error
      return data as { status?: string; detail?: string; code?: string }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-score-import-runs'] })
    },
  })

  const recover = useMutation({
    mutationFn: async () => {
      const { data, error } = await getSupabaseClient().functions.invoke('import-scores', {
        body: {
          recovery: {
            episodeNumber: Number(episodeNumber),
            altText,
          },
        },
      })
      if (error) throw error
      return data as { status?: string; detail?: string; code?: string }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-score-import-runs'] })
    },
  })

  return (
    <section className="space-y-3">
      <h2 className="font-medium">Episode scores</h2>
      <p className="text-sm text-muted-foreground">
        Import Global totals from accessible image alt text. Unknown names stay unpublished.
        Notification failures cannot roll back a successful publish.
      </p>
      <Button type="button" className="min-h-11" onClick={() => void importNow.mutateAsync()}>
        {importNow.isPending ? 'Checking scores…' : 'Check scores now'}
      </Button>
      {importNow.data ? (
        <Alert>
          <AlertTitle>{importNow.data.status ?? 'Import finished'}</AlertTitle>
          <AlertDescription>
            {importNow.data.detail ??
              (importNow.data.code === 'not_published_yet'
                ? 'Season 51 results are not published yet.'
                : 'Import finished.')}
          </AlertDescription>
        </Alert>
      ) : null}
      {importNow.error ? (
        <ErrorState
          description={importNow.error instanceof Error ? importNow.error.message : 'Import failed.'}
        />
      ) : null}

      <div className="space-y-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
        <h3 className="text-sm font-medium">Manual recovery</h3>
        <p className="text-sm text-muted-foreground">
          Paste one episode&apos;s alt text, review the parsed diff, then confirm. This still
          creates a new revision.
        </p>
        <Label htmlFor="recover-episode">Episode number</Label>
        <Input
          id="recover-episode"
          className="min-h-11"
          inputMode="numeric"
          value={episodeNumber}
          onChange={(event) => setEpisodeNumber(event.target.value)}
        />
        <Label htmlFor="recover-alt">Alt text</Label>
        <textarea
          id="recover-alt"
          className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          value={altText}
          onChange={(event) => setAltText(event.target.value)}
        />
        {preview && preview.ok ? (
          <ul className="text-sm">
            {preview.scores.map((row) => (
              <li key={row.sourceName}>
                {row.sourceName}: {row.points}
              </li>
            ))}
          </ul>
        ) : null}
        {preview && !preview.ok ? (
          <p className="text-sm text-destructive">{preview.detail}</p>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          className="min-h-11"
          disabled={!preview?.ok || recover.isPending}
          onClick={() => void recover.mutateAsync()}
        >
          {recover.isPending ? 'Publishing…' : 'Confirm recovery publish'}
        </Button>
        {recover.data ? (
          <p className="text-sm text-muted-foreground">{recover.data.status}</p>
        ) : null}
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-medium">Recent imports</h3>
        {runsQuery.data?.length ? (
          <ul className="space-y-1 text-sm">
            {runsQuery.data.map((run) => (
              <li key={run.id}>
                {run.status}
                {run.error_code ? ` (${run.error_code})` : ''}
                {run.finished_at ? ` · ${new Date(run.finished_at).toLocaleString()}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No score imports yet.</p>
        )}
      </div>
    </section>
  )
}
