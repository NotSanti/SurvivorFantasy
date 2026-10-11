import { getSupabaseClient } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'

let pending: Promise<Session> | null = null

/**
 * One shared session read for every league query. Parallel getSession calls
 * otherwise pile onto the auth client during cold start.
 */
export function ensureAuthSession(): Promise<Session> {
  if (!pending) {
    pending = readSession().finally(() => {
      pending = null
    })
  }
  return pending
}

async function readSession(): Promise<Session> {
  const { data, error } = await getSupabaseClient().auth.getSession()
  if (error) throw error
  if (!data.session) throw new Error('Not signed in')
  return data.session
}
