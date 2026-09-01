import type { ComponentProps } from 'react'
import { History } from 'lucide-react'

import { shortSnapshotHash } from '@/components/portfolio/view-helpers'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function PortfolioPage({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="portfolio-page"
      className={cn(
        '@container mx-auto w-full max-w-[1440px] px-6 pb-8 pt-5',
        className
      )}
      {...props}
    />
  )
}

export function PortfolioPageHeader({
  className,
  ...props
}: ComponentProps<'header'>) {
  return (
    <header
      data-slot="portfolio-page-header"
      className={cn(
        'flex flex-wrap items-center justify-between gap-4',
        className
      )}
      {...props}
    />
  )
}

function formatHistoricalVersionTime(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '时间未知'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)
}

export function HistoricalVersionBanner({
  snapshotId,
  createdAt,
  onReturnLatest
}: {
  snapshotId: string
  createdAt: string
  onReturnLatest: () => void
}) {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 pt-1">
      <div
        className="flex min-h-10 flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-sm border border-border/70 bg-muted/25 px-4 py-2 text-sm"
        role="status"
      >
        <History className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate text-foreground">
          <span className="font-medium">历史版本 #{shortSnapshotHash(snapshotId)}</span>
          <span className="text-muted-foreground">
            {' '}保存于{' '}
            <time className="tabular-nums" dateTime={createdAt}>
              {formatHistoricalVersionTime(createdAt)}
            </time>
          </span>
        </span>
        <Button
          type="button"
          variant="link"
          className="h-6 shrink-0 cursor-pointer px-0"
          onClick={onReturnLatest}
        >
          返回当前版本
        </Button>
      </div>
    </div>
  )
}
