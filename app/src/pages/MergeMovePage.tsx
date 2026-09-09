import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { PageContainer } from '@/components/layout/PageContainer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { classifyMergeError, evaluateMergeMove, mergeErrorCopy } from '@/domain/merge/evaluate'
import { aliveRosterCount, decideMergeMoveType, effectiveEpisodeAfterMerge } from '@/domain/merge/rules'
import { NoActiveLeague } from '@/features/league/NoActiveLeague'
import { useActiveLeague } from '@/features/league/use-active-league'
import { useLeagueWeek } from '@/features/league/use-league-week'
import { useAuth } from '@/features/auth/use-auth'
import { useSpoilerMode } from '@/hooks/use-spoiler-mode'
import { getSupabaseClient } from '@/lib/supabase'

export function MergeMovePage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { activeLeague, loading: leagueLoading } = useActiveLeague()
  const { mode } = useSpoilerMode()
  const week = useLeagueWeek(activeLeague, mode)
  const [incomingId, setIncomingId] = useState<string | null>(null)
  const [outgoingId, setOutgoingId] = useState<string | null>(null)

  const seasonQuery = useQuery({
    queryKey: ['season', activeLeague?.season_id],
    enabled: Boolean(activeLeague?.season_id),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('seasons')
        .select('id, merge_episode_number')
        .eq('id', activeLeague!.season_id)
        .single()
      if (error) throw error
      return data
    },
  })

  const movesQuery = useQuery({
    queryKey: ['merge-moves', activeLeague?.id],
    enabled: Boolean(activeLeague?.id),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('merge_moves')
        .select('member_id, move_type, in_castaway_id, out_roster_entry_id, effective_episode')
        .eq('league_id', activeLeague!.id)
      if (error) throw error
      return data
    },
  })

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await getSupabaseClient().rpc('submit_merge_move', {
        p_league_id: activeLeague!.id,
        p_in_castaway_id: incomingId!,
        p_out_roster_entry_id: outgoingId ?? undefined,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['merge-moves', activeLeague?.id] })
      void queryClient.invalidateQueries({ queryKey: ['roster', activeLeague?.id] })
    },
  })
  const closeWindow = useMutation({
    mutationFn: async () => {
      const { error } = await getSupabaseClient().rpc('close_merge_window', {
        p_league_id: activeLeague!.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['leagues'] })
      void queryClient.invalidateQueries({ queryKey: ['league', activeLeague?.id] })
    },
  })

  const mergeEpisode = seasonQuery.data?.merge_episode_number ?? null
  const myRoster = useMemo(
    () => (week.roster ?? []).filter((row) => row.member_id === user?.id),
    [user?.id, week.roster],
  )
  const current = myRoster.filter((row) => row.ends_episode == null)
  const myMove = (movesQuery.data ?? []).find((row) => row.member_id === user?.id)
  const castaways = week.castaways.map((row) => ({
    id: row.id,
    status: row.status,
    eliminatedEpisodeNumber: row.eliminated_episode_number,
  }))
  const rosterSlices = myRoster.map((row) => ({
    id: row.id,
    memberId: row.member_id,
    castawayId: row.castaway_id,
    startsEpisode: row.starts_episode,
    endsEpisode: row.ends_episode,
  }))
  const rosterSize = week.ruleSet?.roster_size ?? 9
  const aliveCount =
    mergeEpisode == null || !user
      ? 0
      : aliveRosterCount(rosterSlices, castaways, user.id, mergeEpisode)
  const moveType = decideMergeMoveType(aliveCount, rosterSize)
  const preview =
    incomingId && user && mergeEpisode
      ? evaluateMergeMove({
          leagueStatus: activeLeague?.status ?? 'locked',
          mergeEpisode,
          alreadyMoved: Boolean(myMove),
          rosterSize,
          memberId: user.id,
          roster: rosterSlices,
          castaways,
          incomingId,
          outgoingEntryId: outgoingId,
        })
      : null
  const nameOf = (id: string) =>
    week.castaways.find((row) => row.id === id)?.display_name ?? 'Castaway'
  const isCommissioner = activeLeague?.commissioner_id === user?.id
  const ownedIds = new Set(current.map((row) => row.castaway_id))
  const eligibleIncoming = week.castaways.filter((row) => {
    if (ownedIds.has(row.id)) return false
    if (row.status !== 'active') return false
    if (mergeEpisode != null && row.eliminated_episode_number != null && row.eliminated_episode_number <= mergeEpisode) {
      return false
    }
    return true
  })

  if (leagueLoading || (activeLeague && week.loading) || seasonQuery.isLoading || movesQuery.isLoading) {
    return (
      <PageContainer>
        <LoadingState label="Loading merge window" />
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

  return (
    <PageContainer>
      <p className="text-sm text-muted-foreground">
        <Link to="/league" className="underline">
          Back to league
        </Link>
      </p>
      <h1 className="font-display text-2xl font-semibold">Merge move</h1>
      {mergeEpisode == null ? (
        <EmptyState
          title="Merge is not confirmed yet"
          description="This window opens only after the merge episode is recorded. We will not guess it."
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Merge episode {mergeEpisode}. New picks start in episode {effectiveEpisodeAfterMerge(mergeEpisode)}.
          Historical points stay.
        </p>
      )}
      {myMove ? (
        <section className="space-y-1 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
          <h2 className="font-medium">Your locked move</h2>
          <p className="text-sm">
            {myMove.move_type === 'add' ? 'Added' : 'Swapped in'} {nameOf(myMove.in_castaway_id)},
            effective episode {myMove.effective_episode}.
          </p>
        </section>
      ) : null}
      {activeLeague.status !== 'merge_window' && !myMove ? (
        <EmptyState
          title="Window closed"
          description="The merge move is only available while the league is in the merge window."
        />
      ) : null}
      {activeLeague.status === 'merge_window' && !myMove && mergeEpisode != null ? (
        <section className="space-y-3">
          <p className="text-sm">
            {moveType === 'add'
              ? `Add one eligible castaway. ${aliveCount} of ${rosterSize} picks are still in the game.`
              : `Swap one pick. All ${rosterSize} are still active.`}
          </p>
          {moveType === 'swap' ? (
            <ul className="space-y-2">
              {current.map((entry) => (
                <li key={entry.id}>
                  <Button
                    type="button"
                    variant={outgoingId === entry.id ? 'default' : 'outline'}
                    className="min-h-11 w-full justify-between"
                    onClick={() => setOutgoingId(entry.id)}
                  >
                    {nameOf(entry.castaway_id)}
                    {outgoingId === entry.id ? <Badge>Out</Badge> : null}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          <ul className="space-y-2">
            {eligibleIncoming.map((castaway) => (
              <li key={castaway.id}>
                <Button
                  type="button"
                  variant={incomingId === castaway.id ? 'default' : 'outline'}
                  className="min-h-11 w-full justify-between"
                  onClick={() => setIncomingId(castaway.id)}
                >
                  {castaway.display_name}
                  {incomingId === castaway.id ? <Badge>In</Badge> : null}
                </Button>
              </li>
            ))}
          </ul>
          {preview?.ok ? (
            <p className="text-sm">
              Confirm {preview.moveType === 'add' ? 'adding' : 'swapping in'} {nameOf(incomingId ?? '')}
              {preview.moveType === 'swap' && outgoingId
                ? `, sending ${nameOf(current.find((row) => row.id === outgoingId)?.castaway_id ?? '')} out after episode ${mergeEpisode}`
                : ''}
              . Scoring starts episode {preview.effectiveEpisode}.
            </p>
          ) : null}
          <Button
            type="button"
            className="min-h-11"
            disabled={!preview?.ok || submit.isPending}
            onClick={() => void submit.mutateAsync()}
          >
            {submit.isPending ? 'Saving…' : 'Lock this move'}
          </Button>
        </section>
      ) : null}
      {submit.error ? (
        <ErrorState
          description={mergeErrorCopy(
            classifyMergeError(submit.error instanceof Error ? submit.error.message : String(submit.error)),
          )}
        />
      ) : null}
      {isCommissioner ? (
        <section className="space-y-2">
          <h2 className="font-medium">Camp progress</h2>
          <ul className="space-y-2 text-sm">
            {week.members.map((member) => {
              const moved = (movesQuery.data ?? []).some((row) => row.member_id === member.user_id)
              return (
                <li
                  key={member.user_id}
                  className="flex min-h-11 items-center justify-between rounded-xl bg-card px-4 py-2 ring-1 ring-foreground/10"
                >
                  <span>{member.displayName}</span>
                  <Badge variant={moved ? 'default' : 'secondary'}>{moved ? 'Moved' : 'Waiting'}</Badge>
                </li>
              )
            })}
          </ul>
          {activeLeague.status === 'merge_window' ? (
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              onClick={() => void closeWindow.mutateAsync()}
            >
              Close merge window
            </Button>
          ) : null}
        </section>
      ) : null}
    </PageContainer>
  )
}
