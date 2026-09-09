import type { QueryClient } from '@tanstack/react-query'

export function leagueScoreQueryKeys(leagueId: string, seasonId: string) {
  return [
    ['league', leagueId],
    ['league-members', leagueId],
    ['league-standings', leagueId],
    ['member-episode-scores', leagueId],
    ['member-episode-castaway-scores', leagueId],
    ['roster', leagueId],
    ['mvp', leagueId],
    ['merge-moves', leagueId],
    ['episodes', seasonId],
    ['published-scores', seasonId],
    ['season', seasonId],
    ['castaways', seasonId],
    ['rule-set-for-league', leagueId],
  ] as const
}

export function invalidateLeagueScoreQueries(
  queryClient: QueryClient,
  leagueId: string,
  seasonId: string,
) {
  for (const queryKey of leagueScoreQueryKeys(leagueId, seasonId)) {
    void queryClient.invalidateQueries({ queryKey: [...queryKey] })
  }
}
