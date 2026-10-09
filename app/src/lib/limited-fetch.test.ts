import { describe, expect, it, vi } from 'vitest'
import { createLimitedFetch } from './limited-fetch'

function deferred() {
  let resolve: (value: Response) => void = () => {}
  let reject: (reason?: unknown) => void = () => {}
  const promise = new Promise<Response>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('createLimitedFetch', () => {
  it('runs only the configured number of requests at once', async () => {
    const gate = deferred()
    let started = 0
    const base = vi.fn(() => {
      started += 1
      return gate.promise
    })
    const fetch = createLimitedFetch({ limit: 2, timeoutMs: 5_000, base })

    const first = fetch('/a')
    const second = fetch('/b')
    const third = fetch('/c')
    await Promise.resolve()

    expect(started).toBe(2)
    gate.resolve(new Response('ok'))
    await Promise.all([first, second, third])
    expect(started).toBe(3)
  })

  it('aborts a request that exceeds the timeout and frees the slot', async () => {
    vi.useFakeTimers()
    try {
      const base = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        })
      })
      const fetch = createLimitedFetch({ limit: 1, timeoutMs: 25, base })
      const pending = fetch('/slow')
      const caught = pending.then(
        () => null,
        (error: unknown) => error,
      )
      await vi.advanceTimersByTimeAsync(25)
      const error = await caught
      expect(error).toBeInstanceOf(DOMException)
      expect((error as DOMException).name).toBe('TimeoutError')

      const next = deferred()
      base.mockImplementationOnce(() => next.promise)
      const followed = fetch('/next')
      await Promise.resolve()
      expect(base).toHaveBeenCalledTimes(2)
      next.resolve(new Response('ok'))
      await expect(followed).resolves.toBeInstanceOf(Response)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not start a queued request after the caller aborts', async () => {
    const gate = deferred()
    const base = vi.fn(() => gate.promise)
    const fetch = createLimitedFetch({ limit: 1, timeoutMs: 5_000, base })
    const controller = new AbortController()

    const blocking = fetch('/busy')
    const queued = fetch('/later', { signal: controller.signal })
    controller.abort()
    await expect(queued).rejects.toBeInstanceOf(DOMException)
    expect(base).toHaveBeenCalledTimes(1)

    gate.resolve(new Response('ok'))
    await blocking
  })
})
