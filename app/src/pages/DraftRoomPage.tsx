import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { classifyDraftError, draftErrorCopy } from '@/domain/draft/errors'
import {
  evaluateManualPicks,
  manualSlotCount,
  parseManualDistribution,
} from '@/domain/draft/quotas'
import { QuotaMeter } from '@/features/draft/QuotaMeter'
import { WildcardReveal } from '@/features/draft/WildcardReveal'
import { useAuth } from '@/features/auth/use-auth'
import { writeActiveLeagueId } from '@/features/league/active-league-storage'
import { getSupabaseClient } from '@/lib/supabase'

function wildcardKey(leagueId: string, userId: string) {
  const storageKey = `kindling.wildcard.${leagueId}.${userId}`
  const existing = sessionStorage.getItem(storageKey)
  if (existing) return existing
  const next = crypto.randomUUID()
  sessionStorage.setItem(storageKey, next)
  return next
}

export function DraftRoomPage() {
  const { leagueId } = useParams()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [revealName, setRevealName] = useState<string | null>(null)

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
        .select('id, roster_size, picks_per_original_tribe')
        .eq('id', league.ruleset_version_id)
        .single()
      if (ruleError) throw ruleError
      return { league, ruleSet }
    },
  })

  const tribesQuery = useQuery({
    queryKey: ['draft-tribes', leagueQuery.data?.league.season_id],
    enabled: Boolean(leagueQuery.data?.league.season_id),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('tribes')
        .select('id, name, sort_order')
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
        .select('id, display_name, original_tribe_id, status, season_id')
        .eq('season_id', leagueQuery.data!.league.season_id)
        .eq('status', 'active')
      if (error) throw error
      return data
    },
  })

  const rosterQuery = useQuery({
    queryKey: ['draft-roster', leagueId, user?.id],
    enabled: Boolean(leagueId && user?.id),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('roster_entries')
        .select('id, castaway_id, acquisition_type, slot_number')
        .eq('league_id', leagueId!)
        .eq('member_id', user!.id)
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

  const selfQuery = useQuery({
    queryKey: ['draft-self', leagueId, user?.id],
    enabled: Boolean(leagueId && user?.id),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('league_members')
        .select('ready_at, role')
        .eq('league_id', leagueId!)
        .eq('user_id', user!.id)
        .single()
      if (error) throw error
      return data
    },
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['draft-roster', leagueId, user?.id] })
    void queryClient.invalidateQueries({ queryKey: ['draft-mvp', leagueId, user?.id] })
    void queryClient.invalidateQueries({ queryKey: ['draft-self', leagueId, user?.id] })
    void queryClient.invalidateQueries({ queryKey: ['league', leagueId] })
    void queryClient.invalidateQueries({ queryKey: ['league-members', leagueId] })
  }

  const savePicks = useMutation({
    mutationFn: async (castawayIds: string[]) => {
      const { error } = await getSupabaseClient().rpc('save_manual_picks', {
        p_league_id: leagueId!,
        p_castaway_ids: castawayIds,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
  const wildcard = useMutation({
    mutationFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('request_wildcard', {
        p_league_id: leagueId!,
        p_idempotency_key: wildcardKey(leagueId!, user!.id),
      })
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      invalidate()
      const selectedId =
        data && typeof data === 'object' && 'selected_castaway_id' in data
          ? String((data as { selected_castaway_id: string }).selected_castaway_id)
          : null
      const name = castawaysQuery.data?.find((row) => row.id === selectedId)?.display_name
      if (name) setRevealName(name)
    },
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
    onSuccess: invalidate,
  })

  const distribution = parseManualDistribution(
    leagueQuery.data?.ruleSet.picks_per_original_tribe,
  )
  const rosterRows = rosterQuery.data
  const manual = useMemo(
    () => (rosterRows ?? []).filter((row) => row.acquisition_type === 'manual'),
    [rosterRows],
  )
  const wild = rosterRows?.find((row) => row.acquisition_type === 'wildcard')
  const selectedIds = new Set(manual.map((row) => row.castaway_id))
  const selecting = leagueQuery.data?.league.status === 'selecting'
  const locked = Boolean(
    leagueQuery.data?.league.status &&
      !['recruiting', 'selecting'].includes(leagueQuery.data.league.status),
  )
  const isCommissioner = leagueQuery.data?.league.commissioner_id === user?.id
  const actionError =
    savePicks.error ?? wildcard.error ?? setMvp.error ?? ready.error ?? lock.error

  const quota = useMemo(() => {
    if (!distribution || !leagueQuery.data) return null
    const picks = manual
      .map((row) => castawaysQuery.data?.find((castaway) => castaway.id === row.castaway_id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .map((row) => ({
        castawayId: row.id,
        seasonId: row.season_id,
        originalTribeId: row.original_tribe_id,
        status: row.status,
      }))
    return evaluateManualPicks(picks, leagueQuery.data.league.season_id, distribution)
  }, [castawaysQuery.data, distribution, leagueQuery.data, manual])

  async function toggleCastaway(castawayId: string) {
    if (!selecting || wild) return
    const next = selectedIds.has(castawayId)
      ? manual.filter((row) => row.castaway_id !== castawayId).map((row) => row.castaway_id)
      : [...manual.map((row) => row.castaway_id), castawayId]
    await savePicks.mutateAsync(next)
  }

  const tribes = tribesQuery.data ?? []
  const cap = distribution?.perTribe ?? 3
  const unassignedCastaways = (castawaysQuery.data ?? [])
    .filter((castaway) => !castaway.original_tribe_id)
    .slice()
    .sort((a, b) => a.display_name.localeCompare(b.display_name))

  function renderCastawayButton(
    castaway: { id: string; display_name: string; original_tribe_id: string | null },
    canPick: boolean,
  ) {
    const selected = selectedIds.has(castaway.id) || wild?.castaway_id === castaway.id
    const isWildcard = wild?.castaway_id === castaway.id
    return (
      <li key={castaway.id}>
        <Button
          type="button"
          variant={selected ? 'default' : 'outline'}
          className="min-h-11 w-full justify-between"
          aria-pressed={selected}
          disabled={!canPick || !selecting || Boolean(wild) || savePicks.isPending}
          onClick={() => void toggleCastaway(castaway.id)}
        >
          <span>{castaway.display_name}</span>
          {isWildcard ? <Badge>Wildcard</Badge> : selected ? <Badge>Picked</Badge> : null}
        </Button>
      </li>
    )
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
          Shared pool — the same castaway can be on every roster. Other camps stay hidden until
          lock.
        </p>
      </div>
      {leagueQuery.isLoading ||
      tribesQuery.isLoading ||
      castawaysQuery.isLoading ||
      rosterQuery.isLoading ? (
        <LoadingState label="Opening draft room" />
      ) : null}
      {leagueQuery.error ? <ErrorState description="This draft room is not available." /> : null}
      {distribution && tribes.length > 0 ? (
        <QuotaMeter
          manualTotal={manual.length}
          manualSlots={manualSlotCount(distribution)}
          tribes={tribes.map((tribe) => ({
            id: tribe.id,
            name: tribe.name,
            cap,
            count: quota?.countsByTribe[tribe.id] ?? 0,
          }))}
        />
      ) : null}
      {(castawaysQuery.data ?? []).length === 0 && !castawaysQuery.isLoading ? (
        <EmptyState
          title="Season 51 cast is not in Kindling yet"
          description="The draft room is ready. Picks stay disabled until official tribes and castaways are imported. We will not invent them."
        />
      ) : null}
      {unassignedCastaways.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-medium">Season 51 cast</h2>
          <p className="text-sm text-muted-foreground">
            {unassignedCastaways.length} posted castaways. Original tribe membership is not public
            yet, so 3/3/2 picks stay locked. We will not guess Savu or Toka assignments.
          </p>
          <ul className="grid grid-cols-1 gap-2">
            {unassignedCastaways.map((castaway) => renderCastawayButton(castaway, false))}
          </ul>
        </section>
      ) : null}
      {tribes.map((tribe) => {
        const members = (castawaysQuery.data ?? []).filter(
          (castaway) => castaway.original_tribe_id === tribe.id,
        )
        return (
          <section key={tribe.id} className="space-y-2">
            <h2 className="font-medium">{tribe.name}</h2>
            <ul className="grid grid-cols-1 gap-2">
              {members.map((castaway) => renderCastawayButton(castaway, true))}
            </ul>
          </section>
        )
      })}
      {quota?.ok && quota.complete && !wild && selecting ? (
        <Button
          type="button"
          className="min-h-11"
          disabled={wildcard.isPending}
          onClick={() => void wildcard.mutateAsync()}
        >
          {wildcard.isPending ? 'Drawing wildcard…' : 'Request wildcard'}
        </Button>
      ) : null}
      {wild ? (
        <section className="space-y-2">
          <h2 className="font-medium">Choose MVP</h2>
          <p className="text-sm text-muted-foreground">
            One of your nine, including the wildcard. 30 extra points only if they win the season.
          </p>
          <ul className="space-y-2">
            {(rosterQuery.data ?? []).map((entry) => {
              const name =
                castawaysQuery.data?.find((row) => row.id === entry.castaway_id)?.display_name ??
                'Castaway'
              const isMvp = mvpQuery.data?.castaway_id === entry.castaway_id
              return (
                <li key={entry.id}>
                  <Button
                    type="button"
                    variant={isMvp ? 'default' : 'outline'}
                    className="min-h-11 w-full"
                    disabled={!selecting || setMvp.isPending}
                    onClick={() => void setMvp.mutateAsync(entry.castaway_id)}
                  >
                    {name}
                    {isMvp ? ' · MVP' : ''}
                  </Button>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
      {selecting && wild && mvpQuery.data ? (
        <Button
          type="button"
          className="min-h-11"
          onClick={() => void ready.mutateAsync(!selfQuery.data?.ready_at)}
        >
          {selfQuery.data?.ready_at ? 'Mark unready' : 'Mark ready'}
        </Button>
      ) : null}
      {isCommissioner && selecting ? (
        <Button
          type="button"
          variant="secondary"
          className="min-h-11"
          onClick={() => void lock.mutateAsync()}
        >
          Lock league
        </Button>
      ) : null}
      {locked ? (
        <p className="text-sm text-muted-foreground">This league is locked. Rosters are now visible.</p>
      ) : null}
      {actionError ? (
        <ErrorState
          description={draftErrorCopy(
            classifyDraftError(actionError instanceof Error ? actionError.message : String(actionError)),
          )}
        />
      ) : null}
      {revealName ? (
        <WildcardReveal name={revealName} onDismiss={() => setRevealName(null)} />
      ) : null}
    </PageContainer>
  )
}
