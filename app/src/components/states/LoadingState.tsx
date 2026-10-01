import { Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

type LoadingStateProps = {
  label?: string
  variant?: 'skeleton' | 'spinner'
}

export function LoadingState({ label = 'Loading', variant = 'skeleton' }: LoadingStateProps) {
  if (variant === 'spinner') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={label}
        className="flex flex-col items-center justify-center gap-3 py-16"
      >
        <Loader2 className="size-8 animate-spin text-ember" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    )
  }

  return (
    <div role="status" aria-live="polite" aria-label={label} className="space-y-3">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <span className="sr-only">{label}</span>
    </div>
  )
}
