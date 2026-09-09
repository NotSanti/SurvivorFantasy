import { useQuery } from '@tanstack/react-query'
import { Navigate, useLocation } from 'react-router'
import { LoadingState } from '@/components/states/LoadingState'
import { useAuth } from '@/features/auth/use-auth'
import { getSupabaseClient } from '@/lib/supabase'
import type { ReactNode } from 'react'

export function RequireOnboarding({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  const profileQuery = useQuery({
    queryKey: ['profile', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('profiles')
        .select('id, display_name, onboarding_completed_at')
        .eq('id', user!.id)
        .single()
      if (error) throw error
      return data
    },
  })

  if (profileQuery.isPending) {
    return (
      <main className="mx-auto flex min-h-svh max-w-lg items-center px-4">
        <LoadingState label="Loading profile" />
      </main>
    )
  }

  if (profileQuery.data && !profileQuery.data.onboarding_completed_at) {
    return (
      <Navigate
        to="/onboarding"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  return children
}
