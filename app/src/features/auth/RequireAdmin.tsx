import { useQuery } from '@tanstack/react-query'
import { Navigate } from 'react-router'
import { LoadingState } from '@/components/states/LoadingState'
import { useAuth } from '@/features/auth/use-auth'
import { getSupabaseClient } from '@/lib/supabase'
import type { ReactNode } from 'react'

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const adminQuery = useQuery({
    queryKey: ['is-admin', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('is_admin')
      if (error) throw error
      return Boolean(data)
    },
  })

  if (adminQuery.isPending) {
    return (
      <main className="mx-auto flex min-h-svh max-w-lg items-center px-4">
        <LoadingState label="Checking admin access" />
      </main>
    )
  }

  if (!adminQuery.data) {
    return <Navigate to="/leagues" replace />
  }

  return children
}
