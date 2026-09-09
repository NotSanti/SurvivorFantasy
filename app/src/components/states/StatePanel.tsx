import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type StatePanelProps = {
  title: string
  description: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

export function StatePanel({
  title,
  description,
  icon,
  action,
  className,
}: StatePanelProps) {
  return (
    <section
      className={cn(
        'flex flex-col items-start gap-3 rounded-xl bg-card px-4 py-5 text-left ring-1 ring-foreground/10',
        className,
      )}
    >
      {icon ? (
        <div className="text-ember" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1">
        <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </section>
  )
}
