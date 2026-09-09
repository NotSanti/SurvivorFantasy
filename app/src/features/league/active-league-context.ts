import { createContext } from 'react'
import type { Database } from '@/types/database'

export type ActiveLeague = Pick<
  Database['public']['Tables']['leagues']['Row'],
  'id' | 'name' | 'status' | 'season_id' | 'ruleset_version_id' | 'commissioner_id'
>

export type ActiveLeagueState = {
  leagues: ActiveLeague[]
  activeLeague: ActiveLeague | null
  loading: boolean
  error: Error | null
  setActiveLeagueId: (leagueId: string) => void
}

export const ActiveLeagueContext = createContext<ActiveLeagueState | null>(null)
