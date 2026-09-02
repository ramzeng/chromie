import type { ComponentProps, ReactNode } from 'react'
import { History, LockKeyhole, type LucideIcon } from 'lucide-react'

import { shortSnapshotHash } from '@/components/portfolio/view-helpers'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function PortfolioPage({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="portfolio-page"
      className={cn(
        '@container mx-auto w-full max-w-[96rem] px-4 pb-6 pt-4 first:pt-10 lg:px-6',
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

function StatusBanner({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction
}: {
  icon: LucideIcon
  title: ReactNode
  description: ReactNode
  actionLabel: string
  onAction: () => void
}) {
  return (
    <Alert
      role="status"
      className="flex min-h-10 items-center justify-center gap-3 border-border/70 bg-muted/25 py-2 [&>svg]:static [&>svg]:shrink-0 [&>svg+div]:translate-y-0 [&>svg~*]:pl-0"
    >
      <Icon aria-hidden="true" />
      <div className="flex min-w-0 items-center gap-2">
        <AlertTitle className="mb-0 shrink-0 whitespace-nowrap">{title}</AlertTitle>
        <AlertDescription className="truncate text-muted-foreground">
          {description}
        </AlertDescription>
      </div>
      <Button
        type="button"
        variant="link"
        className="h-6 shrink-0 cursor-pointer px-0"
        onClick={onAction}
      >
        {actionLabel}
      </Button>
    </Alert>
  )
}

export function HistoricalVersionBanner({
  snapshotId,
  createdAt,
  onReturnLatest,
  className
}: {
  snapshotId: string
  createdAt: string
  onReturnLatest: () => void
  className?: string
}) {
  return (
    <div
      data-slot="historical-version-banner"
      className={cn(
        'mx-auto w-full max-w-[96rem] px-4 pt-10 lg:px-6',
        className
      )}
    >
      <StatusBanner
        icon={History}
        title={`历史版本 #${shortSnapshotHash(snapshotId)}`}
        description={
          <>
            保存于{' '}
            <time className="tabular-nums" dateTime={createdAt}>
              {formatHistoricalVersionTime(createdAt)}
            </time>
          </>
        }
        actionLabel="返回当前版本"
        onAction={onReturnLatest}
      />
    </div>
  )
}

export function ExampleWorkspaceBanner({ onExit }: { onExit: () => void }) {
  return (
    <div
      data-slot="example-workspace-banner"
      className="mx-auto w-full max-w-[96rem] px-4 pt-10 lg:px-6"
    >
      <StatusBanner
        icon={LockKeyhole}
        title="示例工作区 · 只读"
        description="示例数据仅用于体验，不会保存到本地"
        actionLabel="退出体验"
        onAction={onExit}
      />
    </div>
  )
}
