import { PRODUCT_NAME, UNOFFICIAL_DISCLAIMER } from '@/domain/product'

export function DisclaimerBanner() {
  return (
    <p className="px-1 text-center text-xs leading-5 text-muted-foreground">
      <span className="font-medium text-foreground/80">{PRODUCT_NAME}.</span>{' '}
      {UNOFFICIAL_DISCLAIMER}
    </p>
  )
}
