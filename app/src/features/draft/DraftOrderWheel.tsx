import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { cn } from 'cn'

type DraftOrderWheelProps = {
  pickOrder: string[]
  labels: Record<string, string>
  userId: string
  orderSeed?: string | null
  roundNumber?: number
  onContinue: () => void
  continuePending?: boolean
}

function hashSeed(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

export function DraftOrderWheel({
  pickOrder,
  labels,
  userId,
  orderSeed = null,
  roundNumber = 1,
  onContinue,
  continuePending = false,
}: DraftOrderWheelProps) {
  const reducedMotion = useReducedMotion()
  const myNumber = pickOrder.indexOf(userId) + 1
  const spinKey = orderSeed ?? pickOrder.join('|')
  const [completedSpinKey, setCompletedSpinKey] = useState<string | null>(null)
  const spinDone = reducedMotion === true || completedSpinKey === spinKey
  const revealed = spinDone
  const spinTurns = useMemo(() => 4 + (hashSeed(spinKey) % 3), [spinKey])

  useEffect(() => {
    if (reducedMotion !== false) return
    const timer = window.setTimeout(() => setCompletedSpinKey(spinKey), 2800)
    return () => window.clearTimeout(timer)
  }, [reducedMotion, spinKey])

  return (
    <section className="space-y-4 rounded-xl bg-card px-4 py-5 ring-1 ring-foreground/10">
      <div className="space-y-1 text-center">
        <h2 className="font-display text-xl font-semibold">
          {roundNumber > 1 ? `Round ${roundNumber} order` : 'Round order'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {revealed
            ? 'Your pick number for this round is ready. Continue when everyone is set.'
            : 'Spinning the wheel to set this round’s pick order.'}
        </p>
      </div>
      <div className="relative mx-auto flex size-44 items-center justify-center">
        <motion.div
          key={spinKey}
          className="absolute inset-0 rounded-full border-4 border-ember/40 border-t-ember"
          initial={reducedMotion ? false : { rotate: 0 }}
          animate={{ rotate: spinTurns * 360 }}
          transition={{ duration: reducedMotion ? 0 : 2.4, ease: [0.12, 0.8, 0.2, 1] }}
        />
        <div className="z-10 text-center">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">You pick</p>
          <p className="font-display text-4xl font-semibold text-ember">
            {revealed ? `#${myNumber || '?'}` : '…'}
          </p>
        </div>
      </div>
      <ol className="space-y-2">
        {pickOrder.map((id, index) => (
          <li
            key={`${spinKey}-${id}`}
            className={cn(
              'flex min-h-11 items-center justify-between rounded-xl px-3 py-2 ring-1 ring-foreground/10',
              id === userId ? 'bg-ember/15 ring-ember/40' : 'bg-background/40',
            )}
          >
            <span className="font-medium">
              #{index + 1} {labels[id] ?? 'Member'}
              {id === userId ? ' (you)' : ''}
            </span>
          </li>
        ))}
      </ol>
      {revealed ? (
        <Button
          type="button"
          className="min-h-11 w-full"
          disabled={continuePending}
          onClick={onContinue}
        >
          {continuePending ? 'Opening draft…' : 'Continue to draft'}
        </Button>
      ) : null}
    </section>
  )
}
