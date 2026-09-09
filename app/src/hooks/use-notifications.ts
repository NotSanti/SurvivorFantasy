import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/use-auth'
import { getSupabaseClient } from '@/lib/supabase'

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
    const supabase = getSupabaseClient()
    const channel = supabase
      .channel(`kindling-notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
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
