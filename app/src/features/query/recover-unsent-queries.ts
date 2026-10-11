import type { Query, QueryClient } from '@tanstack/react-query'

/**
 * Enabled read that never produced data and is not in flight. A fetch cancelled
 * while it was still queued ends here, and React Query will not retry it.
 * Window focus used to be the only thing that started it again.
 */
function isQueryEnabled(query: Query) {
  const enabled = (query.options as { enabled?: boolean }).enabled
  return enabled !== false
}

export function isUnsentInitialQuery(query: Query) {
  return (
    isQueryEnabled(query) &&
    query.getObserversCount() > 0 &&
    query.state.data === undefined &&
    query.state.status === 'pending' &&
    query.state.fetchStatus === 'idle'
  )
}

const MAX_UNSENT_RECOVERIES = 3

export function recoverUnsentQueries(
  queryClient: QueryClient,
  attempts: Map<string, number>,
) {
  const stuck = queryClient
    .getQueryCache()
    .findAll({ type: 'active' })
    .filter((query) => {
      if (!isUnsentInitialQuery(query)) return false
      return (attempts.get(query.queryHash) ?? 0) < MAX_UNSENT_RECOVERIES
    })
  if (stuck.length === 0) return
  for (const query of stuck) {
    attempts.set(query.queryHash, (attempts.get(query.queryHash) ?? 0) + 1)
  }
  const hashes = new Set(stuck.map((query) => query.queryHash))
  void queryClient.refetchQueries({
    type: 'active',
    predicate: (query) => hashes.has(query.queryHash),
  })
}
