export const ACTIVE_LEAGUE_STORAGE_KEY = 'kindling.activeLeagueId'
export const ACTIVE_LEAGUE_EVENT = 'kindling-active-league'

export function readActiveLeagueId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_LEAGUE_STORAGE_KEY)
  } catch {
    return null
  }
}

export function writeActiveLeagueId(leagueId: string) {
  try {
    window.localStorage.setItem(ACTIVE_LEAGUE_STORAGE_KEY, leagueId)
  } catch {
    return
  }
  window.dispatchEvent(new Event(ACTIVE_LEAGUE_EVENT))
}
