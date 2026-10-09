import { useMemo } from 'react'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import {
  buildStandings,
  lastUpdatedLabel,
} from '@/domain/standings/build-standings'
import { leagueNextAction } from '@/domain/standings/next-action'
import type {
  LeagueMember,
  MemberEpisodePoints,
} from '@/domain/standings/types'
import type { ActiveLeague } from '@/features/league/active-league-context'
import { useAuth } from '@/features/auth/use-auth'
import { ensureAuthSession } from '@/lib/ensure-auth-session'
import { firstRelated } from '@/domain/fantasy-tribe/avatar'
import { getSupabaseClient } from '@/lib/supabase'

/** First fetch in flight. Avoid isPending alone — invalidation gaps look "pending" forever. */
function awaitingInitial(query: Pick<UseQueryResult, 'isLoading'>) {
  return query.isLoading
}

/**
 * Each screen asks only for the reads it renders. Opening Tribe used to fire
 * standings, scores, and rules at the same time; installed PWAs then left the
 * extra calls pending, and every screen except Tribe waited on all of them.
 */
export const LEAGUE_WEEK_VIEWS = {
  tribe: ['roster', 'mvp', 'lineScores', 'castaways', 'rules'],
  standings: ['members', 'episodeScores', 'episodes', 'published'],
  home: ['members', 'episodeScores', 'episodes', 'published'],
  rules: ['rules'],
  episode: ['lineScores', 'episodeScores', 'episodes', 'castaways'],
  merge: ['roster', 'castaways', 'rules'],
} as const

export type LeagueWeekView = keyof typeof LEAGUE_WEEK_VIEWS
export type LeagueWeekPart = (typeof LEAGUE_WEEK_VIEWS)[LeagueWeekView][number]

export function leagueWeekIncludes(view: LeagueWeekView, part: LeagueWeekPart) {
  return (LEAGUE_WEEK_VIEWS[view] as readonly LeagueWeekPart[]).includes(part)
}

export function useLeagueWeek(
  league: ActiveLeague | null,
  view: LeagueWeekView,
) {
  const { user } = useAuth()
  const leagueId = league?.id
  const seasonId = league?.season_id
  const needs = (part: LeagueWeekPart) => leagueWeekIncludes(view, part)
  const canQuery = Boolean(user && leagueId)
  const canQuerySeason = Boolean(user && seasonId)

  const membersQuery = useQuery({
    queryKey: ['league-members', leagueId],
    enabled: canQuery && needs('members'),
    queryFn: async ({ signal }) => {
      await ensureAuthSession()
      const supabase = getSupabaseClient()
      const { data: members, error } = await supabase
        .from('league_members')
        .select(
          `
          user_id,
          role,
          status,
          fantasy_tribe_name,
          fantasy_tribe_color,
          avatar_path,
          avatar_updated_at,
          avatar_castaway:castaways ( photo_url )
        `,
        )
        .eq('league_id', leagueId!)
        .eq('status', 'active')
        .abortSignal(signal)
      if (error) throw error
      const ids = members.map((member) => member.user_id)
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', ids)
        .abortSignal(signal)
      if (profileError) throw profileError
      return members.map((member) => {
        const profileName =
          profiles.find((profile) => profile.id === member.user_id)
            ?.display_name ?? 'League member'
        const tribeName = member.fantasy_tribe_name?.trim()
        return {
          ...member,
          displayName: tribeName || profileName,
          profileName,
          fantasyTribeColor: member.fantasy_tribe_color,
          avatarPhotoUrl:
            firstRelated(member.avatar_castaway)?.photo_url ?? null,
          avatarPath: member.avatar_path,
          avatarUpdatedAt: member.avatar_updated_at,
        }
      })
    },
  })

  const episodeScoresQuery = useQuery({
    queryKey: ['member-episode-scores', leagueId],
    enabled: canQuery && needs('episodeScores'),
    queryFn: async ({ signal }) => {
      await ensureAuthSession()
      const { data, error } = await getSupabaseClient()
        .from('member_episode_scores')
        .select('league_id, member_id, episode_id, episode_number, points')
        .eq('league_id', leagueId!)
        .abortSignal(signal)
      if (error) throw error
      return data
    },
  })

  const lineScoresQuery = useQuery({
    queryKey: ['member-episode-castaway-scores', leagueId],
    enabled: canQuery && needs('lineScores'),
    queryFn: async ({ signal }) => {
      await ensureAuthSession()
      const { data, error } = await getSupabaseClient()
        .from('member_episode_castaway_scores')
        .select(
          'league_id, member_id, roster_entry_id, castaway_id, acquisition_type, starts_episode, ends_episode, episode_id, episode_number, points_total, revision, published_at, is_mvp_bonus',
        )
        .eq('league_id', leagueId!)
        .abortSignal(signal)
      if (error) throw error
      return data
    },
  })

  const episodesQuery = useQuery({
    queryKey: ['episodes', seasonId],
    enabled: canQuerySeason && needs('episodes'),
    queryFn: async ({ signal }) => {
      await ensureAuthSession()
      const { data, error } = await getSupabaseClient()
        .from('episodes')
        .select('id, episode_number, status, published_score_revision, phase')
        .eq('season_id', seasonId!)
        .order('episode_number')
        .abortSignal(signal)
      if (error) throw error
      return data
    },
  })

  const publishedQuery = useQuery({
    queryKey: ['published-scores', seasonId],
    enabled: canQuerySeason && needs('published'),
    staleTime: 0,
    queryFn: async ({ signal }) => {
      await ensureAuthSession()
      const { data, error } = await getSupabaseClient()
        .from('published_castaway_episode_scores')
        .select(
          'episode_number, published_at, revision, points_total, castaway_id',
        )
        .eq('season_id', seasonId!)
        .abortSignal(signal)
      if (error) throw error
      return data
    },
  })

  const rosterQuery = useQuery({
    queryKey: ['roster', leagueId],
    enabled: canQuery && needs('roster'),
    queryFn: async ({ signal }) => {
      await ensureAuthSession()
      const { data, error } = await getSupabaseClient()
        .from('roster_entries')
        .select(
          `
          id,
          member_id,
          castaway_id,
          acquisition_type,
          slot_number,
          starts_episode,
          ends_episode,
          castaway:castaways (
            id,
            display_name,
            status,
            photo_url,
            original_tribe_id
          )
        `,
        )
        .eq('league_id', leagueId!)
        .order('slot_number')
        .abortSignal(signal)
      if (error) throw error
      return data
    },
  })

  const mvpQuery = useQuery({
    queryKey: ['mvp', leagueId],
    enabled: canQuery && needs('mvp'),
    queryFn: async ({ signal }) => {
      await ensureAuthSession()
      const { data, error } = await getSupabaseClient()
        .from('mvp_selections')
        .select('member_id, castaway_id')
        .eq('league_id', leagueId!)
        .abortSignal(signal)
      if (error) throw error
      return data
    },
  })

  const castawaysQuery = useQuery({
    queryKey: ['castaways', seasonId],
    enabled: canQuerySeason && needs('castaways'),
    queryFn: async ({ signal }) => {
      await ensureAuthSession()
      const { data, error } = await getSupabaseClient()
        .from('castaways')
        .select(
          'id, display_name, status, final_placement, eliminated_episode_number, photo_url, original_tribe_id',
        )
        .eq('season_id', seasonId!)
        .order('display_name')
        .abortSignal(signal)
      if (error) throw error
      return data
    },
  })

  const hasRuleSet = Boolean(league?.ruleset_version_id)
  const ruleSetQuery = useQuery({
    queryKey: ['rule-set-for-league', leagueId],
    enabled: canQuery && hasRuleSet && needs('rules'),
    queryFn: async ({ signal }) => {
      await ensureAuthSession()
      const { data, error } = await getSupabaseClient()
        .from('rule_sets')
        .select(
          'id, version, status, pending_confirmation, source_url, roster_size, wildcard_slots, first_scored_episode, scoring_rules(code, label, points, kind, phase, sort_order)',
        )
        .eq('id', league!.ruleset_version_id)
        .abortSignal(signal)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  const publishedNumbers = useMemo(() => {
    const numbers = [
      ...new Set(
        (publishedQuery.data ?? [])
          .map((row) => row.episode_number)
          .filter(Boolean),
      ),
    ] as number[]
    return numbers.sort((a, b) => a - b)
  }, [publishedQuery.data])

  const latestEpisode = publishedNumbers.at(-1) ?? null
  const previousEpisode =
    publishedNumbers.length > 1 ? publishedNumbers.at(-2)! : null
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
        fantasyTribeColor: member.fantasyTribeColor ?? null,
      })),
    [leagueId, membersQuery.data],
  )

  const episodePoints: MemberEpisodePoints[] = useMemo(
    () =>
      (episodeScoresQuery.data ?? []).flatMap((row) =>
        row.league_id &&
        row.member_id &&
        row.episode_number != null &&
        row.points != null
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
      }),
    [episodePoints, latestEpisode, members, previousEpisode],
  )

  const nextAction = league
    ? leagueNextAction({
        leagueId: league.id,
        status: league.status,
        hasPublishedScores,
        latestEpisode,
      })
    : null

  const selfStanding =
    standings.find((row) => row.memberId === user?.id) ?? null
  const latestEpisodeMeta = (episodesQuery.data ?? []).find(
    (episode) => episode.episode_number === latestEpisode,
  )
  const latestCorrected =
    latestEpisodeMeta?.status === 'corrected' ||
    (publishedQuery.data ?? []).some(
      (row) => row.episode_number === latestEpisode && (row.revision ?? 1) > 1,
    )

  // isLoading (pending+fetching) only — networkMode:'always' avoids the old
  // paused-empty "Waiting on scores" flash without locking on invalidation gaps.
  const loading =
    Boolean(league && (canQuery || canQuerySeason)) &&
    ((needs('members') && awaitingInitial(membersQuery)) ||
      (needs('episodeScores') && awaitingInitial(episodeScoresQuery)) ||
      (needs('lineScores') && awaitingInitial(lineScoresQuery)) ||
      (needs('episodes') && awaitingInitial(episodesQuery)) ||
      (needs('published') && awaitingInitial(publishedQuery)) ||
      (needs('roster') && awaitingInitial(rosterQuery)) ||
      (needs('mvp') && awaitingInitial(mvpQuery)) ||
      (needs('castaways') && awaitingInitial(castawaysQuery)) ||
      (needs('rules') && hasRuleSet && awaitingInitial(ruleSetQuery)))
  /** Tribe paints from roster, castaway identity, MVP, and line scores. */
  const tribeLoading =
    Boolean(league && canQuery) &&
    (awaitingInitial(rosterQuery) ||
      awaitingInitial(castawaysQuery) ||
      awaitingInitial(mvpQuery) ||
      awaitingInitial(lineScoresQuery))
  const fetching =
    (needs('members') && membersQuery.isFetching) ||
    (needs('episodeScores') && episodeScoresQuery.isFetching) ||
    (needs('lineScores') && lineScoresQuery.isFetching) ||
    (needs('episodes') && episodesQuery.isFetching) ||
    (needs('published') && publishedQuery.isFetching) ||
    (needs('roster') && rosterQuery.isFetching) ||
    (needs('mvp') && mvpQuery.isFetching) ||
    (needs('castaways') && castawaysQuery.isFetching) ||
    (needs('rules') && ruleSetQuery.isFetching)
  const error =
    (needs('members') ? membersQuery.error : null) ??
    (needs('episodeScores') ? episodeScoresQuery.error : null) ??
    (needs('lineScores') ? lineScoresQuery.error : null) ??
    (needs('episodes') ? episodesQuery.error : null) ??
    (needs('published') ? publishedQuery.error : null) ??
    (needs('roster') ? rosterQuery.error : null) ??
    (needs('mvp') ? mvpQuery.error : null) ??
    (needs('castaways') ? castawaysQuery.error : null) ??
    (needs('rules') ? ruleSetQuery.error : null)

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
    tribeLoading,
    fetching,
    error:
      error instanceof Error
        ? error
        : error
          ? new Error('Could not load league week')
          : null,
    refetch: () => {
      if (needs('members')) void membersQuery.refetch()
      if (needs('episodeScores')) void episodeScoresQuery.refetch()
      if (needs('lineScores')) void lineScoresQuery.refetch()
      if (needs('episodes')) void episodesQuery.refetch()
      if (needs('published')) void publishedQuery.refetch()
      if (needs('roster')) void rosterQuery.refetch()
      if (needs('mvp')) void mvpQuery.refetch()
      if (needs('castaways')) void castawaysQuery.refetch()
      if (needs('rules')) void ruleSetQuery.refetch()
    },
  }
}
