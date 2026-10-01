import type { ReactNode } from 'react'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'

export type TribeChip = {
  name: string
  colorName?: string | null
}

type CastawayPickCardProps = {
  name: string
  photoUrl?: string | null
  tribe?: TribeChip | null
  selected?: boolean
  disabled?: boolean
  /** When true, render a non-interactive pill (tribe / roster views). */
  static?: boolean
  /** Prefer immediate image fetch (above-the-fold tribe roster). */
  eager?: boolean
  badge?: string | null
  trailing?: ReactNode
  onClick?: () => void
}

function tribeTone(colorName?: string | null) {
  const key = colorName?.trim().toLowerCase()
  if (key === 'purple') {
    return 'bg-tribe-purple/25 text-foreground ring-tribe-purple/45'
  }
  if (key === 'yellow') {
    return 'bg-tribe-yellow/20 text-foreground ring-tribe-yellow/50'
  }
  return 'bg-muted text-muted-foreground ring-border'
}

export function CastawayPickCard({
  name,
  photoUrl,
  tribe = null,
  selected = false,
  disabled = false,
  static: isStatic = false,
  eager = false,
  badge = null,
  trailing = null,
  onClick,
}: CastawayPickCardProps) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  const tribeLabel = tribe?.name ?? null
  const className = cn(
    'flex min-h-11 w-full items-center gap-3 rounded-full border py-1 pr-4 pl-1 text-left transition-colors',
    'border-border bg-card/60',
    !isStatic && 'hover:border-ember/60 hover:bg-card',
    selected && 'border-ember bg-ember/15 ring-1 ring-ember/40',
    disabled && !isStatic && 'cursor-not-allowed opacity-55 hover:border-border hover:bg-card/60',
  )

  const body = (
    <>
      <span className="relative size-14 shrink-0 overflow-hidden rounded-full bg-muted">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt=""
            className="size-full origin-top scale-125 object-cover object-top"
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={eager ? 'high' : undefined}
          />
        ) : (
          <span className="flex size-full items-center justify-center font-display text-lg text-muted-foreground">
            {initial}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-lg leading-tight font-semibold text-ember">
          {name}
        </span>
        {tribeLabel ? (
          <span
            className={cn(
              'mt-0.5 inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase ring-1 ring-inset',
              tribeTone(tribe?.colorName),
            )}
          >
            {tribeLabel}
          </span>
        ) : null}
      </span>
      {trailing}
      {badge ? <Badge className="shrink-0">{badge}</Badge> : null}
    </>
  )

  if (isStatic) {
    return <div className={className}>{body}</div>
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={className}
    >
      {body}
    </button>
  )
}
