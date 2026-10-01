import { Link } from 'react-router'
import { PRODUCT_NAME } from '@/domain/product'
import { useIsAdmin } from '@/features/auth/use-is-admin'

type AppHeaderProps = {
  title?: string
}

export function AppHeader({ title = PRODUCT_NAME }: AppHeaderProps) {
  const { isAdmin, loading } = useIsAdmin()

  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <Link to="/leagues" className="font-display min-h-11 text-lg font-semibold tracking-tight text-foreground uppercase">
          {title}
        </Link>
        {isAdmin && !loading ? (
          <Link to="/admin" className="inline-flex min-h-11 items-center text-sm text-muted-foreground">
            Admin
          </Link>
        ) : (
          <span aria-hidden className="min-h-11" />
        )}
      </div>
    </header>
  )
}
