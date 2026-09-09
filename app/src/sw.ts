/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
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

registerRoute(
  ({ request, url }) =>
    request.mode === 'navigate' && url.origin === self.location.origin,
  new NetworkFirst({
    cacheName: 'kindling-pages',
    networkTimeoutSeconds: 4,
  }),
)

registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    ['style', 'script', 'image', 'font'].includes(request.destination),
  new StaleWhileRevalidate({
    cacheName: 'kindling-static',
  }),
)

self.addEventListener('push', (event) => {
  const payload = parsePushPayload(event.data?.text() ?? null)
  if (!payload) return

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      data: { url: payload.url },
    }),
  )
})

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
  const windows = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  })
  const existing = windows.find(
    (client): client is WindowClient => 'focus' in client,
  )
  if (existing) {
    if ('navigate' in existing) {
      await existing.navigate(url)
    }
    await existing.focus()
    return
  }
  await self.clients.openWindow(url)
}

export {}
