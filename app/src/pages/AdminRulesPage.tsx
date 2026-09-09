import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageContainer } from '@/components/layout/PageContainer'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { diffRuleSets } from '@/domain/rules-sync/diff-rules'
import type { ProposedRuleSet } from '@/domain/rules-sync/types'
import { getSupabaseClient } from '@/lib/supabase'
import { AdminScoresSection } from '@/features/admin/AdminScoresSection'
import { AdminMergeSection } from '@/features/admin/AdminMergeSection'
import { AdminPushSection } from '@/features/admin/AdminPushSection'
import { AdminHealthSection } from '@/features/admin/AdminHealthSection'

function toProposed(ruleSet: {
  roster_size: number
  wildcard_slots: number
  first_scored_episode: number
  picks_per_original_tribe: ProposedRuleSet['picksPerOriginalTribe']
  scoring_rules: Array<{
    code: string
    label: string
    points: number
    kind: ProposedRuleSet['scoringRules'][number]['kind']
    phase: ProposedRuleSet['scoringRules'][number]['phase']
    max_occurrences_per_castaway_episode: number | null
    sort_order: number
  }>
}): ProposedRuleSet {
  return {
    rosterSize: ruleSet.roster_size,
    wildcardSlots: ruleSet.wildcard_slots,
    firstScoredEpisode: ruleSet.first_scored_episode,
    picksPerOriginalTribe: ruleSet.picks_per_original_tribe,
    scoringRules: ruleSet.scoring_rules.map((rule) => ({
      code: rule.code,
      label: rule.label,
      points: rule.points,
      kind: rule.kind,
      phase: rule.phase,
      maxOccurrencesPerCastawayEpisode: rule.max_occurrences_per_castaway_episode,
      sortOrder: rule.sort_order,
    })),
  }
}

export function AdminRulesPage() {
  const queryClient = useQueryClient()
  const rulesQuery = useQuery({
    queryKey: ['admin-rule-sets'],
    queryFn: async () => {
      const supabase = getSupabaseClient()
      const { data: ruleSets, error } = await supabase
        .from('rule_sets')
        .select(
          'id, version, status, pending_confirmation, source_url, source_hash, source_modified_at, roster_size, wildcard_slots, first_scored_episode, picks_per_original_tribe, scoring_rules(code, label, points, kind, phase, max_occurrences_per_castaway_episode, sort_order)',
        )
        .order('version', { ascending: false })
      if (error) throw error
      return ruleSets
    },
  })
  const runsQuery = useQuery({
    queryKey: ['admin-rule-sync-runs'],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('rule_sync_runs')
        .select('id, status, error_code, source_url, finished_at, parser_version')
        .order('started_at', { ascending: false })
        .limit(8)
      if (error) throw error
      return data
    },
  })
  const aliasesQuery = useQuery({
    queryKey: ['admin-aliases'],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('castaway_source_aliases')
        .select('season_id, source_key, normalized_source_name, castaway_id')
        .order('normalized_source_name')
      if (error) throw error
      return data
    },
  })
  const seasonsQuery = useQuery({
    queryKey: ['admin-season-51'],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('seasons')
        .select('id, number, source_page_url, source_checked_at, source_wp_post_id')
        .eq('number', 51)
        .single()
      if (error) throw error
      return data
    },
  })

  const sync = useMutation({
    mutationFn: async () => {
      const { data, error } = await getSupabaseClient().functions.invoke('sync-rules', {
        body: { seasonNumber: 51 },
      })
      if (error) throw error
      return data as { status?: string; detail?: string; code?: string }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-rule-sets'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-rule-sync-runs'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-season-51'] })
    },
  })
  const confirm = useMutation({
    mutationFn: async (ruleSetId: string) => {
      const { error } = await getSupabaseClient().rpc('confirm_rule_set', {
        p_rule_set_id: ruleSetId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-rule-sets'] })
    },
  })

  const latest = rulesQuery.data?.[0]
  const previous = rulesQuery.data?.[1]
  const diff =
    latest && previous
      ? diffRuleSets(
          toProposed({
            ...previous,
            picks_per_original_tribe:
              previous.picks_per_original_tribe as ProposedRuleSet['picksPerOriginalTribe'],
            scoring_rules: previous.scoring_rules,
          }),
          toProposed({
            ...latest,
            picks_per_original_tribe:
              latest.picks_per_original_tribe as ProposedRuleSet['picksPerOriginalTribe'],
            scoring_rules: latest.scoring_rules,
          }),
        )
      : []

  return (
    <PageContainer>
      <h1 className="font-display text-2xl font-semibold">Rules sync</h1>
      <p className="text-sm text-muted-foreground">
        Season 51 Fantasy Tribe is checked from Global&apos;s WordPress API first, then the HTML
        page. A new draft is stored only when parsed rules change. Confirmation is required before
        a version becomes active.
      </p>
      {seasonsQuery.data ? (
        <p className="text-sm">
          Last check:{' '}
          {seasonsQuery.data.source_checked_at
            ? new Date(seasonsQuery.data.source_checked_at).toLocaleString()
            : 'never'}
        </p>
      ) : null}
      <Button type="button" className="min-h-11" onClick={() => void sync.mutateAsync()}>
        {sync.isPending ? 'Checking source…' : 'Check Global source now'}
      </Button>
      {sync.data ? (
        <Alert>
          <AlertTitle>{sync.data.status ?? 'Sync finished'}</AlertTitle>
          <AlertDescription>
            {sync.data.detail ??
              (sync.data.status === 'not_published_yet'
                ? 'Season 51 is not published yet. That is the expected state.'
                : 'Source check completed.')}
          </AlertDescription>
        </Alert>
      ) : null}
      {sync.error ? (
        <ErrorState
          description={sync.error instanceof Error ? sync.error.message : 'Sync failed.'}
        />
      ) : null}
      {rulesQuery.isPending ? <LoadingState label="Loading rule sets" /> : null}
      {latest ? (
        <section className="space-y-2">
          <h2 className="font-medium">Latest version {latest.version}</h2>
          <p className="text-sm text-muted-foreground">
            {latest.status}
            {latest.pending_confirmation ? ' · pending confirmation' : ''} · roster{' '}
            {latest.roster_size} · first scored episode {latest.first_scored_episode}
          </p>
          {latest.status === 'draft' ? (
            <Button
              type="button"
              className="min-h-11"
              onClick={() => void confirm.mutateAsync(latest.id)}
            >
              Confirm this draft
            </Button>
          ) : null}
        </section>
      ) : (
        <EmptyState title="No rule sets" description="Run a source check after Season 51 publishes." />
      )}
      {diff.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-medium">Diff versus previous version</h2>
          <ul className="space-y-1 text-sm">
            {diff.map((entry) => (
              <li key={entry.path} className="rounded-lg bg-muted px-3 py-2">
                <span className="font-mono text-xs">{entry.path}</span>
                <div>
                  {String(entry.before ?? '—')} → {String(entry.after ?? '—')}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="space-y-2">
        <h2 className="font-medium">Recent checks</h2>
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
          <p className="text-sm text-muted-foreground">No sync runs yet.</p>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="font-medium">Exact source aliases</h2>
        <p className="text-sm text-muted-foreground">
          Names must match exactly after trim/case-fold. Unknown names fail closed during score
          import. First-name and full-name aliases are seeded from the posted Season 51 list.
        </p>
        {aliasesQuery.data?.length ? (
          <ul className="text-sm">
            {aliasesQuery.data.map((alias) => (
              <li key={`${alias.source_key}-${alias.normalized_source_name}`}>
                {alias.normalized_source_name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No aliases stored yet.</p>
        )}
      </section>
      <AdminHealthSection />
      <AdminMergeSection />
      <AdminScoresSection />
      <AdminPushSection />
    </PageContainer>
  )
}
