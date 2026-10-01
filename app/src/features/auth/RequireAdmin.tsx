import { Navigate } from 'react-router'
import { LoadingState } from '@/components/states/LoadingState'
import { useIsAdmin } from '@/features/auth/use-is-admin'
import type { ReactNode } from 'react'

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useIsAdmin()

  if (loading) {
    return (
      <main className="mx-auto flex min-h-svh max-w-lg items-center px-4">
        <LoadingState label="Checking admin access" />
      </main>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/leagues" replace />
  }

  return children
}
