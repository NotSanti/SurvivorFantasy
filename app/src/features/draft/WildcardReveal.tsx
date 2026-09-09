import { motion, useReducedMotion } from 'motion/react'

type WildcardRevealProps = {
  name: string
  onDismiss: () => void
}

export function WildcardReveal({ name, onDismiss }: WildcardRevealProps) {
  const reducedMotion = useReducedMotion()

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wildcard-reveal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
    >
      <motion.div
        className="w-full max-w-sm rounded-2xl bg-card p-6 text-center ring-1 ring-ember/40"
        initial={reducedMotion ? false : { scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.35 }}
      >
        <p className="text-sm uppercase tracking-[0.2em] text-ember">Wildcard</p>
        <h2 id="wildcard-reveal-title" className="font-display mt-2 text-3xl">
          {name}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This ninth pick is locked. It cannot be rolled again.
        </p>
        <button type="button" className="mt-4 min-h-11 text-sm underline" onClick={onDismiss}>
          Continue to MVP
        </button>
      </motion.div>
    </div>
  )
}
