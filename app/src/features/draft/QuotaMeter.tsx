import { cn } from '@/lib/utils'

type QuotaMeterProps = {
  tribes: Array<{ id: string; name: string; count: number; cap: number }>
  manualTotal: number
  manualSlots: number
}

export function QuotaMeter({ tribes, manualTotal, manualSlots }: QuotaMeterProps) {
  return (
    <section role="region" aria-label="Tribe quotas" className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {manualTotal}/{manualSlots} manual picks · finish 3 / 3 / 2 before the wildcard
      </p>
      <ul className="grid grid-cols-3 gap-2">
        {tribes.map((tribe) => (
          <li
            key={tribe.id}
            className={cn(
              'rounded-xl bg-card px-2 py-3 text-center ring-1 ring-foreground/10',
              tribe.count === tribe.cap && 'ring-ember/60',
            )}
          >
            <p className="text-xs text-muted-foreground">{tribe.name}</p>
            <p className="font-display text-lg">
              {tribe.count}/{tribe.cap}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
