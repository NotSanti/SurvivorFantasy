import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/**
 * iOS PWAs often skip window-focus refetch after backgrounding. Debounce resume
 * refreshes, and skip the first few seconds so cold-start score fetches can finish.
 */
export function QueryLifecycle() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const coldStartUntil = Date.now() + 3000
    let timer: ReturnType<typeof setTimeout> | undefined

    const scheduleRefresh = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() < coldStartUntil) return
      clearTimeout(timer)
      timer = setTimeout(() => {
        void queryClient.refetchQueries({ type: 'active', stale: true })
      }, 750)
    }

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) scheduleRefresh()
    }

    document.addEventListener('visibilitychange', scheduleRefresh)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', scheduleRefresh)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [queryClient])

  return null
}
