import { useCallback, useSyncExternalStore } from 'react'
import type { SpoilerMode } from '@/domain/standings/types'

const STORAGE_KEY = 'kindling.spoilerMode'
const EVENT = 'kindling-spoiler-mode'

function readMode(): SpoilerMode {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'hide_latest_episode'
      ? 'hide_latest_episode'
      : 'show'
  } catch {
    return 'show'
  }
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(EVENT, onStoreChange)
  window.addEventListener('storage', onStoreChange)
  return () => {
    window.removeEventListener(EVENT, onStoreChange)
    window.removeEventListener('storage', onStoreChange)
  }
}

export function useSpoilerMode() {
  const mode = useSyncExternalStore(subscribe, readMode, () => 'show' as const)
  const setMode = useCallback((next: SpoilerMode) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      return
    }
    window.dispatchEvent(new Event(EVENT))
  }, [])
  return { mode, setMode, hidden: mode === 'hide_latest_episode' }
}
