import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { PageContainer } from '@/components/layout/PageContainer'
import { Badge } from '@/components/ui/badge'
import { NoActiveLeague } from '@/features/league/NoActiveLeague'
import { useActiveLeague } from '@/features/league/use-active-league'
import { useLeagueWeek } from '@/features/league/use-league-week'
import { useAuth } from '@/features/auth/use-auth'
import { useSpoilerMode } from '@/hooks/use-spoiler-mode'

export function TribePage() {
  const { user } = useAuth()
  const { activeLeague, loading: leagueLoading } = useActiveLeague()
  const { mode } = useSpoilerMode()
  const week = useLeagueWeek(activeLeague, mode)

  if (leagueLoading || (activeLeague && week.loading)) {
    return (
      <PageContainer>
        <LoadingState label="Loading your tribe" />
      </PageContainer>
    )
  }
  if (!activeLeague) {
    return (
      <PageContainer>
        <h1 className="font-display text-2xl font-semibold">Tribe</h1>
        <NoActiveLeague />
      </PageContainer>
    )
  }

  const myRoster = (week.roster ?? []).filter((row) => row.member_id === user?.id)
  const current = myRoster.filter((row) => row.ends_episode == null)
  const history = myRoster.filter((row) => row.ends_episode != null)
  const myMvp = (week.mvps ?? []).find((row) => row.member_id === user?.id)?.castaway_id
  const nameOf = (id: string) =>
    week.castaways.find((castaway) => castaway.id === id)?.display_name ?? 'Castaway'
  const statusOf = (id: string) =>
    week.castaways.find((castaway) => castaway.id === id)?.status ?? 'active'

  return (
    <PageContainer>
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold">My Tribe</h1>
        <p className="text-sm text-muted-foreground">
          Historical picks stay on the list. Points only count while that person was on your roster.
        </p>
      </div>
      {week.error ? (
        <ErrorState description="Could not load your roster." onRetry={week.refetch} />
      ) : null}
      {current.length === 0 ? (
        <EmptyState
          title="Roster arrives after the draft"
          description="Your nine-person tribe, MVP, and episode points will live here."
        />
      ) : (
        <section className="space-y-2">
          <h2 className="font-medium">Current camp</h2>
          <ul className="space-y-2">
            {current.map((entry) => {
              const latestLine = (week.lineScores ?? [])
                .filter(
                  (line) =>
                    line.member_id === user?.id &&
                    line.castaway_id === entry.castaway_id &&
                    !line.is_mvp_bonus,
                )
                .sort((a, b) => (b.episode_number ?? 0) - (a.episode_number ?? 0))[0]
              return (
                <li
                  key={entry.id}
                  className="flex min-h-11 items-center justify-between rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10"
                >
                  <div>
                    <p className="font-medium">{nameOf(entry.castaway_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.acquisition_type.replaceAll('_', ' ')} · {statusOf(entry.castaway_id)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {myMvp === entry.castaway_id ? <Badge>MVP</Badge> : null}
                    {week.hasPublishedScores && mode === 'show' && latestLine ? (
                      <span className="text-sm">{latestLine.points_total} pts</span>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      {history.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-medium">Earlier on the roster</h2>
          <ul className="space-y-2">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="rounded-xl bg-card px-4 py-3 text-sm ring-1 ring-foreground/10"
              >
                {nameOf(entry.castaway_id)} · episodes {entry.starts_episode}–{entry.ends_episode}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </PageContainer>
  )
}
