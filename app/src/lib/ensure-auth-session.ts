import { getSupabaseClient } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'

/** Ensure the Supabase client has a JWT before RLS-backed reads. */
export async function ensureAuthSession(): Promise<Session> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  if (!data.session) throw new Error('Not signed in')
  return data.session
}
