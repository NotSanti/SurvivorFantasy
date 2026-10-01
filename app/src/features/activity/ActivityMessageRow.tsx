import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { X } from 'lucide-react'
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'

const DISMISS_DISTANCE = 88
const DISMISS_VELOCITY = 650

type ActivityMessageRowProps = {
  id: string
  title: string
  body: string
  route: string
  read: boolean
  swipeToDismiss: boolean
  dismissPending?: boolean
  onOpen: () => void
  onDismiss: () => void
}

export function ActivityMessageRow({
  title,
  body,
  route,
  read,
  swipeToDismiss,
  dismissPending = false,
  onOpen,
  onDismiss,
}: ActivityMessageRowProps) {
  const reducedMotion = useReducedMotion()
  const x = useMotionValue(0)
  const dragged = useRef(false)
  const [exiting, setExiting] = useState(false)
  const href = route.startsWith('/') ? route : '/league'

  async function finishDismiss() {
    if (exiting) return
    setExiting(true)
    if (reducedMotion) {
      onDismiss()
      return
    }
    await animate(x, -420, { duration: 0.18, ease: 'easeIn' })
    onDismiss()
  }

  if (!swipeToDismiss) {
    return (
      <li className="flex gap-2">
        <Link
          to={href}
          className="min-h-11 min-w-0 flex-1 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10"
          onClick={() => {
            if (!read) onOpen()
          }}
        >
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{body}</p>
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 text-muted-foreground"
          aria-label={`Dismiss ${title}`}
          disabled={dismissPending || exiting}
          onClick={() => void finishDismiss()}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </li>
    )
  }

  return (
    <li className="relative overflow-hidden rounded-xl">
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 flex w-28 items-center justify-end bg-destructive/90 px-4 text-sm font-medium text-white"
      >
        Dismiss
      </div>
      <motion.div
        style={{ x }}
        drag={exiting || dismissPending ? false : 'x'}
        dragConstraints={{ left: -140, right: 0 }}
        dragElastic={{ left: 0.12, right: 0 }}
        dragDirectionLock
        onDragStart={() => {
          dragged.current = false
        }}
        onDrag={(_, info) => {
          if (Math.abs(info.offset.x) > 8) dragged.current = true
        }}
        onDragEnd={(_, info) => {
          const shouldDismiss = info.offset.x <= -DISMISS_DISTANCE || info.velocity.x <= -DISMISS_VELOCITY
          if (shouldDismiss) {
            void finishDismiss()
            return
          }
          void animate(x, 0, { type: 'spring', stiffness: 420, damping: 36 })
        }}
        className="relative touch-pan-y rounded-xl bg-card ring-1 ring-foreground/10"
      >
        <Link
          to={href}
          className="block min-h-11 px-4 py-3"
          onClick={(event) => {
            if (dragged.current || exiting) {
              event.preventDefault()
              dragged.current = false
              return
            }
            if (!read) onOpen()
          }}
        >
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{body}</p>
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="sr-only"
          aria-label={`Dismiss ${title}`}
          disabled={dismissPending || exiting}
          onClick={() => void finishDismiss()}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </motion.div>
    </li>
  )
}
