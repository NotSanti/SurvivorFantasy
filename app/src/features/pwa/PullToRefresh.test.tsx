import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PullToRefresh } from '@/features/pwa/PullToRefresh'
import { createQueryClient } from '@/lib/query-client'

function stubStandalone(matches: boolean) {
  window.matchMedia = (query: string) => ({
    matches: query.includes('standalone') ? matches : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })
}

function dispatchTouch(type: 'touchstart' | 'touchmove' | 'touchend', x: number, y: number) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  const point = [{ clientX: x, clientY: y, identifier: 1 }]
  Object.defineProperty(event, 'touches', {
    value: type === 'touchend' ? [] : point,
  })
  Object.defineProperty(event, 'changedTouches', { value: point })
  window.dispatchEvent(event)
}

describe('PullToRefresh', () => {
  afterEach(() => {
    stubStandalone(false)
    document.documentElement.classList.remove('pwa-pull')
  })

  it('refetches active queries after a pull in the installed app', async () => {
    stubStandalone(true)
    const client = createQueryClient()
    const refetch = vi.spyOn(client, 'refetchQueries').mockResolvedValue()
    render(
      <QueryClientProvider client={client}>
        <PullToRefresh>
          <div>League body</div>
        </PullToRefresh>
      </QueryClientProvider>,
    )

    await act(async () => {
      dispatchTouch('touchstart', 20, 10)
      dispatchTouch('touchmove', 20, 200)
      dispatchTouch('touchend', 20, 200)
      await Promise.resolve()
    })

    expect(screen.getByText('Refreshing')).toBeInTheDocument()
    expect(refetch).toHaveBeenCalledWith({ type: 'active' })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 450))
    })
  })

  it('stays quiet in the browser', async () => {
    stubStandalone(false)
    const client = createQueryClient()
    const refetch = vi.spyOn(client, 'refetchQueries').mockResolvedValue()
    render(
      <QueryClientProvider client={client}>
        <PullToRefresh>
          <div>League body</div>
        </PullToRefresh>
      </QueryClientProvider>,
    )

    await act(async () => {
      dispatchTouch('touchstart', 20, 10)
      dispatchTouch('touchmove', 20, 200)
      dispatchTouch('touchend', 20, 200)
    })

    expect(screen.queryByText('Refreshing')).not.toBeInTheDocument()
    expect(refetch).not.toHaveBeenCalled()
  })
})