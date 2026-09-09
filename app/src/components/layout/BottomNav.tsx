import { NavLink } from 'react-router'
import { Activity, Flame, Trophy, Users } from 'lucide-react'
import { NAV_ITEMS } from '@/domain/product'
import { useNotifications } from '@/hooks/use-notifications'
import { cn } from '@/lib/utils'

const ICONS = {
  league: Users,
  tribe: Flame,
  standings: Trophy,
  activity: Activity,
} as const

export function BottomNav() {
  const { unread } = useNotifications()

  return (
    <nav
      aria-label="Primary"
      className="sticky bottom-0 z-20 border-t border-border/80 bg-background/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.id]
          return (
            <li key={item.id}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 px-2 py-2 text-xs font-medium text-muted-foreground outline-none transition-colors duration-[var(--motion-fast)] focus-visible:ring-2 focus-visible:ring-ring',
                    isActive && 'text-primary',
                  )
                }
              >
                <span className="relative">
                  <Icon className="size-5" aria-hidden="true" />
                  {item.id === 'activity' && unread > 0 ? (
                    <span className="absolute -top-1 -right-2 min-w-4 rounded-full bg-primary px-1 text-[10px] leading-4 text-primary-foreground">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  ) : null}
                </span>
                {item.label}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
