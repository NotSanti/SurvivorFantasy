import { StatePanel } from '@/components/states/StatePanel'

type OfflineStateProps = {
  lastSyncedAt?: string | null
}

export function OfflineState({ lastSyncedAt }: OfflineStateProps) {
  return (
    <StatePanel
      title="You are offline"
      description={
        lastSyncedAt
          ? `Showing the last successful read from ${lastSyncedAt}. Draft, join, and commissioner actions need a connection.`
          : 'Draft, join, and commissioner actions need a connection. Cached screens stay available when we have a last successful read.'
      }
    />
  )
}
