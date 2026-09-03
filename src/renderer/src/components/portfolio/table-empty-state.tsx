import type { ComponentProps } from 'react'

import {
  Empty,
  EmptyHeader,
  EmptyTitle
} from '@/components/ui/empty'
import { cn } from '@/lib/utils'

export function TableEmptyState({
  children,
  className,
  ...props
}: ComponentProps<typeof Empty>) {
  return (
    <Empty
      className={cn(
        'min-h-32 gap-2 border border-border/70 bg-card p-3 md:p-3',
        className
      )}
      {...props}
    >
      <EmptyHeader className="gap-1">
        <EmptyTitle className="text-xs font-normal tracking-normal text-muted-foreground">
          {children}
        </EmptyTitle>
      </EmptyHeader>
    </Empty>
  )
}
