export const PULL_THRESHOLD = 64
export const PULL_MAX = 112
const PULL_RESISTANCE = 0.45

export type PullGesture = {
  startX: number
  startY: number
  distance: number
  armed: boolean
  cancelled: boolean
}

export function startPull(x: number, y: number, scrollTop: number): PullGesture | null {
  if (scrollTop > 0) return null
  return { startX: x, startY: y, distance: 0, armed: false, cancelled: false }
}

export function updatePull(
  gesture: PullGesture,
  x: number,
  y: number,
  scrollTop: number,
): PullGesture {
  if (gesture.cancelled || scrollTop > 0) {
    return { ...gesture, cancelled: true, distance: 0, armed: false }
  }
  const dx = x - gesture.startX
  const dy = y - gesture.startY
  if (dy <= 0) return { ...gesture, distance: 0, armed: false }
  if (Math.abs(dx) > dy && Math.abs(dx) > 10) {
    return { ...gesture, cancelled: true, distance: 0, armed: false }
  }
  const distance = Math.min(PULL_MAX, dy * PULL_RESISTANCE)
  return { ...gesture, distance, armed: distance >= PULL_THRESHOLD }
}

export function releaseShouldRefresh(gesture: PullGesture | null): boolean {
  return Boolean(gesture && !gesture.cancelled && gesture.armed)
}
