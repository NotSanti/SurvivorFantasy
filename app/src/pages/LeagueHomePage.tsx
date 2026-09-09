import { Link } from 'react-router'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { NoActiveLeague } from '@/features/league/NoActiveLeague'
import { useActiveLeague } from '@/features/league/use-active-league'
import { useLeagueWeek } from '@/features/league/use-league-week'
import { RankDelta } from '@/features/standings/RankDelta'
import { SpoilerToggle } from '@/features/standings/SpoilerToggle'
import { useSpoilerMode } from '@/hooks/use-spoiler-mode'

export function LeagueHomePage() {
  const { activeLeague, loading: leagueLoading, error: leagueError } = useActiveLeague()
  const { mode } = useSpoilerMode()
  const week = useLeagueWeek(activeLeague, mode)

  if (leagueLoading || (activeLeague && week.loading)) {
    return (
      <PageContainer>
        <LoadingState label="Loading league home" />
      </PageContainer>
    )
  }
  if (leagueError) {
    return (
      <PageContainer>
        <ErrorState description="Could not load your leagues." />
      </PageContainer>
    )
  }
  if (!activeLeague) {
    return (
      <PageContainer>
        <h1 className="font-display text-2xl font-semibold">League</h1>
        <NoActiveLeague />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold">{activeLeague.name}</h1>
        <p className="text-sm text-muted-foreground">
          {activeLeague.status.replaceAll('_', ' ')}
          {week.lastUpdatedLabel ? ` · Updated ${week.lastUpdatedLabel}` : ''}
          {week.fetching ? ' · Updating…' : ''}
        </p>
      </div>
      {week.error ? (
        <ErrorState description="Could not load this week’s scores." onRetry={week.refetch} />
      ) : null}
      {week.latestCorrected ? (
        <p className="rounded-xl bg-muted px-3 py-2 text-sm">A published total was corrected.</p>
      ) : null}
      {week.nextAction ? (
        <section className="space-y-2 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
          <h2 className="font-medium">{week.nextAction.title}</h2>
          <p className="text-sm text-muted-foreground">{week.nextAction.description}</p>
          <Button asChild className="min-h-11">
            <Link to={week.nextAction.to}>{week.nextAction.label}</Link>
          </Button>
        </section>
      ) : null}
      {week.selfStanding && week.hasPublishedScores ? (
        <section className="space-y-1 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
          <h2 className="font-medium">Your place</h2>
          <p className="flex items-center gap-2 text-sm">
            <span>Rank {week.selfStanding.rank}</span>
            <RankDelta delta={week.selfStanding.rankDelta} />
            <span className="text-muted-foreground">{week.selfStanding.totalPoints} pts</span>
          </p>
        </section>
      ) : null}
      <SpoilerToggle />
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" className="min-h-11">
          <Link to={`/leagues/${activeLeague.id}`}>Lobby</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link to="/league/rules">Rules</Link>
        </Button>
        {activeLeague.status === 'merge_window' ? (
          <Button asChild variant="outline" className="min-h-11">
            <Link to="/league/merge">Merge move</Link>
          </Button>
        ) : null}
        <Button asChild variant="outline" className="min-h-11">
          <Link to="/leagues">Switch league</Link>
        </Button>
      </div>
      {week.hasPublishedScores ? (
        <ul className="space-y-2">
          {[...week.publishedNumbers].reverse().map((episodeNumber) => (
            <li key={episodeNumber}>
              <Link
                to={`/league/episodes/${episodeNumber}`}
                className="flex min-h-11 items-center justify-between rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10"
              >
                <span>Episode {episodeNumber}</span>
                {week.episodes.find((episode) => episode.episode_number === episodeNumber)
                  ?.status === 'corrected' ? (
                  <Badge>Corrected</Badge>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No scores published"
          description="Episode recaps show up here after Global totals are imported."
        />
      )}
    </PageContainer>
  )
}
