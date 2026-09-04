import { Badge } from '@/components/ui/badge'
import { CHROMIE_APP_ICON_URL, CHROMIE_VERSION } from '@/lib/brand'

export function AboutSettingsSection() {
  return (
    <section className="flex min-h-[430px] flex-col gap-5">
      <h3 className="text-base font-semibold">关于</h3>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 pb-10 text-center">
        <img className="size-24" src={CHROMIE_APP_ICON_URL} alt="Chromie 标志" />
        <h4 className="mt-2 text-xl font-semibold">Chromie</h4>
        <p className="text-sm text-muted-foreground">运行在本地的 macOS 资产管理工具</p>
        <Badge variant="secondary" className="mt-2">
          v{CHROMIE_VERSION}
        </Badge>
      </div>
    </section>
  )
}
