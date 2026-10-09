/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { parsePushPayload, resolveSameOriginUrl } from '@/domain/push-payload'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { url: string; revision: string | null }>
}

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
clientsClaim()

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})

// Serve the precached shell for navigations. A network-first wait used to hold
// the service worker open on cold start and could fail the document request
// before any league reads began. Dev builds have no precache manifest yet.
try {
  registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))
} catch {
  registerRoute(
    ({ request, url }) =>
      request.mode === 'navigate' && url.origin === self.location.origin,
    new NetworkFirst({
      cacheName: 'sfl-pages',
      networkTimeoutSeconds: 4,
    }),
  )
}

registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    ['style', 'script', 'image', 'font'].includes(request.destination),
  new StaleWhileRevalidate({
    cacheName: 'sfl-static',
  }),
)

const NOTIFICATION_ICON = '/icons/icon-192.png'
const NOTIFICATION_BADGE = '/icons/icon-192.png'

self.addEventListener('push', (event) => {
  event.waitUntil(showPushNotification(event))
})

async function showPushNotification(event: PushEvent) {
  const payload = parsePushPayload(event.data?.text() ?? null) ?? {
    title: 'SFL update',
    body: 'Open SFL for the latest from your camp.',
    url: '/activity',
    tag: 'sfl-fallback',
  }

  await self.registration.showNotification(payload.title, {
    body: payload.body,
    tag: payload.tag,
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_BADGE,
    data: { url: payload.url },
  })
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = resolveSameOriginUrl(
    typeof event.notification.data?.url === 'string'
      ? event.notification.data.url
      : '/',
    self.location.origin,
  )

  event.waitUntil(focusOrOpenWindow(target))
})

async function focusOrOpenWindow(url: string) {
  const path = (() => {
    try {
      const parsed = new URL(url)
      return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/'
    } catch {
      return '/'
    }
  })()

  const windows = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  })

  for (const client of windows) {
    if (!('focus' in client)) continue
    const focused = await client.focus()
    const target = focused ?? client

    // Chromium can soft-navigate; iOS Safari PWAs do not implement navigate().
    if ('navigate' in target && typeof target.navigate === 'function') {
      try {
        const navigated = await target.navigate(url)
        if (navigated) return
      } catch {
        // Fall through to SPA postMessage.
      }
    }

    target.postMessage({ type: 'SFL_NOTIFICATION_NAVIGATE', url: path })
    return
  }

  const opened = await self.clients.openWindow(url)
  if (opened) return

  // iOS sometimes returns null from openWindow when a window is already present.
  const retry = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  })
  for (const client of retry) {
    client.postMessage({ type: 'SFL_NOTIFICATION_NAVIGATE', url: path })
  }
}

export {}
