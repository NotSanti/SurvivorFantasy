import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { awaitingInitial } from '@/features/league/use-league-week'
import {
  isUnsentInitialQuery,
  recoverUnsentQueries,
} from '@/features/query/recover-unsent-queries'

describe('awaitingInitial', () => {
  it('stays loading when an enabled read has not succeeded', () => {
    expect(awaitingInitial({ isPending: true }, true)).toBe(true)
  })

  it('does not treat a disabled or finished read as loading', () => {
    expect(awaitingInitial({ isPending: true }, false)).toBe(false)
    expect(awaitingInitial({ isPending: false }, true)).toBe(false)
  })
})

describe('recoverUnsentQueries', () => {
  it('starts a read that was cancelled before it reached the network', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, networkMode: 'always' } },
    })
    let calls = 0
    const observer = new QueryObserver(client, {
      queryKey: ['published-scores', 'season'],
      networkMode: 'always',
      retry: false,
      queryFn: () => {
        calls += 1
        return new Promise(() => {})
      },
    })
    const unsubscribe = observer.subscribe(() => {})
    await client.cancelQueries({ queryKey: ['published-scores', 'season'] })

    const query = client.getQueryCache().find({ queryKey: ['published-scores', 'season'] })
    expect(query && isUnsentInitialQuery(query)).toBe(true)

    const started = calls
    recoverUnsentQueries(client, new Map())
    await Promise.resolve()
    expect(calls).toBe(started + 1)

    unsubscribe()
    client.clear()
  })

  it('leaves a disabled query alone', () => {
    const client = new QueryClient()
    const observer = new QueryObserver(client, {
      queryKey: ['rules'],
      enabled: false,
      queryFn: () => 'rules',
    })
    const unsubscribe = observer.subscribe(() => {})
    const query = client.getQueryCache().find({ queryKey: ['rules'] })
    expect(query && isUnsentInitialQuery(query)).toBe(false)
    unsubscribe()
    client.clear()
  })
})
