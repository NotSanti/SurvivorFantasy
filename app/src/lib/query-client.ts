import { QueryClient } from '@tanstack/react-query'

/** Dropped PWA sockets surface as these. Auth and cancellations are not retries. */
export function isTransientQueryError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const name = 'name' in error && typeof error.name === 'string' ? error.name : ''
  const message = 'message' in error && typeof error.message === 'string' ? error.message : ''
  if (name === 'AbortError' || name === 'CancelledError') return false
  if (message === 'Not signed in') return false
  if (name === 'TimeoutError' || message.includes('timed out')) return true
  if (name === 'TypeError') return true
  return /Load failed|Failed to fetch|NetworkError/i.test(message)
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 30 * 60_000,
        retry: (failureCount, error) => failureCount < 3 && isTransientQueryError(error),
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        // iOS installed PWAs often flap navigator.onLine; default 'online' pauses
        // fetches (isLoading=false, no data) and the UI treats that as empty scores.
        networkMode: 'always',
      },
      mutations: {
        retry: 0,
        networkMode: 'always',
      },
    },
  })
}
