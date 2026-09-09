import { Link } from 'react-router'
import { PRODUCT_NAME } from '@/domain/product'

type AppHeaderProps = {
  title?: string
}

export function AppHeader({ title = PRODUCT_NAME }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <Link to="/leagues" className="font-display min-h-11 text-lg font-semibold tracking-tight text-foreground">
          {title}
        </Link>
        <Link to="/admin" className="text-sm text-muted-foreground min-h-11 inline-flex items-center">
          Admin
        </Link>
      </div>
    </header>
  )
}
