import { useEffect } from 'react'
import { useNavigate } from 'react-router'

/**
 * iOS installed PWAs cannot WindowClient.navigate() from notificationclick.
 * The service worker posts SFL_NOTIFICATION_NAVIGATE; this bridges into React Router.
 */
export function PushNavigationListener() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string; url?: string } | null
      if (!data || data.type !== 'SFL_NOTIFICATION_NAVIGATE') return
      if (typeof data.url !== 'string' || !data.url.startsWith('/') || data.url.startsWith('//')) {
        return
      }
      navigate(data.url)
    }

    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage)
    }
  }, [navigate])

  return null
}
