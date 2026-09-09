import { useContext } from 'react'
import { ActiveLeagueContext, type ActiveLeagueState } from '@/features/league/active-league-context'

export function useActiveLeague(): ActiveLeagueState {
  const value = useContext(ActiveLeagueContext)
  if (!value) {
    throw new Error('useActiveLeague must be used within ActiveLeagueProvider')
  }
  return value
}
