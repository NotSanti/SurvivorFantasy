import { PRODUCT_NAME } from '@/domain/product'
import { cn } from '@/lib/utils'

type ProductMarkProps = {
  className?: string
  letterClassName?: string
}

/** SFL wordmark with torch-orange F, matching the favicon. */
export function ProductMark({ className, letterClassName }: ProductMarkProps) {
  return (
    <span
      className={cn('inline-flex items-baseline', className)}
      role="img"
      aria-label={PRODUCT_NAME}
    >
      <span className={cn('text-foreground', letterClassName)} aria-hidden="true">
        S
      </span>
      <span className={cn('text-ember', letterClassName)} aria-hidden="true">
        F
      </span>
      <span className={cn('text-foreground', letterClassName)} aria-hidden="true">
        L
      </span>
    </span>
  )
}
