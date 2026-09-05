import { Button } from '@/components/ui/button'
import { CHROMIE_APP_ICON_URL, CHROMIE_GITHUB_URL, CHROMIE_VERSION } from '@/lib/brand'

export function AboutSettingsSection() {
  return (
    <section className="grid min-h-[430px] place-items-center pb-8 text-center">
      <h3 className="sr-only">关于</h3>
      <div className="flex max-w-full flex-col items-center">
        <img className="size-24" src={CHROMIE_APP_ICON_URL} alt="Chromie 标志" />
        <h4 className="mt-5 text-2xl font-semibold tracking-tight">Chromie</h4>
        <p className="mt-8 text-sm text-muted-foreground">版本 {CHROMIE_VERSION}</p>
        <Button asChild variant="link" size="sm" className="mt-7 h-auto max-w-full p-0">
          <a href={CHROMIE_GITHUB_URL} target="_blank" rel="noopener noreferrer">
            <span className="truncate">github.com/ramzeng/chromie</span>
          </a>
        </Button>
      </div>
    </section>
  )
}
