import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
import { classifyDraftError, draftErrorCopy } from '@/domain/draft/errors'
import {
  claimCountsByCastaway,
  draftCurrentMemberId,
  draftCurrentTribeId,
  draftRoundNumber,
  isCastawayClaimedOut,
  parseDraftSession,
} from '@/domain/draft/turn'
import { CastawayPickCard } from '@/features/draft/CastawayPickCard'
import { DraftOrderWheel } from '@/features/draft/DraftOrderWheel'
import { useAuth } from '@/features/auth/use-auth'
import { writeActiveLeagueId } from '@/features/league/active-league-storage'
import { getSupabaseClient } from '@/lib/supabase'

export function DraftRoomPage() {
  const { leagueId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [ackedOrderSeed, setAckedOrderSeed] = useState<string | null>(null)

  useEffect(() => {
    if (leagueId) writeActiveLeagueId(leagueId)
  }, [leagueId])

  const leagueQuery = useQuery({
    queryKey: ['draft-league', leagueId],
    enabled: Boolean(leagueId),
    queryFn: async () => {
      const supabase = getSupabaseClient()
      const { data: league, error } = await supabase
        .from('leagues')
        .select('id, name, status, commissioner_id, season_id, ruleset_version_id')
        .eq('id', leagueId!)
        .single()
      if (error) throw error
      const { data: ruleSet, error: ruleError } = await supabase
        .from('rule_sets')
        .select('id, roster_size, wildcard_slots, picks_per_original_tribe')
        .eq('id', league.ruleset_version_id)
        .single()
      if (ruleError) throw ruleError
      return { league, ruleSet }
    },
  })

  const sessionQuery = useQuery({
    queryKey: ['draft-session', leagueId],
    enabled: Boolean(leagueId),
    refetchInterval: (query) => {
      const phase = query.state.data?.draft_phase
      return phase === 'picking' || phase === 'revealing' ? 2000 : false
    },
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('selection_sessions')
        .select(
          'league_id, pick_order, tribe_order, current_pick_index, draft_phase, order_seed, locked_at, rule_set_id, started_at',
        )
        .eq('league_id', leagueId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  const orderSeed = sessionQuery.data?.order_seed ?? null
  const orderAckedLocally = ackedOrderSeed != null && ackedOrderSeed === orderSeed

  const membersQuery = useQuery({
    queryKey: ['draft-members', leagueId],
    enabled: Boolean(leagueId),
    queryFn: async () => {
      const supabase = getSupabaseClient()
      const { data: members, error } = await supabase
        .from('league_members')
        .select('user_id, ready_at, status')
        .eq('league_id', leagueId!)
        .eq('status', 'active')
      if (error) throw error
      const ids = members.map((row) => row.user_id)
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', ids)
      if (profileError) throw profileError
      const names = Object.fromEntries(profiles.map((row) => [row.id, row.display_name]))
      return members.map((row) => ({
        userId: row.user_id,
        readyAt: row.ready_at,
        displayName: names[row.user_id] ?? 'Member',
      }))
    },
  })

  const tribesQuery = useQuery({
    queryKey: ['draft-tribes', leagueQuery.data?.league.season_id],
    enabled: Boolean(leagueQuery.data?.league.season_id),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('tribes')
        .select('id, name, color_name, color_token, sort_order')
        .eq('season_id', leagueQuery.data!.league.season_id)
        .order('sort_order')
      if (error) throw error
      return data
    },
  })

  const castawaysQuery = useQuery({
    queryKey: ['draft-castaways', leagueQuery.data?.league.season_id],
    enabled: Boolean(leagueQuery.data?.league.season_id),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('castaways')
        .select('id, display_name, original_tribe_id, status, season_id, photo_url')
        .eq('season_id', leagueQuery.data!.league.season_id)
        .eq('status', 'active')
      if (error) throw error
      return data
    },
  })

  const allRostersQuery = useQuery({
    queryKey: ['draft-all-rosters', leagueId],
    enabled: Boolean(leagueId),
    refetchInterval: () =>
      sessionQuery.data?.draft_phase === 'picking' || sessionQuery.data?.draft_phase === 'revealing'
        ? 2000
        : false,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('roster_entries')
        .select('id, member_id, castaway_id, acquisition_type, slot_number, ends_episode')
        .eq('league_id', leagueId!)
        .is('ends_episode', null)
        .order('slot_number')
      if (error) throw error
      return data
    },
  })

  const mvpQuery = useQuery({
    queryKey: ['draft-mvp', leagueId, user?.id],
    enabled: Boolean(leagueId && user?.id),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('mvp_selections')
        .select('castaway_id')
        .eq('league_id', leagueId!)
        .eq('member_id', user!.id)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  useEffect(() => {
    if (!leagueId) return
    const supabase = getSupabaseClient()
    const refreshDraft = () => {
      void queryClient.invalidateQueries({ queryKey: ['draft-session', leagueId] })
      void queryClient.invalidateQueries({ queryKey: ['draft-all-rosters', leagueId] })
      void queryClient.invalidateQueries({ queryKey: ['draft-mvp', leagueId, user?.id] })
      void queryClient.invalidateQueries({ queryKey: ['draft-members', leagueId] })
      void queryClient.invalidateQueries({ queryKey: ['draft-league', leagueId] })
      void queryClient.invalidateQueries({ queryKey: ['leagues', user?.id] })
      void queryClient.refetchQueries({ queryKey: ['draft-session', leagueId] })
      void queryClient.refetchQueries({ queryKey: ['draft-all-rosters', leagueId] })
      void queryClient.refetchQueries({ queryKey: ['draft-league', leagueId] })
    }
    const channel = supabase
      .channel(`sfl-draft-${leagueId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'selection_sessions', filter: `league_id=eq.${leagueId}` },
        refreshDraft,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'roster_entries', filter: `league_id=eq.${leagueId}` },
        refreshDraft,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mvp_selections', filter: `league_id=eq.${leagueId}` },
        refreshDraft,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leagues', filter: `id=eq.${leagueId}` },
        refreshDraft,
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [leagueId, queryClient, user?.id])

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['draft-session', leagueId] })
    void queryClient.invalidateQueries({ queryKey: ['draft-all-rosters', leagueId] })
    void queryClient.invalidateQueries({ queryKey: ['draft-mvp', leagueId, user?.id] })
    void queryClient.invalidateQueries({ queryKey: ['draft-members', leagueId] })
    void queryClient.invalidateQueries({ queryKey: ['draft-league', leagueId] })
    void queryClient.invalidateQueries({ queryKey: ['leagues', user?.id] })
    void queryClient.refetchQueries({ queryKey: ['draft-session', leagueId] })
    void queryClient.refetchQueries({ queryKey: ['draft-all-rosters', leagueId] })
    void queryClient.refetchQueries({ queryKey: ['draft-league', leagueId] })
  }

  const ackOrder = useMutation({
    mutationFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('ack_draft_order', {
        p_league_id: leagueId!,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      setAckedOrderSeed(orderSeed)
      invalidate()
    },
  })

  const submitPick = useMutation({
    mutationFn: async (castawayId: string) => {
      const { error } = await getSupabaseClient().rpc('submit_draft_pick', {
        p_league_id: leagueId!,
        p_castaway_id: castawayId,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const setMvp = useMutation({
    mutationFn: async (castawayId: string) => {
      const { error } = await getSupabaseClient().rpc('set_mvp', {
        p_league_id: leagueId!,
        p_castaway_id: castawayId,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const ready = useMutation({
    mutationFn: async (isReady: boolean) => {
      const { error } = await getSupabaseClient().rpc('set_league_ready', {
        p_league_id: leagueId!,
        p_ready: isReady,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const lock = useMutation({
    mutationFn: async () => {
      const { error } = await getSupabaseClient().rpc('lock_league_selection', {
        p_league_id: leagueId!,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      invalidate()
      await queryClient.invalidateQueries({ queryKey: ['leagues', user?.id] })
      navigate('/league', { replace: true })
    },
  })

  const handleOrderContinue = useCallback(() => {
    if (ackOrder.isPending) return
    void ackOrder.mutateAsync()
  }, [ackOrder])

  const session = sessionQuery.data ? parseDraftSession(sessionQuery.data) : null
  const selecting = leagueQuery.data?.league.status === 'selecting'
  const isCommissioner = leagueQuery.data?.league.commissioner_id === user?.id
  const myRoster = (allRostersQuery.data ?? []).filter((row) => row.member_id === user?.id)
  const claimCounts = useMemo(
    () => claimCountsByCastaway(allRostersQuery.data ?? []),
    [allRostersQuery.data],
  )
  const myIds = new Set(myRoster.map((row) => row.castaway_id))
  const rosterSize = leagueQuery.data?.ruleSet.roster_size ?? 8
  const rosterComplete = myRoster.length >= rosterSize
  const currentMemberId = session
    ? draftCurrentMemberId(session.pickOrder, session.currentPickIndex)
    : null
  const currentTribeId = session
    ? draftCurrentTribeId(session.tribeOrder, session.pickOrder, session.currentPickIndex)
    : null
  const isMyTurn =
    session?.draftPhase === 'picking' && currentMemberId === user?.id && !rosterComplete
  const currentTribe = (tribesQuery.data ?? []).find((tribe) => tribe.id === currentTribeId)
  const currentPickerName =
    (membersQuery.data ?? []).find((member) => member.userId === currentMemberId)?.displayName ??
    'another member'
  const memberLabels = Object.fromEntries(
    (membersQuery.data ?? []).map((member) => [member.userId, member.displayName]),
  )
  const selfReady = (membersQuery.data ?? []).find((member) => member.userId === user?.id)?.readyAt
  const actionError =
    ackOrder.error ?? submitPick.error ?? setMvp.error ?? ready.error ?? lock.error

  const showWheel =
    selecting &&
    session?.draftPhase === 'revealing' &&
    session.pickOrder.length > 0 &&
    !orderAckedLocally

  if (leagueQuery.data?.league.status === 'recruiting' && leagueId) {
    return <Navigate to={`/leagues/${leagueId}`} replace />
  }

  if (leagueQuery.data && leagueQuery.data.league.status !== 'selecting') {
    return <Navigate to="/league" replace />
  }

  function tribeFor(castaway: { original_tribe_id: string | null }) {
    const tribe = (tribesQuery.data ?? []).find((row) => row.id === castaway.original_tribe_id)
    if (!tribe) return null
    return { name: tribe.name, colorName: tribe.color_name }
  }

  return (
    <PageContainer>
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          <Link to={`/leagues/${leagueId}`} className="underline">
            Back to lobby
          </Link>
        </p>
        <h1 className="font-display text-2xl font-semibold">Draft Room</h1>
        <p className="text-sm text-muted-foreground">
          One pick at a time. Pick order re-spins after every round. Tribe pools alternate each
          pass. A castaway can join at most two teams.
        </p>
      </div>

      {leagueQuery.isLoading || sessionQuery.isLoading || castawaysQuery.isLoading ? (
        <LoadingState label="Opening draft room" />
      ) : null}
      {leagueQuery.error || sessionQuery.error ? (
        <ErrorState description="This draft room is not available." />
      ) : null}

      {showWheel && user && session ? (
        <DraftOrderWheel
          key={session.orderSeed ?? session.pickOrder.join('|')}
          pickOrder={session.pickOrder}
          labels={memberLabels}
          userId={user.id}
          orderSeed={session.orderSeed}
          roundNumber={draftRoundNumber(session.pickOrder, session.currentPickIndex)}
          onContinue={handleOrderContinue}
          continuePending={ackOrder.isPending}
        />
      ) : null}

      {session &&
      selecting &&
      (session.draftPhase === 'picking' ||
        (orderAckedLocally && session.draftPhase === 'revealing')) ? (
        <section className="space-y-2 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
          {session.draftPhase === 'picking' ? (
            <>
              <p className="font-medium">
                {isMyTurn ? 'Your turn' : `Waiting for ${currentPickerName}`}
              </p>
              <p className="text-sm text-muted-foreground">
                Active tribe: {currentTribe?.name ?? '…'}
                {currentTribe?.color_name ? ` (${currentTribe.color_name})` : ''}
              </p>
            </>
          ) : session.draftPhase === 'mvp' ? (
            <p className="font-medium">Draft complete — choose your MVP</p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Your roster {myRoster.length}/{rosterSize}
          </p>
        </section>
      ) : null}

      {myRoster.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-medium">Your picks</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {myRoster.map((entry) => {
              const castaway = castawaysQuery.data?.find((row) => row.id === entry.castaway_id)
              return (
                <li key={entry.id}>
                  <CastawayPickCard
                    static
                    name={castaway?.display_name ?? 'Castaway'}
                    photoUrl={castaway?.photo_url}
                    tribe={castaway ? tribeFor(castaway) : null}
                    selected
                  />
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {session?.draftPhase === 'picking' && selecting
        ? (tribesQuery.data ?? []).map((tribe) => {
            const members = (castawaysQuery.data ?? []).filter(
              (castaway) => castaway.original_tribe_id === tribe.id,
            )
            const isActiveTribe = tribe.id === currentTribeId
            return (
              <section key={tribe.id} className="space-y-2">
                <h2 className="font-medium">
                  {tribe.name}
                  {isActiveTribe ? ' · picking now' : ''}
                </h2>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {members.map((castaway) => {
                    const claims = claimCounts[castaway.id] ?? 0
                    const claimedOut = isCastawayClaimedOut(claims)
                    const mine = myIds.has(castaway.id)
                    const canPick =
                      isMyTurn && isActiveTribe && !claimedOut && !mine && !submitPick.isPending
                    return (
                      <li key={castaway.id}>
                        <CastawayPickCard
                          name={castaway.display_name}
                          photoUrl={castaway.photo_url}
                          tribe={tribeFor(castaway)}
                          selected={mine}
                          disabled={!canPick}
                          badge={
                            mine ? 'Yours' : claimedOut ? 'Taken' : claims > 0 ? `${claims}/2` : null
                          }
                          onClick={canPick ? () => void submitPick.mutateAsync(castaway.id) : undefined}
                        />
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })
        : null}

      {session?.draftPhase === 'mvp' && rosterComplete ? (
        <section className="space-y-2">
          <h2 className="font-medium">Choose MVP</h2>
          <p className="text-sm text-muted-foreground">
            30 extra points only if they win the season.
          </p>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {myRoster.map((entry) => {
              const castaway = castawaysQuery.data?.find((row) => row.id === entry.castaway_id)
              const isMvp = mvpQuery.data?.castaway_id === entry.castaway_id
              return (
                <li key={entry.id}>
                  <CastawayPickCard
                    name={castaway?.display_name ?? 'Castaway'}
                    photoUrl={castaway?.photo_url}
                    tribe={castaway ? tribeFor(castaway) : null}
                    selected={isMvp}
                    disabled={!selecting || setMvp.isPending}
                    onClick={() => void setMvp.mutateAsync(entry.castaway_id)}
                  />
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {selecting && session?.draftPhase === 'mvp' && rosterComplete && mvpQuery.data ? (
        <Button
          type="button"
          className="min-h-11"
          onClick={() => void ready.mutateAsync(!selfReady)}
        >
          {selfReady ? 'Mark unready' : 'Mark ready'}
        </Button>
      ) : null}

      {isCommissioner && selecting && session?.draftPhase === 'mvp' ? (
        <Button
          type="button"
          variant="secondary"
          className="min-h-11"
          disabled={lock.isPending}
          onClick={() => void lock.mutateAsync()}
        >
          {lock.isPending ? 'Locking…' : 'Lock league'}
        </Button>
      ) : null}

      {(castawaysQuery.data ?? []).length === 0 && !castawaysQuery.isLoading ? (
        <EmptyState
          title="Season 51 cast is not in SFL yet"
          description="The draft room is ready once castaways are imported."
        />
      ) : null}

      {actionError ? (
        <ErrorState
          description={draftErrorCopy(
            classifyDraftError(
              actionError instanceof Error ? actionError.message : String(actionError),
            ),
          )}
        />
      ) : null}
    </PageContainer>
  )
}
