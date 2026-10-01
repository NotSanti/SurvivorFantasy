import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/use-auth'
import { getSupabaseClient } from '@/lib/supabase'

export function useIsAdmin() {
  const { user } = useAuth()
  const query = useQuery({
    queryKey: ['is-admin', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('is_admin')
      if (error) throw error
      return Boolean(data)
    },
  })

  return {
    isAdmin: Boolean(query.data),
    loading: Boolean(user) && query.isPending,
  }
}
