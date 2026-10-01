import { Outlet } from 'react-router'
import { motion, useReducedMotion } from 'motion/react'
import { AppHeader } from '@/components/layout/AppHeader'
import { BottomNav } from '@/components/layout/BottomNav'
import { OfflineState } from '@/components/states/OfflineState'
import { ActiveLeagueProvider } from '@/features/league/ActiveLeagueProvider'
import { useOnlineStatus } from '@/hooks/use-online-status'

export function AppShell() {
  const online = useOnlineStatus()
  const reducedMotion = useReducedMotion()

  return (
    <div className="flex min-h-svh flex-col bg-transparent">
      <AppHeader />
      <main className="flex flex-1 flex-col">
        {!online ? (
          <div className="mx-auto w-full max-w-lg px-4 pt-4">
            <OfflineState />
          </div>
        ) : null}
        <motion.div
          className="flex flex-1 flex-col"
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.22 }}
        >
          <ActiveLeagueProvider>
            <Outlet />
          </ActiveLeagueProvider>
        </motion.div>
      </main>
      <BottomNav />
    </div>
  )
}
