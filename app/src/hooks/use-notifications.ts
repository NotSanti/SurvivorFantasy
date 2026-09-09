import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useAuth } from '@/features/auth/use-auth'
import { getSupabaseClient } from '@/lib/supabase'

type SharedNotificationChannel = {
  userId: string
  refs: number
  channel: RealtimeChannel
}

let sharedNotifications: SharedNotificationChannel | null = null

function retainNotificationChannel(userId: string, onChange: () => void) {
  const supabase = getSupabaseClient()
  if (sharedNotifications?.userId === userId) {
    sharedNotifications.refs += 1
    return sharedNotifications
  }
  if (sharedNotifications) {
    void supabase.removeChannel(sharedNotifications.channel)
    sharedNotifications = null
  }
  const channel = supabase
    .channel(`kindling-notifications-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      onChange,
    )
    .subscribe()
  sharedNotifications = { userId, refs: 1, channel }
  return sharedNotifications
}

function releaseNotificationChannel(held: SharedNotificationChannel) {
  if (sharedNotifications !== held) return
  sharedNotifications.refs -= 1
  if (sharedNotifications.refs > 0) return
  void getSupabaseClient().removeChannel(sharedNotifications.channel)
  sharedNotifications = null
}

export function useNotifications() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id

  const query = useQuery({
    queryKey: ['notifications', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('notifications')
        .select('id, title, body, route, read_at, created_at, league_id')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(40)
      if (error) throw error
      return data
    },
  })

  useEffect(() => {
    if (!userId) return
    let held: SharedNotificationChannel | null = null
    try {
      held = retainNotificationChannel(userId, () => {
        void queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
      })
    } catch (cause) {
      console.error('Kindling notification realtime failed', cause)
      return
    }
    return () => {
      releaseNotificationChannel(held)
    }
  }, [queryClient, userId])

  useEffect(() => {
    const unread = (query.data ?? []).filter((row) => !row.read_at).length
    if ('setAppBadge' in navigator) {
      if (unread > 0) void navigator.setAppBadge(unread)
      else void navigator.clearAppBadge?.()
    }
  }, [query.data])

  return {
    items: query.data ?? [],
    unread: (query.data ?? []).filter((row) => !row.read_at).length,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
