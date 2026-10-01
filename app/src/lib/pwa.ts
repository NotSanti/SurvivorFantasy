import { registerSW } from 'virtual:pwa-register'

export type PwaRegistrationHandlers = {
  onNeedRefresh: (update: () => void) => void
  onOfflineReady?: () => void
}

export function registerPwa(handlers: PwaRegistrationHandlers) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Installed PWAs otherwise keep a stale shell until the user taps Update.
      void updateSW(true)
      handlers.onNeedRefresh(() => {
        void updateSW(true)
      })
    },
    onOfflineReady() {
      handlers.onOfflineReady?.()
    },
  })

  return updateSW
}
