import {
  CircleAlert,
  Download,
  Eye,
  Plus,
  ShieldCheck
} from 'lucide-react'
import { toast } from 'sonner'

import { cleanErrorMessage } from '@/components/portfolio/view-helpers'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty'
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

export function AppLoadingScreen() {
  return (
    <main
      data-slot="app-content"
      className="relative grid h-screen min-h-[600px] place-items-center bg-background"
      role="status"
      aria-label="正在加载资产数据"
    >
      <div className="window-drag absolute inset-x-0 top-0 h-12" />
      <div className="flex flex-col items-center gap-4 text-center">
        <img
          className="size-14 object-contain invert"
          src={CHROMIE_LOGO_URL}
          alt=""
          aria-hidden="true"
        />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner aria-hidden="true" />
          <span>正在加载资产数据…</span>
        </div>
      </div>
    </main>
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
        <CircleAlert aria-hidden="true" />
        <AlertTitle>无法加载资产数据：{message}</AlertTitle>
      </Alert>
    </main>
  )
}
