import { Link } from 'react-router'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { PageContainer } from '@/components/layout/PageContainer'
import { NoActiveLeague } from '@/features/league/NoActiveLeague'
import { useActiveLeague } from '@/features/league/use-active-league'
import { useLeagueWeek } from '@/features/league/use-league-week'
import { RankDelta } from '@/features/standings/RankDelta'
import { SpoilerToggle } from '@/features/standings/SpoilerToggle'
import { useAuth } from '@/features/auth/use-auth'
import { useSpoilerMode } from '@/hooks/use-spoiler-mode'

export function StandingsPage() {
  const { user } = useAuth()
  const { activeLeague, loading: leagueLoading } = useActiveLeague()
  const { mode } = useSpoilerMode()
  const week = useLeagueWeek(activeLeague, mode)

  if (leagueLoading || (activeLeague && week.loading)) {
    return (
      <PageContainer>
        <LoadingState label="Loading standings" />
      </PageContainer>
    )
  }
  if (!activeLeague) {
    return (
      <PageContainer>
        <h1 className="font-display text-2xl font-semibold">Standings</h1>
        <NoActiveLeague />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold">Standings</h1>
        <p className="text-sm text-muted-foreground">
          Tied totals share a rank. Names only sort the list.
          {week.lastUpdatedLabel ? ` Updated ${week.lastUpdatedLabel}.` : ''}
          {week.fetching ? ' Updating…' : ''}
        </p>
      </div>
      {week.error ? (
        <ErrorState description="Could not load standings." onRetry={week.refetch} />
      ) : null}
      {week.latestCorrected ? (
        <p className="rounded-xl bg-muted px-3 py-2 text-sm">Latest published totals include a correction.</p>
      ) : null}
      <SpoilerToggle />
      {!week.hasPublishedScores ? (
        <EmptyState
          title="No scores published"
          description="League standings appear after the first scored episode is imported."
        />
      ) : (
        <ol className="space-y-2">
          {week.standings.map((row) => (
            <li
              key={row.memberId}
              className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10"
            >
              <div className="space-y-0.5">
                <p className="font-medium">
                  {row.rank}. {row.displayName}
                  {row.memberId === user?.id ? ' (you)' : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.totalPoints} pts
                  {mode === 'show' && week.latestEpisode
                    ? ` · +${row.weeklyPoints} ep ${week.latestEpisode}`
                    : ''}
                </p>
              </div>
              <RankDelta delta={row.rankDelta} />
            </li>
          ))}
        </ol>
      )}
      {week.latestEpisode ? (
        <Link to={`/league/episodes/${week.latestEpisode}`} className="text-sm underline">
          Episode {week.latestEpisode} details
        </Link>
      ) : null}
    </PageContainer>
  )
}
