import { parseClientEnv, type ClientEnv } from '@/domain/env'

export function readViteEnv(): ClientEnv {
  return parseClientEnv({
    VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_VAPID_PUBLIC_KEY: import.meta.env.VITE_VAPID_PUBLIC_KEY,
  })
}
