import { describe, expect, it } from 'vitest'
import { releaseShouldRefresh, startPull, updatePull } from './pull-to-refresh'

describe('pull to refresh', () => {
  it('ignores a pull that starts below the top of the page', () => {
    expect(startPull(0, 20, 40)).toBeNull()
  })

  it('arms a downward pull from the top and refreshes on release', () => {
    const started = startPull(20, 10, 0)
    expect(started).not.toBeNull()
    const moved = updatePull(started!, 20, 180, 0)
    expect(moved.armed).toBe(true)
    expect(releaseShouldRefresh(moved)).toBe(true)
  })

  it('does not refresh a short pull', () => {
    const started = startPull(0, 0, 0)!
    const moved = updatePull(started, 0, 40, 0)
    expect(moved.armed).toBe(false)
    expect(releaseShouldRefresh(moved)).toBe(false)
  })

  it('lets a horizontal swipe pass through', () => {
    const started = startPull(0, 40, 0)!
    const moved = updatePull(started, 80, 50, 0)
    expect(moved.cancelled).toBe(true)
    expect(releaseShouldRefresh(moved)).toBe(false)
  })

  it('cancels when the page scrolls during the gesture', () => {
    const started = startPull(0, 0, 0)!
    const moved = updatePull(started, 0, 160, 12)
    expect(moved.cancelled).toBe(true)
    expect(releaseShouldRefresh(moved)).toBe(false)
  })
})
