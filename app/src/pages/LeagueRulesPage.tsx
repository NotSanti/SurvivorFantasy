import { Link } from 'react-router'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { PageContainer } from '@/components/layout/PageContainer'
import { KNOWN_SCORING_RULES } from '@/domain/rules-sync/types'
import {
  WEEKLY_CATEGORY_GROUPS,
  WEEKLY_CATEGORY_NOTE,
} from '@/domain/rules-sync/weekly-categories'
import { NoActiveLeague } from '@/features/league/NoActiveLeague'
import { useActiveLeague } from '@/features/league/use-active-league'
import { useLeagueWeek } from '@/features/league/use-league-week'

function displayRuleLabel(code: string, label: string) {
  return KNOWN_SCORING_RULES.find((rule) => rule.code === code)?.label ?? label
}

export function LeagueRulesPage() {
  const { activeLeague, loading: leagueLoading } = useActiveLeague()
  const week = useLeagueWeek(activeLeague)

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
              <li
                key={rule.code}
                className="flex items-start justify-between gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{displayRuleLabel(rule.code, rule.label)}</p>
                  <p className="text-xs text-muted-foreground">
                    {rule.kind.replaceAll('_', ' ')} · {rule.phase.replaceAll('_', ' ')}
                  </p>
                </div>
                <p className="shrink-0 font-medium tabular-nums">
                  {rule.points} <span className="text-muted-foreground">pts</span>
                </p>
              </li>
            ))}
          </ul>

          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <h2 className="font-medium">Additional weekly points</h2>
              <p className="text-sm text-muted-foreground">{WEEKLY_CATEGORY_NOTE}</p>
            </div>
            {WEEKLY_CATEGORY_GROUPS.map((group) => (
              <div key={group.points} className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-sm font-medium">{group.title}</h3>
                  <p className="shrink-0 text-sm font-medium tabular-nums">
                    {group.points} <span className="text-muted-foreground">pts</span>
                  </p>
                </div>
                <ul className="space-y-1.5 text-sm">
                  {group.items.map((item) => (
                    <li key={item} className="text-muted-foreground">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </PageContainer>
  )
}
