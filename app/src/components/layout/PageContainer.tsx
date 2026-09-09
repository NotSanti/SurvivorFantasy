import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type PageContainerProps = {
  children: ReactNode
  className?: string
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn('mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-4', className)}>
      {children}
    </div>
  )
}
