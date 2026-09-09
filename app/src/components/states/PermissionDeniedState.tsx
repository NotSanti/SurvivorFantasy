import { StatePanel } from '@/components/states/StatePanel'

type PermissionDeniedStateProps = {
  title?: string
  description?: string
}

export function PermissionDeniedState({
  title = 'Permission needed',
  description = 'This action is blocked until you grant permission. You can keep using Kindling without it.',
}: PermissionDeniedStateProps) {
  return <StatePanel title={title} description={description} />
}
