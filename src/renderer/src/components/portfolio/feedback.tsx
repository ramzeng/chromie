import {
  CircleAlert,
  Download,
  Eye,
  Plus,
  ShieldCheck
} from 'lucide-react'
import { toast } from 'sonner'

import { cleanErrorMessage } from '@/components/portfolio/view-helpers'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { CHROMIE_LOGO_URL } from '@/lib/brand'

export function reportPortfolioError(error: unknown, title = '操作失败'): void {
  toast.error(`${title}：${cleanErrorMessage(error)}`)
}

export function EmptyWorkspace({
  onCreate,
  onImport,
  onExploreExample,
  importing
}: {
  onCreate: () => void
  onImport: () => void
  onExploreExample: () => void
  importing: boolean
}) {
  return (
    <main
      data-slot="app-content"
      className="relative grid min-h-screen place-items-center bg-background p-8"
    >
      <div className="window-drag absolute inset-x-0 top-0 h-12" />
      <Empty
        data-slot="welcome-card"
        className="w-full max-w-lg border border-solid border-border/70 bg-card shadow-2xl shadow-black/20"
      >
        <EmptyHeader className="max-w-none">
          <EmptyMedia
            variant="icon"
            className="mb-3 size-16 border border-border/70 bg-sidebar shadow-lg shadow-black/25"
            aria-hidden="true"
          >
            <img className="size-11 object-contain invert" src={CHROMIE_LOGO_URL} alt="" />
          </EmptyMedia>
          <EmptyTitle className="text-xl font-semibold tracking-[-0.025em]">
            开始使用 Chromie
          </EmptyTitle>
          <EmptyDescription>
            创建你的第一个工作区，或从已有备份继续管理本地资产
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="grid w-full gap-2">
            <Button size="lg" onClick={onCreate}>
              <Plus data-icon="inline-start" />
              创建工作区
            </Button>
            <Button
              size="lg"
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
              {importing ? '读取中…' : '导入工作区'}
            </Button>
            <Button
              size="lg"
              variant="outline"
              disabled={importing}
              onClick={onExploreExample}
            >
              <Eye data-icon="inline-start" />
              体验示例工作区
            </Button>
          </div>
          <EmptyDescription className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            数据仅保存在本地
          </EmptyDescription>
        </EmptyContent>
      </Empty>
    </main>
  )
}

export function AppLoadingSkeleton() {
  return (
    <div
      className="flex h-screen min-h-[600px] overflow-hidden bg-sidebar"
      role="status"
      aria-label="正在加载资产数据"
    >
      <div className="window-drag fixed inset-x-0 top-0 z-40 h-2" />
      <aside data-slot="app-sidebar" className="w-64 shrink-0 bg-sidebar pt-8">
        <div className="flex h-10 items-center gap-2 px-4">
          <img
            className="size-6 shrink-0 object-contain invert"
            src={CHROMIE_LOGO_URL}
            alt=""
            aria-hidden="true"
          />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="ml-auto size-7" />
        </div>
        <div className="mt-2 grid gap-3 px-5">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="mt-4 h-4 w-20" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-4/5" />
        </div>
      </aside>
      <main
        data-slot="app-content"
        className="@container min-w-0 flex-1 border-l border-border bg-background"
      >
        <div className="mx-auto w-full max-w-[96rem] px-4 pb-6 pt-10 lg:px-6">
          <Skeleton className="h-8 w-40" />
          <div className="mt-5 grid gap-2 @min-[36rem]:grid-cols-2 @min-[68rem]:grid-cols-4">
            <Skeleton className="h-[104px] w-full" />
            <Skeleton className="h-[104px] w-full" />
            <Skeleton className="h-[104px] w-full" />
            <Skeleton className="h-[104px] w-full" />
          </div>
          <div className="mt-6 grid gap-3 @min-[68rem]:grid-cols-2">
            <Skeleton className="h-[300px] w-full" />
            <Skeleton className="h-[300px] w-full" />
          </div>
          <div className="mt-6 overflow-hidden rounded-sm border border-border/70 bg-card p-4">
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
    <main
      data-slot="app-content"
      className="relative grid min-h-screen place-items-center bg-background px-6"
    >
      <div className="window-drag absolute inset-x-0 top-0 h-12" />
      <Alert variant="destructive" className="max-w-lg">
        <CircleAlert data-icon="inline-start" />
        <AlertTitle>无法加载资产数据</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </main>
  )
}
