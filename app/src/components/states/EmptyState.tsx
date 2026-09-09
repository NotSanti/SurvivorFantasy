import type { ReactNode } from 'react'
import { StatePanel } from '@/components/states/StatePanel'

type EmptyStateProps = {
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return <StatePanel title={title} description={description} action={action} />
}
