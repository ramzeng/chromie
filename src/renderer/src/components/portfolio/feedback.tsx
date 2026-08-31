import {
  CircleAlert,
  Download,
  History,
  Layers3,
  Plus,
  ShieldCheck
} from 'lucide-react'
import { toast } from 'sonner'

import {
  cleanErrorMessage,
  formatLastSyncedAt,
  shortSnapshotHash
} from '@/components/portfolio/view-helpers'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import type { PortfolioSnapshot } from '@/lib/portfolio'

export function reportPortfolioError(error: unknown, title = '操作失败'): void {
  toast.error(title, { description: cleanErrorMessage(error) })
}

export function LocalMark() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="grid size-6 place-items-center rounded-md bg-muted text-muted-foreground">
        <ShieldCheck data-icon="inline-start" className="size-3.5" />
      </span>
      <span>数据仅保存在本地</span>
    </div>
  )
}

export function EmptyProductAccount({
  onCreate,
  onImport,
  importing
}: {
  onCreate: () => void
  onImport: () => void
  importing: boolean
}) {
  return (
    <main className="relative grid min-h-screen place-items-center bg-background p-8">
      <div className="window-drag absolute inset-x-0 top-0 h-12" />
      <Empty className="w-full max-w-lg border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Layers3 data-icon="inline-start" />
          </EmptyMedia>
          <EmptyTitle className="text-2xl">开始使用 Chromie</EmptyTitle>
          <EmptyDescription>创建你的第一个账户，或从已有备份继续管理本地资产。</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="grid w-full gap-2">
            <Button size="lg" onClick={onCreate}>
              <Plus data-icon="inline-start" />
              创建账户
            </Button>
            <Button
              variant="outline"
              disabled={importing}
              aria-busy={importing}
              onClick={onImport}
            >
              {importing ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Download data-icon="inline-start" />
              )}
              {importing ? '读取中…' : '导入账户'}
            </Button>
          </div>
          <LocalMark />
        </EmptyContent>
      </Empty>
    </main>
  )
}

export function AppLoadingSkeleton() {
  return (
    <div
      className="flex h-screen min-h-[600px] overflow-hidden bg-background"
      role="status"
      aria-label="正在加载资产数据"
    >
      <div className="window-drag fixed inset-x-0 top-0 z-40 h-12" />
      <aside className="w-64 shrink-0 border-r border-sidebar-border bg-sidebar px-4 pt-14">
        <div className="flex items-center gap-3 px-2">
          <Skeleton className="size-8" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="mt-6 h-12 w-full" />
        <div className="mt-7 grid gap-3 px-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="mt-4 h-4 w-20" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-4/5" />
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-8 pt-16">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-9 w-28" />
          </div>
          <div className="mt-6 grid gap-3 min-[760px]:grid-cols-2 min-[1100px]:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-28 w-full" />
            ))}
          </div>
          <Skeleton className="mt-3 h-11 w-full" />
          <Skeleton className="mt-8 h-5 w-24" />
          <div className="mt-3 overflow-hidden rounded-lg border p-4">
            <Skeleton className="h-8 w-full" />
            {[0, 1, 2, 3].map((item) => (
              <Skeleton key={item} className="mt-3 h-10 w-full" />
            ))}
          </div>
        </div>
      </main>
      <span className="sr-only">正在加载资产数据…</span>
    </div>
  )
}

export function PortfolioLoadError({ message }: { message: string }) {
  return (
    <main className="relative grid min-h-screen place-items-center bg-background px-6">
      <div className="window-drag absolute inset-x-0 top-0 h-12" />
      <Alert variant="destructive" className="max-w-lg">
        <CircleAlert data-icon="inline-start" />
        <AlertTitle>无法加载资产数据</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </main>
  )
}

export function SnapshotViewingAlert({
  snapshot,
  onReturnLatest
}: {
  snapshot: PortfolioSnapshot
  onReturnLatest: () => void
}) {
  return (
    <div className="pointer-events-none fixed left-64 right-0 top-0 z-50 flex h-12 items-center justify-center px-4">
      <Alert className="pointer-events-auto w-fit max-w-full bg-background py-2 shadow-sm">
        <History data-icon="inline-start" />
        <AlertTitle className="sr-only">正在查看历史快照</AlertTitle>
        <AlertDescription className="flex min-w-0 items-center gap-2">
          <Badge variant="secondary">历史快照</Badge>
          <span className="truncate">
            版本 #{shortSnapshotHash(snapshot.id)} · {formatLastSyncedAt(snapshot.createdAt)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0"
            onClick={onReturnLatest}
          >
            返回最新版
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  )
}

export function PortfolioRefreshErrorAlert({ message }: { message: string }) {
  return (
    <div className="mx-auto w-[calc(50%+36rem)] max-w-full px-4 pt-4">
      <Alert variant="destructive">
        <CircleAlert data-icon="inline-start" />
        <AlertTitle>资产数据刷新失败</AlertTitle>
        <AlertDescription>已保留当前页面数据。{message}</AlertDescription>
      </Alert>
    </div>
  )
}
