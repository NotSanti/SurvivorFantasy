import { useEffect } from 'react'
import { useQueryClient, type Query, type QueryClient } from '@tanstack/react-query'

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

/**
 * iOS PWAs often skip window-focus refetch after backgrounding. Debounce resume
 * refreshes, and skip the first few seconds so cold-start score fetches can finish.
 * Reads cancelled before they were sent are restarted without waiting for focus.
 */
export function QueryLifecycle() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const coldStartUntil = Date.now() + 3000
    const recoverAttempts = new Map<string, number>()
    let timer: ReturnType<typeof setTimeout> | undefined
    let recoverTimer: ReturnType<typeof setTimeout> | undefined

    const scheduleRefresh = () => {
      if (document.visibilityState !== 'visible') return
      const failed = queryClient
        .getQueryCache()
        .findAll({ type: 'active' })
        .some((query) => query.state.status === 'error')
      // A cold start used to skip the first resume. Failed score reads need
      // that resume, which is when iOS has cleared the stuck sockets.
      if (!failed && Date.now() < coldStartUntil) return
      clearTimeout(timer)
      timer = setTimeout(() => {
        void queryClient.refetchQueries({
          type: 'active',
          predicate: (query) => query.isStale() || query.state.status === 'error',
        })
      }, 750)
    }

    const scheduleRecover = () => {
      clearTimeout(recoverTimer)
      // Let a normal mount start its own fetch. Only restart reads that are
      // still idle after that.
      recoverTimer = setTimeout(() => recoverUnsentQueries(queryClient, recoverAttempts), 400)
    }

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) scheduleRefresh()
    }

    const unsubscribe = queryClient.getQueryCache().subscribe(scheduleRecover)
    scheduleRecover()

    document.addEventListener('visibilitychange', scheduleRefresh)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      clearTimeout(timer)
      clearTimeout(recoverTimer)
      unsubscribe()
      document.removeEventListener('visibilitychange', scheduleRefresh)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [queryClient])

  return null
}
