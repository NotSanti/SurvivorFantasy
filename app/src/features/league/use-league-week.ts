import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { buildStandings, lastUpdatedLabel } from '@/domain/standings/build-standings'
import { leagueNextAction } from '@/domain/standings/next-action'
import type { LeagueMember, MemberEpisodePoints } from '@/domain/standings/types'
import type { ActiveLeague } from '@/features/league/active-league-context'
import { useAuth } from '@/features/auth/use-auth'
import { getSupabaseClient } from '@/lib/supabase'
import type { SpoilerMode } from '@/domain/standings/types'

export function useLeagueWeek(league: ActiveLeague | null, spoilerMode: SpoilerMode) {
  const { user } = useAuth()
  const leagueId = league?.id
  const seasonId = league?.season_id

  const membersQuery = useQuery({
    queryKey: ['league-members', leagueId],
    enabled: Boolean(leagueId),
    queryFn: async () => {
      const supabase = getSupabaseClient()
      const { data: members, error } = await supabase
        .from('league_members')
        .select('user_id, role, status')
        .eq('league_id', leagueId!)
        .eq('status', 'active')
      if (error) throw error
      const ids = members.map((member) => member.user_id)
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', ids)
      if (profileError) throw profileError
      return members.map((member) => ({
        ...member,
        displayName:
          profiles.find((profile) => profile.id === member.user_id)?.display_name ?? 'League member',
      }))
    },
  })

  const episodeScoresQuery = useQuery({
    queryKey: ['member-episode-scores', leagueId],
    enabled: Boolean(leagueId),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('member_episode_scores')
        .select('league_id, member_id, episode_id, episode_number, points')
        .eq('league_id', leagueId!)
      if (error) throw error
      return data
    },
  })

  const lineScoresQuery = useQuery({
    queryKey: ['member-episode-castaway-scores', leagueId],
    enabled: Boolean(leagueId),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('member_episode_castaway_scores')
        .select(
          'league_id, member_id, roster_entry_id, castaway_id, acquisition_type, starts_episode, ends_episode, episode_id, episode_number, points_total, revision, published_at, is_mvp_bonus',
        )
        .eq('league_id', leagueId!)
      if (error) throw error
      return data
    },
  })

  const episodesQuery = useQuery({
    queryKey: ['episodes', seasonId],
    enabled: Boolean(seasonId),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('episodes')
        .select('id, episode_number, status, published_score_revision, phase')
        .eq('season_id', seasonId!)
        .order('episode_number')
      if (error) throw error
      return data
    },
  })

  const publishedQuery = useQuery({
    queryKey: ['published-scores', seasonId],
    enabled: Boolean(seasonId),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('published_castaway_episode_scores')
        .select('episode_number, published_at, revision, points_total, castaway_id')
        .eq('season_id', seasonId!)
      if (error) throw error
      return data
    },
  })

  const rosterQuery = useQuery({
    queryKey: ['roster', leagueId],
    enabled: Boolean(leagueId),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('roster_entries')
        .select(
          'id, member_id, castaway_id, acquisition_type, slot_number, starts_episode, ends_episode',
        )
        .eq('league_id', leagueId!)
        .order('slot_number')
      if (error) throw error
      return data
    },
  })

  const mvpQuery = useQuery({
    queryKey: ['mvp', leagueId],
    enabled: Boolean(leagueId),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('mvp_selections')
        .select('member_id, castaway_id')
        .eq('league_id', leagueId!)
      if (error) throw error
      return data
    },
  })

  const castawaysQuery = useQuery({
    queryKey: ['castaways', seasonId],
    enabled: Boolean(seasonId),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('castaways')
        .select('id, display_name, status, final_placement, eliminated_episode_number')
        .eq('season_id', seasonId!)
        .order('display_name')
      if (error) throw error
      return data
    },
  })

  const ruleSetQuery = useQuery({
    queryKey: ['rule-set-for-league', leagueId],
    enabled: Boolean(league?.ruleset_version_id),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('rule_sets')
        .select(
          'id, version, status, pending_confirmation, source_url, roster_size, wildcard_slots, first_scored_episode, scoring_rules(code, label, points, kind, phase, sort_order)',
        )
        .eq('id', league!.ruleset_version_id)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  const publishedNumbers = useMemo(() => {
    const numbers = [
      ...new Set((publishedQuery.data ?? []).map((row) => row.episode_number).filter(Boolean)),
    ] as number[]
    return numbers.sort((a, b) => a - b)
  }, [publishedQuery.data])

  const latestEpisode = publishedNumbers.at(-1) ?? null
  const previousEpisode = publishedNumbers.length > 1 ? publishedNumbers.at(-2)! : null
  const hasPublishedScores = publishedNumbers.length > 0

  const lastUpdated = useMemo(() => {
    const stamps = (publishedQuery.data ?? [])
      .map((row) => row.published_at)
      .filter((value): value is string => Boolean(value))
    if (stamps.length === 0) return null
    return stamps.sort().at(-1) ?? null
  }, [publishedQuery.data])

  const members: LeagueMember[] = useMemo(
    () =>
      (membersQuery.data ?? []).map((member) => ({
        leagueId: leagueId ?? '',
        memberId: member.user_id,
        displayName: member.displayName,
      })),
    [leagueId, membersQuery.data],
  )

  const episodePoints: MemberEpisodePoints[] = useMemo(
    () =>
      (episodeScoresQuery.data ?? []).flatMap((row) =>
        row.league_id && row.member_id && row.episode_number != null && row.points != null
          ? [
              {
                leagueId: row.league_id,
                memberId: row.member_id,
                episodeNumber: row.episode_number,
                points: row.points,
              },
            ]
          : [],
      ),
    [episodeScoresQuery.data],
  )

  const standings = useMemo(
    () =>
      buildStandings({
        members,
        episodePoints,
        latestEpisode,
        previousEpisode,
        spoilerMode,
      }),
    [episodePoints, latestEpisode, members, previousEpisode, spoilerMode],
  )

  const nextAction = league
    ? leagueNextAction({
        leagueId: league.id,
        status: league.status,
        hasPublishedScores,
        latestEpisode,
      })
    : null

  const selfStanding = standings.find((row) => row.memberId === user?.id) ?? null
  const latestEpisodeMeta = (episodesQuery.data ?? []).find(
    (episode) => episode.episode_number === latestEpisode,
  )
  const latestCorrected =
    latestEpisodeMeta?.status === 'corrected' ||
    (publishedQuery.data ?? []).some(
      (row) => row.episode_number === latestEpisode && (row.revision ?? 1) > 1,
    )

  const loading =
    membersQuery.isLoading ||
    episodeScoresQuery.isLoading ||
    episodesQuery.isLoading ||
    publishedQuery.isLoading ||
    rosterQuery.isLoading
  const fetching =
    membersQuery.isFetching ||
    episodeScoresQuery.isFetching ||
    publishedQuery.isFetching ||
    rosterQuery.isFetching
  const error =
    membersQuery.error ??
    episodeScoresQuery.error ??
    episodesQuery.error ??
    publishedQuery.error ??
    rosterQuery.error ??
    mvpQuery.error ??
    castawaysQuery.error

  return {
    members: membersQuery.data ?? [],
    episodeScores: episodeScoresQuery.data ?? [],
    lineScores: lineScoresQuery.data ?? [],
    episodes: episodesQuery.data ?? [],
    publishedScores: publishedQuery.data ?? [],
    roster: rosterQuery.data ?? [],
    mvps: mvpQuery.data ?? [],
    castaways: castawaysQuery.data ?? [],
    ruleSet: ruleSetQuery.data,
    standings,
    nextAction,
    selfStanding,
    latestEpisode,
    previousEpisode,
    hasPublishedScores,
    lastUpdated,
    lastUpdatedLabel: lastUpdatedLabel(lastUpdated),
    latestCorrected,
    publishedNumbers,
    loading,
    fetching,
    error: error instanceof Error ? error : error ? new Error('Could not load league week') : null,
    refetch: () => {
      void membersQuery.refetch()
      void episodeScoresQuery.refetch()
      void lineScoresQuery.refetch()
      void episodesQuery.refetch()
      void publishedQuery.refetch()
      void rosterQuery.refetch()
      void mvpQuery.refetch()
      void castawaysQuery.refetch()
      void ruleSetQuery.refetch()
    },
  }
}
