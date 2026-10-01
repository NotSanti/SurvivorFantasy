import type { LucideIcon } from 'lucide-react'
import {
  Archive,
  Flag,
  Flame,
  GitMerge,
  Lock,
  Play,
  Shuffle,
  UserPlus,
} from 'lucide-react'
import type { Database } from '@/types/database'
import { cn } from '@/lib/utils'

export type LeagueStatus = Database['public']['Enums']['league_status']

const STATUS_ICONS: Record<
  LeagueStatus,
  { icon: LucideIcon; label: string }
> = {
  recruiting: { icon: UserPlus, label: 'Recruiting' },
  selecting: { icon: Shuffle, label: 'Selecting' },
  locked: { icon: Lock, label: 'Locked' },
  active_pre_merge: { icon: Play, label: 'Pre-merge' },
  merge_window: { icon: GitMerge, label: 'Merge window' },
  active_post_merge: { icon: Flame, label: 'Post-merge' },
  finished: { icon: Flag, label: 'Finished' },
  archived: { icon: Archive, label: 'Archived' },
}

type LeagueStatusIconProps = {
  status: LeagueStatus
  className?: string
}

export function LeagueStatusIcon({ status, className }: LeagueStatusIconProps) {
  const config = STATUS_ICONS[status]
  if (!config) return null
  const Icon = config.icon
  return (
    <span
      className={cn('inline-flex shrink-0 text-muted-foreground', className)}
      title={config.label}
      aria-label={config.label}
    >
      <Icon className="size-4" aria-hidden="true" />
    </span>
  )
}
