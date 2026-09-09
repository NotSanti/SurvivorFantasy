import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { LoadingState } from '@/components/states/LoadingState'
import { useAuth } from '@/features/auth/use-auth'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, configured } = useAuth()
  const location = useLocation()

  if (!configured) {
    return <Navigate to="/" replace />
  }
  if (loading) {
    return (
      <main className="mx-auto flex min-h-svh max-w-lg items-center px-4">
        <LoadingState label="Checking session" />
      </main>
    )
  }
  if (!user) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />
  }
  return children
}
