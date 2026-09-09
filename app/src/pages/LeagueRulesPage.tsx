import { Link } from 'react-router'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { PageContainer } from '@/components/layout/PageContainer'
import { Badge } from '@/components/ui/badge'
import { NoActiveLeague } from '@/features/league/NoActiveLeague'
import { useActiveLeague } from '@/features/league/use-active-league'
import { useLeagueWeek } from '@/features/league/use-league-week'
import { useSpoilerMode } from '@/hooks/use-spoiler-mode'

export function LeagueRulesPage() {
  const { activeLeague, loading: leagueLoading } = useActiveLeague()
  const { mode } = useSpoilerMode()
  const week = useLeagueWeek(activeLeague, mode)

  if (leagueLoading || (activeLeague && week.loading)) {
    return (
      <PageContainer>
        <LoadingState label="Loading rules" />
      </PageContainer>
    )
  }
  if (!activeLeague) {
    return (
      <PageContainer>
        <NoActiveLeague />
      </PageContainer>
    )
  }

  const ruleSet = week.ruleSet
  const rules = [...(ruleSet?.scoring_rules ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )

  return (
    <PageContainer>
      <p className="text-sm text-muted-foreground">
        <Link to="/league" className="underline">
          Back to league
        </Link>
      </p>
      <h1 className="font-display text-2xl font-semibold">Season rules</h1>
      {week.error ? (
        <ErrorState description="Could not load the current rule-set." onRetry={week.refetch} />
      ) : null}
      {!ruleSet ? (
        <EmptyState
          title="Rules are not available yet"
          description="Your league’s rule-set will show here once it can be read."
        />
      ) : (
        <section className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Version {ruleSet.version}
            {ruleSet.pending_confirmation ? ' · pending Season 51 confirmation' : ''}
          </p>
          <Badge variant="secondary">{ruleSet.status}</Badge>
          <p className="text-sm">
            Roster {ruleSet.roster_size} · wildcard {ruleSet.wildcard_slots} · first scored episode{' '}
            {ruleSet.first_scored_episode}
          </p>
          {ruleSet.source_url ? (
            <a href={ruleSet.source_url} className="text-sm underline" target="_blank" rel="noreferrer">
              Source page
            </a>
          ) : null}
          <ul className="space-y-2">
            {rules.map((rule) => (
              <li key={rule.code} className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
                <p className="font-medium">
                  {rule.label} · {rule.points}
                </p>
                <p className="text-xs text-muted-foreground">
                  {rule.kind} · {rule.phase}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageContainer>
  )
}
