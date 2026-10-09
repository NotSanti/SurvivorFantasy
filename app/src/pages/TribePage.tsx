import { Link, Navigate, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { PageContainer } from '@/components/layout/PageContainer'
import { CastawayPickCard } from '@/features/draft/CastawayPickCard'
import { FantasyTribeHeader } from '@/features/league/FantasyTribeHeader'
import { NoActiveLeague } from '@/features/league/NoActiveLeague'
import { useActiveLeague } from '@/features/league/use-active-league'
import { useLeagueWeek } from '@/features/league/use-league-week'
import { useAuth } from '@/features/auth/use-auth'
import { getSupabaseClient } from '@/lib/supabase'

type RosterCastaway = {
  id: string
  display_name: string
  status: string
  photo_url: string | null
  original_tribe_id: string | null
}

export function TribePage() {
  const { memberId: memberIdParam } = useParams<{ memberId?: string }>()
  const { user } = useAuth()
  const { activeLeague, loading: leagueLoading } = useActiveLeague()
  const week = useLeagueWeek(activeLeague, 'tribe')

  const tribesQuery = useQuery({
    queryKey: ['tribes', activeLeague?.season_id],
    enabled: Boolean(activeLeague?.season_id),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('tribes')
        .select('id, name, color_name')
        .eq('season_id', activeLeague!.season_id)
      if (error) throw error
      return data
    },
  })

  const viewingOther = Boolean(memberIdParam)

  if (
    leagueLoading ||
    (activeLeague && week.tribeLoading) ||
    (activeLeague && viewingOther && week.loading) ||
    tribesQuery.isLoading
  ) {
    return (
      <PageContainer>
        <LoadingState variant="spinner" label="Loading tribe" />
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
  if (!user) {
    return (
      <PageContainer>
        <LoadingState variant="spinner" label="Loading tribe" />
      </PageContainer>
    )
  }

  const memberId = memberIdParam || user.id
  const isSelf = memberId === user.id

  if (memberIdParam && isSelf) {
    return <Navigate to="/tribe" replace />
  }

  const memberInLeague =
    isSelf ||
    week.members.some((row) => row.user_id === memberId) ||
    week.roster.some((row) => row.member_id === memberId)
  const ownerName = isSelf
    ? null
    : (week.members.find((row) => row.user_id === memberId)?.profileName ?? null)

  const memberRoster = (week.roster ?? []).filter((row) => row.member_id === memberId)
  const current = memberRoster.filter((row) => row.ends_episode == null)
  const history = memberRoster.filter((row) => row.ends_episode != null)
  const memberMvp = (week.mvps ?? []).find((row) => row.member_id === memberId)?.castaway_id
  const castawayOf = (entry: (typeof memberRoster)[number]): RosterCastaway | undefined => {
    // Prefer season castaways list — roster embeds can lag after boots are marked.
    const fromSeason = week.castaways.find((castaway) => castaway.id === entry.castaway_id)
    if (fromSeason) return fromSeason
    const embedded = entry.castaway as RosterCastaway | RosterCastaway[] | null | undefined
    if (Array.isArray(embedded)) return embedded[0]
    return embedded ?? undefined
  }
  const isEliminated = (castaway: RosterCastaway | undefined) =>
    castaway?.status === 'eliminated' || castaway?.status === 'withdrawn'
  const tribeOf = (castaway: RosterCastaway | undefined) => {
    if (!castaway?.original_tribe_id) return null
    const tribe = tribesQuery.data?.find((row) => row.id === castaway.original_tribe_id)
    if (!tribe) return null
    return { name: tribe.name, colorName: tribe.color_name }
  }
  const rosterSize = week.ruleSet?.roster_size ?? 8
  const pointsForEntry = (rosterEntryId: string, castawayId: string) =>
    (week.lineScores ?? [])
      .filter(
        (line) =>
          line.member_id === memberId &&
          (line.roster_entry_id === rosterEntryId ||
            (line.is_mvp_bonus && line.castaway_id === castawayId)),
      )
      .reduce((sum, line) => sum + (line.points_total ?? 0), 0)
  const totalPoints = (week.lineScores ?? [])
    .filter((line) => line.member_id === memberId)
    .reduce((sum, line) => sum + (line.points_total ?? 0), 0)

  const scoreTrailing = (points: number) => (
    <span className="flex shrink-0 items-baseline gap-1 tabular-nums">
      <span className="font-display text-lg leading-none font-semibold text-foreground">
        {points}
      </span>
      <span className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">pts</span>
    </span>
  )

  if (!memberInLeague) {
    return (
      <PageContainer>
        {!isSelf ? (
          <Link to="/standings" className="text-sm text-muted-foreground underline">
            Back to standings
          </Link>
        ) : null}
        <EmptyState
          title="Tribe not found"
          description="That player is not in this league."
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      {!isSelf ? (
        <Link to="/standings" className="text-sm text-muted-foreground underline">
          Back to standings
        </Link>
      ) : null}
      <div className="space-y-3">
        <FantasyTribeHeader
          leagueId={activeLeague.id}
          userId={memberId}
          totalPoints={totalPoints}
          editable={isSelf}
          ownerName={ownerName}
        />
      </div>
      {week.error ? (
        <ErrorState
          description={isSelf ? 'Could not load your roster.' : 'Could not load this tribe.'}
          onRetry={week.refetch}
        />
      ) : null}
      {current.length === 0 ? (
        <EmptyState
          title="Roster arrives after the draft"
          description={
            isSelf
              ? `Your ${rosterSize}-person tribe, MVP, and episode points will live here.`
              : `This ${rosterSize}-person tribe appears here after the draft.`
          }
        />
      ) : (
        <section className="space-y-2">
          <h2 className="font-medium">Current camp</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {current.map((entry) => {
              const castaway = castawayOf(entry)
              const points = pointsForEntry(entry.id, entry.castaway_id)
              const isMvp = memberMvp === entry.castaway_id
              const eliminated = isEliminated(castaway)
              return (
                <li key={entry.id}>
                  <CastawayPickCard
                    static
                    name={castaway?.display_name ?? 'Castaway'}
                    photoUrl={castaway?.photo_url}
                    tribe={tribeOf(castaway)}
                    selected={isMvp}
                    disabled={eliminated}
                    badge={eliminated ? <span aria-label="Eliminated">💀</span> : null}
                    trailing={scoreTrailing(points)}
                    eager
                  />
                </li>
              )
            })}
          </ul>
        </section>
      )}
      {history.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-medium">Eliminated</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {history.map((entry) => {
              const castaway = castawayOf(entry)
              const points = pointsForEntry(entry.id, entry.castaway_id)
              const eliminated = isEliminated(castaway)
              return (
                <li key={entry.id}>
                  <CastawayPickCard
                    static
                    name={castaway?.display_name ?? 'Castaway'}
                    photoUrl={castaway?.photo_url}
                    tribe={tribeOf(castaway)}
                    disabled={eliminated}
                    badge={
                      eliminated ? (
                        <span aria-label="Eliminated">💀</span>
                      ) : (
                        `Ep ${entry.starts_episode}–${entry.ends_episode}`
                      )
                    }
                    trailing={scoreTrailing(points)}
                    eager
                  />
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </PageContainer>
  )
}
