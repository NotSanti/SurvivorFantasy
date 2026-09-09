import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ActiveLeagueContext, type ActiveLeague } from '@/features/league/active-league-context'
import {
  ACTIVE_LEAGUE_EVENT,
  readActiveLeagueId,
  writeActiveLeagueId,
} from '@/features/league/active-league-storage'
import { useAuth } from '@/features/auth/use-auth'
import { useLeagueRealtime } from '@/hooks/use-league-realtime'
import { getSupabaseClient } from '@/lib/supabase'

export function ActiveLeagueProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [storedId, setStoredId] = useState<string | null>(() => readActiveLeagueId())

  useEffect(() => {
    const sync = () => setStoredId(readActiveLeagueId())
    window.addEventListener(ACTIVE_LEAGUE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(ACTIVE_LEAGUE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const leaguesQuery = useQuery({
    queryKey: ['leagues', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('leagues')
        .select('id, name, status, season_id, ruleset_version_id, commissioner_id')
        .neq('status', 'archived')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const leagues = useMemo(() => leaguesQuery.data ?? [], [leaguesQuery.data])
  const activeLeague = useMemo<ActiveLeague | null>(() => {
    return leagues.find((league) => league.id === storedId) ?? leagues[0] ?? null
  }, [leagues, storedId])

  useEffect(() => {
    if (activeLeague && storedId !== activeLeague.id) {
      writeActiveLeagueId(activeLeague.id)
    }
  }, [activeLeague, storedId])

  useLeagueRealtime(activeLeague?.id, activeLeague?.season_id)

  const value = useMemo(
    () => ({
      leagues,
      activeLeague,
      loading: leaguesQuery.isLoading,
      error: leaguesQuery.error instanceof Error ? leaguesQuery.error : null,
      setActiveLeagueId: writeActiveLeagueId,
    }),
    [activeLeague, leagues, leaguesQuery.error, leaguesQuery.isLoading],
  )

  return <ActiveLeagueContext.Provider value={value}>{children}</ActiveLeagueContext.Provider>
}
