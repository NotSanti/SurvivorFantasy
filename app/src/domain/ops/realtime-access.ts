export const LEAGUE_REALTIME_TABLES = [
  'episodes',
  'castaway_episode_score_revisions',
  'roster_entries',
  'mvp_selections',
  'leagues',
  'merge_moves',
  'seasons',
] as const

export const SERVICE_ROLE_ONLY_RPCS = [
  'claim_notification_outbox',
  'complete_notification_outbox',
  'revoke_push_endpoint',
] as const

export const FORBIDDEN_REALTIME_TABLES = [
  'audit_log',
  'notification_outbox',
  'score_events',
  'league_invites',
  'push_subscriptions',
] as const

export function isLeagueRealtimeTable(table: string): boolean {
  return (LEAGUE_REALTIME_TABLES as readonly string[]).includes(table)
}

export function isForbiddenRealtimeTable(table: string): boolean {
  return (FORBIDDEN_REALTIME_TABLES as readonly string[]).includes(table)
}
