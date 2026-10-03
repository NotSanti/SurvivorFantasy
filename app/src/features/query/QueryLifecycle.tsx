import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/use-auth'

/**
 * PWA cold-start / resume often misses window-focus refetch, and iOS can pause
 * in-flight requests. Keep authenticated league data fresh when the session or
 * visibility changes.
 */
export function QueryLifecycle() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const accessToken = session?.access_token

  useEffect(() => {
    if (!accessToken) return
    void queryClient.invalidateQueries()
  }, [accessToken, queryClient])

  useEffect(() => {
    const refreshActive = () => {
      if (document.visibilityState !== 'visible') return
      void queryClient.refetchQueries({ type: 'active' })
    }
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) refreshActive()
    }
    document.addEventListener('visibilitychange', refreshActive)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('online', refreshActive)
    return () => {
      document.removeEventListener('visibilitychange', refreshActive)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('online', refreshActive)
    }
  }, [queryClient])

  return null
}
