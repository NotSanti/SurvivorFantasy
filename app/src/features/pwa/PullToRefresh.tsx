import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import {
  PULL_MAX,
  PULL_THRESHOLD,
  releaseShouldRefresh,
  startPull,
  updatePull,
  type PullGesture,
} from '@/features/pwa/pull-to-refresh'
import { useInstalledPwa } from '@/features/pwa/use-installed-pwa'
import { cn } from '@/lib/utils'

const HOLD_MS = 400

type PullToRefreshProps = {
  children: ReactNode
}

function scrollTopForPull(target: EventTarget | null) {
  if (!(target instanceof Element)) return window.scrollY
  if (target.closest('[role="dialog"], [role="alertdialog"]')) return Number.POSITIVE_INFINITY
  let node: Element | null = target
  while (node) {
    const overflowY = getComputedStyle(node).overflowY
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      node.scrollHeight - node.clientHeight > 1
    ) {
      return node.scrollTop
    }
    node = node.parentElement
  }
  return window.scrollY
}

export function PullToRefresh({ children }: PullToRefreshProps) {
  const installed = useInstalledPwa()
  const queryClient = useQueryClient()
  const queryClientRef = useRef(queryClient)
  const gestureRef = useRef<PullGesture | null>(null)
  const refreshingRef = useRef(false)
  const [distance, setDistance] = useState(0)
  const [armed, setArmed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    queryClientRef.current = queryClient
  }, [queryClient])

  useEffect(() => {
    if (!installed) return
    document.documentElement.classList.add('pwa-pull')
    return () => document.documentElement.classList.remove('pwa-pull')
  }, [installed])

  useEffect(() => {
    if (!installed) return
    let active = true
    let holdTimer = 0

    const finish = () => {
      const gesture = gestureRef.current
      gestureRef.current = null
      setDragging(false)
      if (!releaseShouldRefresh(gesture) || refreshingRef.current) {
        setDistance(0)
        setArmed(false)
        return
      }
      refreshingRef.current = true
      setRefreshing(true)
      setArmed(true)
      setDistance(PULL_THRESHOLD)
      const started = performance.now()
      void queryClientRef.current
        .refetchQueries({ type: 'active' })
        .finally(() => {
          const wait = Math.max(0, HOLD_MS - (performance.now() - started))
          holdTimer = window.setTimeout(() => {
            refreshingRef.current = false
            if (!active) return
            setRefreshing(false)
            setArmed(false)
            setDistance(0)
          }, wait)
        })
    }

    const onStart = (event: TouchEvent) => {
      if (refreshingRef.current || event.touches.length !== 1) return
      const touch = event.touches[0]
      if (!touch) return
      gestureRef.current = startPull(touch.clientX, touch.clientY, scrollTopForPull(event.target))
      setDragging(gestureRef.current !== null)
    }

    const onMove = (event: TouchEvent) => {
      const gesture = gestureRef.current
      const touch = event.touches[0]
      if (!gesture || !touch) return
      const next = updatePull(gesture, touch.clientX, touch.clientY, scrollTopForPull(event.target))
      gestureRef.current = next
      if (next.cancelled) {
        setDistance(0)
        setArmed(false)
        return
      }
      if (next.distance > 0 && event.cancelable) event.preventDefault()
      setDistance(next.distance)
      setArmed(next.armed)
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', finish)
    window.addEventListener('touchcancel', finish)
    return () => {
      active = false
      window.clearTimeout(holdTimer)
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', finish)
      window.removeEventListener('touchcancel', finish)
    }
  }, [installed])

  const shown = distance > 0 || refreshing
  const label = refreshing ? 'Refreshing' : armed ? 'Release to refresh' : 'Pull to refresh'

  return (
    <div
      className={cn('relative flex flex-1 flex-col', dragging ? '' : 'transition-transform duration-200')}
      style={{ transform: distance > 0 ? `translateY(${distance}px)` : undefined }}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 -top-10 z-30 flex justify-center transition-opacity',
          shown ? 'opacity-100' : 'opacity-0',
        )}
      >
        <div
          role="status"
          aria-live="polite"
          aria-hidden={shown ? undefined : true}
          className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-md"
        >
          <Loader2
            className={cn('size-4 text-ember', refreshing && 'animate-spin')}
            style={refreshing ? undefined : { transform: `rotate(${(distance / PULL_MAX) * 180}deg)` }}
            aria-hidden="true"
          />
          {label}
        </div>
      </div>
      {children}
    </div>
  )
}
