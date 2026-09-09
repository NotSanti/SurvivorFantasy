import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState } from '@/components/states/ErrorState'
import { classifySourceCheck } from '@/domain/ops/health'
import { getSupabaseClient } from '@/lib/supabase'

type HealthPayload = {
  season_status?: string
  last_source_check?: {
    status: string
    error_code: string | null
    started_at: string
    finished_at: string | null
    trigger_type: string
  } | null
  last_success?: { finished_at: string } | null
  next_expected_episode?: number | null
  outstanding_review?: number
  push_failures?: { dead_letter: number; pending: number }
  cron_staleness?: { last_scheduled_at: string | null; stale: boolean }
}

function formatWhen(value: string | null | undefined) {
  if (!value) return 'Never'
  return new Date(value).toLocaleString()
}

function sourceCheckLabel(health: HealthPayload) {
  const kind = classifySourceCheck(
    health.last_source_check
      ? { status: health.last_source_check.status, errorCode: health.last_source_check.error_code }
      : null,
  )
  if (kind === 'none') return 'No source check yet'
  if (kind === 'no_result_yet') return 'No results published yet'
  if (kind === 'success') return 'Last check imported scores'
  if (kind === 'needs_review') return 'Last check needs review'
  return 'Last check failed'
}

export function AdminHealthSection() {
  const healthQuery = useQuery({
    queryKey: ['admin-ops-health'],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('admin_ops_health')
      if (error) throw error
      return data as HealthPayload
    },
  })

  if (healthQuery.error) {
    return <ErrorState title="Could not load ops health" description={healthQuery.error.message} />
  }

  const health = healthQuery.data

  return (
    <section className="space-y-3">
      <h2 className="font-medium">Operations</h2>
      <p className="text-sm text-muted-foreground">
        Scheduled Global checks run Thursday evening through early Friday, plus a Friday daytime
        fallback. Unpublished source pages are not importer failures.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Last source check</CardTitle>
            <CardDescription>{health ? sourceCheckLabel(health) : 'Loading…'}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {formatWhen(health?.last_source_check?.finished_at ?? health?.last_source_check?.started_at)}
            {health?.last_source_check?.error_code ? ` · ${health.last_source_check.error_code}` : ''}
            {health?.last_source_check?.trigger_type ? ` · ${health.last_source_check.trigger_type}` : ''}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Last success</CardTitle>
            <CardDescription>Most recent published import</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {formatWhen(health?.last_success?.finished_at)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Next expected episode</CardTitle>
            <CardDescription>Season {health?.season_status ?? '…'}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {health?.next_expected_episode ?? '—'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Outstanding review</CardTitle>
            <CardDescription>Import runs waiting on an admin</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {health?.outstanding_review ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Push failures</CardTitle>
            <CardDescription>Outbox dead-letter and pending jobs</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Dead-letter {health?.push_failures?.dead_letter ?? 0} · pending {health?.push_failures?.pending ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cron staleness</CardTitle>
            <CardDescription>
              {health?.cron_staleness?.stale ? 'No scheduled import in the last 8 days' : 'Schedule heartbeats look current'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Last scheduled run {formatWhen(health?.cron_staleness?.last_scheduled_at)}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
