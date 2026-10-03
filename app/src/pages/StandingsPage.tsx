import { Link } from 'react-router'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { PageContainer } from '@/components/layout/PageContainer'
import {
  fantasyTribeColorSwatch,
  resolveFantasyTribeColorId,
} from '@/domain/fantasy-tribe/colors'
import { NoActiveLeague } from '@/features/league/NoActiveLeague'
import { useActiveLeague } from '@/features/league/use-active-league'
import { useLeagueWeek } from '@/features/league/use-league-week'
import { RankDelta } from '@/features/standings/RankDelta'
import { useAuth } from '@/features/auth/use-auth'

export function StandingsPage() {
  const { user } = useAuth()
  const { activeLeague, loading: leagueLoading } = useActiveLeague()
  const week = useLeagueWeek(activeLeague)

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
          Tied totals share a rank. Tribe names only sort the list.
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
      {!week.hasPublishedScores ? (
        <EmptyState
          title="No scores published"
          description="League standings appear after the first scored episode is imported."
        />
      ) : (
        <ol className="space-y-2">
          {week.standings.map((row) => {
            const tribeColor = fantasyTribeColorSwatch(
              resolveFantasyTribeColorId(row.fantasyTribeColor),
            )
            const tribeTo = row.memberId === user?.id ? '/tribe' : `/tribe/${row.memberId}`
            return (
              <li key={row.memberId}>
                <Link
                  to={tribeTo}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted/40"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className="mt-1.5 size-2.5 shrink-0 rounded-full ring-1 ring-foreground/15"
                      style={{ backgroundColor: tribeColor }}
                      aria-hidden
                    />
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate font-medium uppercase" style={{ color: tribeColor }}>
                        {row.rank}. {row.displayName}
                        {row.memberId === user?.id ? ' (you)' : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {week.latestEpisode
                          ? `+${row.weeklyPoints} pts ep ${week.latestEpisode}`
                          : 'No episode yet'}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <RankDelta delta={row.rankDelta} />
                    <p className="font-medium tabular-nums">
                      {row.totalPoints}{' '}
                      <span className="text-muted-foreground">pts</span>
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
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
