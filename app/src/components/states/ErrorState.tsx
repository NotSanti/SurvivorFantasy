import { StatePanel } from '@/components/states/StatePanel'
import { Button } from '@/components/ui/button'

type ErrorStateProps = {
  title?: string
  description?: string
  onRetry?: () => void
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this screen. Try again, or come back when you have a connection.',
  onRetry,
}: ErrorStateProps) {
  return (
    <StatePanel
      title={title}
      description={description}
      action={
        onRetry ? (
          <Button type="button" onClick={onRetry} className="min-h-11">
            Try again
          </Button>
        ) : null
      }
    />
  )
}
