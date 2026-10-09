/**
 * Installed PWAs (especially iOS standalone) drop fetch() calls that start
 * while too many requests are already in flight. Those calls stay pending
 * and never hit the network. A small in-page queue keeps Supabase under that
 * limit, and a timeout turns a stuck socket into an error React Query can retry.
 */

const DEFAULT_LIMIT = 4
const DEFAULT_TIMEOUT_MS = 10_000

type LimitedFetchOptions = {
  limit?: number
  timeoutMs?: number
  base?: typeof fetch
}

export function createLimitedFetch(options: LimitedFetchOptions = {}): typeof fetch {
  const limit = options.limit ?? DEFAULT_LIMIT
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const base = options.base ?? globalThis.fetch.bind(globalThis)
  let active = 0
  const waiting: Array<() => void> = []

  function release() {
    active -= 1
    const next = waiting.shift()
    if (next) next()
  }

  function acquire(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      return Promise.reject(abortReason(signal))
    }
    if (active < limit) {
      active += 1
      return Promise.resolve()
    }
    return new Promise((resolve, reject) => {
      const start = () => {
        signal?.removeEventListener('abort', onAbort)
        active += 1
        resolve()
      }
      const onAbort = () => {
        const index = waiting.indexOf(start)
        if (index >= 0) waiting.splice(index, 1)
        reject(abortReason(signal))
      }
      waiting.push(start)
      signal?.addEventListener('abort', onAbort, { once: true })
    })
  }

  return async (input, init) => {
    const parent = init?.signal ?? undefined
    await acquire(parent)
    if (parent?.aborted) {
      release()
      throw abortReason(parent)
    }

    const controller = new AbortController()
    const timer = setTimeout(() => {
      controller.abort(new DOMException('The request timed out.', 'TimeoutError'))
    }, timeoutMs)
    const onParentAbort = () => controller.abort(abortReason(parent))
    parent?.addEventListener('abort', onParentAbort, { once: true })

    try {
      return await base(input, {
        ...init,
        cache: 'no-store',
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
      parent?.removeEventListener('abort', onParentAbort)
      release()
    }
  }
}

function abortReason(signal: AbortSignal | undefined): unknown {
  return signal?.reason ?? new DOMException('The operation was aborted.', 'AbortError')
}
