import { Link, useParams } from 'react-router'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { PageContainer } from '@/components/layout/PageContainer'
import { Badge } from '@/components/ui/badge'
import { NoActiveLeague } from '@/features/league/NoActiveLeague'
import { useActiveLeague } from '@/features/league/use-active-league'
import { useLeagueWeek } from '@/features/league/use-league-week'
import { SpoilerToggle } from '@/features/standings/SpoilerToggle'
import { useAuth } from '@/features/auth/use-auth'
import { useSpoilerMode } from '@/hooks/use-spoiler-mode'

export function EpisodeDetailPage() {
  const { episodeNumber: raw } = useParams()
  const episodeNumber = Number(raw)
  const { user } = useAuth()
  const { activeLeague, loading: leagueLoading } = useActiveLeague()
  const { mode, hidden } = useSpoilerMode()
  const week = useLeagueWeek(activeLeague, mode)
  const isLatest = week.latestEpisode === episodeNumber

  if (leagueLoading || (activeLeague && week.loading)) {
    return (
      <PageContainer>
        <LoadingState label="Loading episode" />
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
  if (!Number.isFinite(episodeNumber) || episodeNumber <= 0) {
    return (
      <PageContainer>
        <ErrorState title="Unknown episode" description="That episode number is not valid." />
      </PageContainer>
    )
  }

  const lines = (week.lineScores ?? []).filter(
    (line) => line.member_id === user?.id && line.episode_number === episodeNumber,
  )
  const memberTotal = (week.episodeScores ?? []).find(
    (row) => row.member_id === user?.id && row.episode_number === episodeNumber,
  )?.points
  const episodeMeta = week.episodes.find((episode) => episode.episode_number === episodeNumber)
  const nameOf = (id: string) =>
    week.castaways.find((castaway) => castaway.id === id)?.display_name ?? 'Castaway'
  const hide = hidden && isLatest

  return (
    <PageContainer>
      <p className="text-sm text-muted-foreground">
        <Link to="/league" className="underline">
          Back to league
        </Link>
      </p>
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold">Episode {episodeNumber}</h1>
        <p className="text-sm text-muted-foreground">
          Imported Global totals for the people on your roster this week.
          {episodeMeta?.status === 'corrected' ? ' This episode was corrected.' : ''}
        </p>
      </div>
      <SpoilerToggle />
      {week.error ? (
        <ErrorState description="Could not load episode scores." onRetry={week.refetch} />
      ) : null}
      {hide ? (
        <EmptyState
          title="This week is hidden"
          description="Turn off spoiler hiding when you have watched the episode."
        />
      ) : lines.length === 0 ? (
        <EmptyState
          title="No totals for this episode"
          description="Either scores are not imported yet, or nobody on your roster was eligible."
        />
      ) : (
        <>
          <p className="text-sm">
            Your total: <span className="font-medium">{memberTotal ?? 0}</span>
          </p>
          <ul className="space-y-2">
            {lines.map((line) => (
              <li
                key={`${line.castaway_id}-${line.is_mvp_bonus ? 'mvp' : line.roster_entry_id}`}
                className="flex min-h-11 items-center justify-between rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10"
              >
                <span>
                  {nameOf(line.castaway_id ?? '')}
                  {line.is_mvp_bonus ? ' · MVP bonus' : ''}
                </span>
                <span className="flex items-center gap-2">
                  {(line.revision ?? 1) > 1 ? <Badge>Corrected</Badge> : null}
                  <span>{line.points_total} pts</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </PageContainer>
  )
}
