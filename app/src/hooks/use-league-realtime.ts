import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateLeagueScoreQueries } from '@/domain/standings/query-keys'
import { getSupabaseClient } from '@/lib/supabase'

export function useLeagueRealtime(leagueId?: string | null, seasonId?: string | null) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!leagueId || !seasonId) return
    const supabase = getSupabaseClient()
    const invalidate = () => invalidateLeagueScoreQueries(queryClient, leagueId, seasonId)
    const channel = supabase
      .channel(`kindling-league-${leagueId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'episodes', filter: `season_id=eq.${seasonId}` },
        invalidate,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'castaway_episode_score_revisions',
          filter: `season_id=eq.${seasonId}`,
        },
        invalidate,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'roster_entries', filter: `league_id=eq.${leagueId}` },
        invalidate,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mvp_selections', filter: `league_id=eq.${leagueId}` },
        invalidate,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leagues', filter: `id=eq.${leagueId}` },
        invalidate,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'merge_moves', filter: `league_id=eq.${leagueId}` },
        invalidate,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'seasons', filter: `id=eq.${seasonId}` },
        invalidate,
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [leagueId, queryClient, seasonId])
}
