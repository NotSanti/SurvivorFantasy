import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { requireSupabaseEnv } from '@/domain/env'
import { readViteEnv } from '@/lib/client-env'
import { createLimitedFetch } from '@/lib/limited-fetch'
import type { Database } from '@/types/database'

let client: SupabaseClient<Database> | null = null

export function getSupabaseClient(): SupabaseClient<Database> {
  if (client) return client

  const required = requireSupabaseEnv(readViteEnv())
  client = createClient<Database>(required.VITE_SUPABASE_URL, required.VITE_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: createLimitedFetch(),
    },
  })
  return client
}
