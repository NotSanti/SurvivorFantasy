import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorState } from '@/components/states/ErrorState'
import { KNOWN_SCORING_RULES } from '@/domain/rules-sync/types'
import {
  parseBreakdownCsv,
  resolveBreakdownCsv,
} from '@/domain/score-breakdown/parse-breakdown-csv'
import type {
  BreakdownCastawayProposal,
  BreakdownLine,
  BreakdownProposal,
} from '@/domain/score-breakdown/types'
import { getSupabaseClient } from '@/lib/supabase'

const CSV_TEMPLATE = `episode,castaway,category,points
8,An,Cried on Camera,5
8,An,Survived the Week,3
8,Carter,Got an Advantage,5
8,Carter,Survived the Week,3
`

function emptyProposal(): BreakdownProposal {
  return { castaways: [] }
}

export function AdminBreakdownReview() {
  const queryClient = useQueryClient()
  const [episodeNumber, setEpisodeNumber] = useState('2')
  const [csvText, setCsvText] = useState('')
  const [draft, setDraft] = useState<BreakdownProposal>(emptyProposal())
  const [unmappedLabels, setUnmappedLabels] = useState<string[]>([])
  const [parseError, setParseError] = useState<string | null>(null)

  const seasonQuery = useQuery({
    queryKey: ['admin-season-51'],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('seasons')
        .select('id, number')
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
        .select('id, display_name')
        .eq('season_id', seasonQuery.data!.id)
        .order('display_name')
      if (error) throw error
      return data
    },
  })

  const aliasesQuery = useQuery({
    queryKey: ['admin-aliases', seasonQuery.data?.id],
    enabled: Boolean(seasonQuery.data?.id),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('castaway_source_aliases')
        .select('normalized_source_name, castaway_id')
        .eq('season_id', seasonQuery.data!.id)
      if (error) throw error
      return data
    },
  })

  const publishedQuery = useQuery({
    queryKey: ['admin-published-scores', seasonQuery.data?.id, episodeNumber],
    enabled: Boolean(seasonQuery.data?.id) && Number(episodeNumber) > 0,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('published_castaway_episode_scores')
        .select('castaway_id, points_total')
        .eq('season_id', seasonQuery.data!.id)
        .eq('episode_number', Number(episodeNumber))
      if (error) throw error
      return data
    },
  })

  const reviewsQuery = useQuery({
    queryKey: ['admin-score-breakdown-reviews'],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('score_breakdown_reviews')
        .select('id, episode_number, status, updated_at')
        .order('episode_number', { ascending: false })
        .limit(12)
      if (error) throw error
      return data
    },
  })

  const importedTotals = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of publishedQuery.data ?? []) {
      if (row.castaway_id != null && row.points_total != null) {
        map.set(row.castaway_id, row.points_total)
      }
    }
    return map
  }, [publishedQuery.data])

  const applyCsv = async () => {
    setParseError(null)
    const parsed = parseBreakdownCsv(csvText)
    if (!parsed.ok) {
      setDraft(emptyProposal())
      setUnmappedLabels([])
      setParseError(parsed.detail)
      return
    }

    let episode = Number(episodeNumber)
    if (parsed.episodeNumbers.length === 1) {
      episode = parsed.episodeNumbers[0]!
      setEpisodeNumber(String(episode))
    }
    if (!Number.isInteger(episode) || episode <= 0) {
      setParseError('Enter a valid episode number (or include an episode column in the CSV).')
      return
    }

    let totals = importedTotals
    if (seasonQuery.data?.id) {
      const { data: publishedRows, error } = await getSupabaseClient()
        .from('published_castaway_episode_scores')
        .select('castaway_id, points_total')
        .eq('season_id', seasonQuery.data.id)
        .eq('episode_number', episode)
      if (error) {
        setParseError(error.message)
        return
      }
      totals = new Map()
      for (const row of publishedRows ?? []) {
        if (row.castaway_id != null && row.points_total != null) {
          totals.set(row.castaway_id, row.points_total)
        }
      }
    }

    const resolved = resolveBreakdownCsv({
      rows: parsed.rows,
      episodeNumber: episode,
      aliases: (aliasesQuery.data ?? []).map((row) => ({
        normalizedSourceName: row.normalized_source_name,
        castawayId: row.castaway_id,
      })),
      castaways: (castawaysQuery.data ?? []).map((row) => ({
        id: row.id,
        displayName: row.display_name,
      })),
      importedTotals: totals,
    })

    if (!resolved.ok) {
      setDraft(emptyProposal())
      setUnmappedLabels([])
      setParseError(resolved.detail)
      return
    }

    setDraft(resolved.proposal)
    setUnmappedLabels(resolved.unmappedLabels)
  }

  const confirm = useMutation({
    mutationFn: async () => {
      if (!seasonQuery.data?.id) throw new Error('Season missing')
      const unmapped = draft.castaways.flatMap((castaway) =>
        castaway.lines.filter((line) => !line.rule_code),
      )
      if (unmapped.length > 0) {
        throw new Error('Map every breakdown line to a scoring rule before confirming.')
      }
      if (draft.castaways.length === 0) {
        throw new Error('Parse a CSV first.')
      }

      const events = draft.castaways.map((castaway) => ({
        castaway_id: castaway.castaway_id,
        lines: castaway.lines.map((line) => ({
          rule_code: line.rule_code,
          points: line.points,
          occurrences: line.occurrences ?? 1,
          evidence_note: line.source_label ?? null,
        })),
      }))

      await getSupabaseClient().rpc('upsert_score_breakdown_review', {
        p_season_id: seasonQuery.data.id,
        p_episode_number: Number(episodeNumber),
        p_source_image_url: null,
        p_proposal: draft,
      })

      const { data, error } = await getSupabaseClient().rpc('publish_score_events', {
        p_season_id: seasonQuery.data.id,
        p_episode_number: Number(episodeNumber),
        p_events: events,
      })
      if (error) {
        throw new Error(error.message || error.code || 'publish_score_events failed')
      }
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-score-breakdown-reviews'] })
      void queryClient.invalidateQueries({ queryKey: ['published-score-events'] })
      void queryClient.invalidateQueries({ queryKey: ['member-episode-castaway-scores'] })
    },
  })

  const reject = useMutation({
    mutationFn: async () => {
      if (!seasonQuery.data?.id) throw new Error('Season missing')
      const { data, error } = await getSupabaseClient().rpc('reject_score_breakdown_review', {
        p_season_id: seasonQuery.data.id,
        p_episode_number: Number(episodeNumber),
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-score-breakdown-reviews'] })
    },
  })

  const updateLine = (
    castawayIndex: number,
    lineIndex: number,
    patch: Partial<BreakdownLine>,
  ) => {
    setDraft((prev) => {
      const castaways = prev.castaways.map((castaway, cIdx) => {
        if (cIdx !== castawayIndex) return castaway
        const lines = castaway.lines.map((line, lIdx) =>
          lIdx === lineIndex ? { ...line, ...patch } : line,
        )
        const lineSum = lines.reduce((sum, line) => sum + line.points, 0)
        return {
          ...castaway,
          lines,
          line_sum: lineSum,
          total_mismatch:
            importedTotals.has(castaway.castaway_id) &&
            lineSum !== importedTotals.get(castaway.castaway_id),
        }
      })
      return { castaways }
    })
  }

  const setLineRule = (castawayIndex: number, lineIndex: number, ruleCode: string) => {
    const rule = KNOWN_SCORING_RULES.find((row) => row.code === ruleCode)
    updateLine(castawayIndex, lineIndex, {
      rule_code: ruleCode || null,
      label: rule?.label ?? draft.castaways[castawayIndex]?.lines[lineIndex]?.label ?? '',
      points: rule?.points ?? draft.castaways[castawayIndex]?.lines[lineIndex]?.points ?? 0,
    })
  }

  const onFile = async (file: File | null) => {
    if (!file) return
    const text = await file.text()
    setCsvText(text)
  }

  return (
    <div className="space-y-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
      <h3 className="text-sm font-medium">Episode point breakdowns</h3>
      <p className="text-sm text-muted-foreground">
        Upload or paste a CSV of category lines per castaway, review the mapping, then confirm.
        Totals from Global alt-text import stay authoritative.
      </p>

      <div className="rounded-lg bg-background/50 p-2 text-xs text-muted-foreground ring-1 ring-foreground/10">
        <p className="mb-1 font-medium text-foreground">CSV format</p>
        <pre className="overflow-x-auto whitespace-pre-wrap">{CSV_TEMPLATE.trim()}</pre>
        <p className="mt-1">
          Optional columns: <code>rule_code</code>, <code>occurrences</code>. Category labels are
          matched to scoring rules automatically when possible.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="breakdown-episode">Episode</Label>
          <Input
            id="breakdown-episode"
            className="min-h-11 w-24"
            inputMode="numeric"
            value={episodeNumber}
            onChange={(event) => setEpisodeNumber(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="breakdown-file">CSV file</Label>
          <Input
            id="breakdown-file"
            type="file"
            accept=".csv,text/csv,text/plain"
            className="min-h-11 max-w-xs"
            onChange={(event) => void onFile(event.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="breakdown-csv">CSV text</Label>
        <textarea
          id="breakdown-csv"
          className="min-h-32 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
          value={csvText}
          onChange={(event) => setCsvText(event.target.value)}
          placeholder={CSV_TEMPLATE.trim()}
        />
      </div>

      <Button
        type="button"
        className="min-h-11"
        disabled={!csvText.trim() || aliasesQuery.isLoading || castawaysQuery.isLoading}
        onClick={() => void applyCsv()}
      >
        Parse CSV
      </Button>

      {parseError ? <ErrorState description={parseError} /> : null}
      {unmappedLabels.length > 0 ? (
        <Alert>
          <AlertTitle>Unmapped categories</AlertTitle>
          <AlertDescription>
            Pick a scoring rule for: {unmappedLabels.join(', ')}
          </AlertDescription>
        </Alert>
      ) : null}

      {draft.castaways.length > 0 ? (
        <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
          {draft.castaways.map((castaway: BreakdownCastawayProposal, castawayIndex) => (
            <div
              key={castaway.castaway_id}
              className="space-y-2 rounded-lg bg-background/60 p-2 ring-1 ring-foreground/10"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-medium">{castaway.display_name}</p>
                <p className="tabular-nums text-sm text-muted-foreground">
                  lines {castaway.line_sum ?? 0}
                  {importedTotals.has(castaway.castaway_id)
                    ? ` · imported ${importedTotals.get(castaway.castaway_id)}`
                    : ''}
                  {castaway.total_mismatch ? (
                    <span className="ml-2 text-destructive">mismatch</span>
                  ) : null}
                </p>
              </div>
              <ul className="space-y-2">
                {castaway.lines.map((line, lineIndex) => (
                  <li key={`${castaway.castaway_id}-${lineIndex}`} className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Source: {line.source_label ?? line.label} ({line.points > 0 ? '+' : ''}
                      {line.points})
                    </p>
                    <select
                      className="min-h-10 w-full rounded-lg border border-input bg-background px-2 text-sm"
                      value={line.rule_code ?? ''}
                      onChange={(event) =>
                        setLineRule(castawayIndex, lineIndex, event.target.value)
                      }
                    >
                      <option value="">Unmapped — pick a rule</option>
                      {KNOWN_SCORING_RULES.map((rule) => (
                        <option key={rule.code} value={rule.code}>
                          {rule.points} · {rule.label}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      {draft.castaways.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="min-h-11"
            disabled={confirm.isPending}
            onClick={() => void confirm.mutateAsync()}
          >
            {confirm.isPending ? 'Publishing…' : 'Confirm breakdown'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            disabled={reject.isPending}
            onClick={() => void reject.mutateAsync()}
          >
            {reject.isPending ? 'Rejecting…' : 'Reject review'}
          </Button>
        </div>
      ) : null}

      {confirm.error ? (
        <ErrorState
          description={
            confirm.error instanceof Error ? confirm.error.message : 'Confirm failed.'
          }
        />
      ) : null}
      {confirm.isSuccess ? (
        <p className="text-sm text-muted-foreground">Breakdown published for this episode.</p>
      ) : null}

      <div className="space-y-1">
        <h4 className="text-sm font-medium">Recent breakdown reviews</h4>
        {reviewsQuery.data?.length ? (
          <ul className="space-y-1 text-sm">
            {reviewsQuery.data.map((review) => (
              <li key={review.id}>
                Episode {review.episode_number} · {review.status}
                {review.updated_at
                  ? ` · ${new Date(review.updated_at).toLocaleString()}`
                  : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No breakdown reviews yet.</p>
        )}
      </div>
    </div>
  )
}
