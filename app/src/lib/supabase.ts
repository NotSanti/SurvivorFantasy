import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { requireSupabaseEnv } from '@/domain/env'
import { isInstalled } from '@/domain/pwa/install'
import { readViteEnv } from '@/lib/client-env'
import { createLimitedFetch } from '@/lib/limited-fetch'
import type { Database } from '@/types/database'

function installedPwa() {
  if (typeof window === 'undefined') return false
  const iosStandalone =
    'standalone' in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return isInstalled({
    displayModeStandalone: window.matchMedia('(display-mode: standalone)').matches,
    iosStandalone,
  })
}

let client: SupabaseClient<Database> | null = null

export function getSupabaseClient(): SupabaseClient<Database> {
  if (client) return client

  const required = requireSupabaseEnv(readViteEnv())
  client = createClient<Database>(required.VITE_SUPABASE_URL, required.VITE_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // navigator.locks is not re-entrant. In an installed PWA, getSession holds
      // the lock and a nested token read waits forever. Blurring the window is
      // what used to release it, so standings and rules never left the device
      // until then. Auth steps for this tab run inline instead.
      lock: async (_name, _acquireTimeout, fn) => fn(),
    },
    global: {
      // Installed iOS apps drop or hang fetches that start together, and
      // cache: 'no-store' is part of that failure. Later reads then look like
      // an empty season until the app is backgrounded and the sockets clear.
      fetch: createLimitedFetch({
        limit: () => (installedPwa() ? 2 : 4),
        cache: () => (installedPwa() ? undefined : 'no-store'),
      }),
    },
  })
  return client
}
