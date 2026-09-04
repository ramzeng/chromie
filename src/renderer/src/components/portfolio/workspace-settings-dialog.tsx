import { ChartCandlestick, Coins, Network, SlidersHorizontal, Trash2, Upload, Wrench } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import {
  BASE_CURRENCIES,
  CRYPTO_QUOTE_PROVIDERS,
  cryptoQuoteProviderLabels,
  DEFAULT_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  EXCHANGE_RATE_PROVIDERS,
  exchangeRateProviderLabels,
  MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  STOCK_QUOTE_PROVIDERS,
  stockQuoteProviderLabels,
  type BaseCurrency,
  type CryptoQuoteProvider,
  type ExchangeRateProvider,
  type ProxyProfileInput,
  type ProxyProfileView,
  type ProxyTestResult,
  type ProxyTestTarget,
  type StockQuoteProvider,
  type Workspace,
  type WorkspaceSettingsInput
} from '@/lib/portfolio'
import { cn } from '@/lib/utils'

import { type BaseDialogProps } from './dialog-shared'
import { McpSettingsSection } from './mcp-settings-section'
import { ProxySettingsSection } from './proxy-settings-section'
import { useWorkspaceSettingsForm } from './use-workspace-settings-form'
export function WorkspaceSettingsDialog({
  open,
  onOpenChange,
  workspace,
  initialSection = 'basic',
  onSubmit,
  proxyProfiles,
  onCreateProxyProfile,
  onUpdateProxyProfile,
  onDeleteProxyProfile,
  onTestProxy,
  onRequestExport,
  onRequestDelete
}: BaseDialogProps & {
  workspace: Workspace
  initialSection?: 'basic' | 'currency' | 'quotes' | 'proxy' | 'mcp'
  onSubmit: (input: WorkspaceSettingsInput) => Promise<void>
  proxyProfiles: ProxyProfileView[]
  onCreateProxyProfile: (input: ProxyProfileInput) => Promise<string>
  onUpdateProxyProfile: (id: string, input: ProxyProfileInput) => Promise<void>
  onDeleteProxyProfile: (id: string) => Promise<void>
  onTestProxy: (id: string, target: ProxyTestTarget) => Promise<ProxyTestResult>
  onRequestExport: () => void
  onRequestDelete: () => void
}) {
  const {
    name,
    setName,
    baseCurrency,
    setBaseCurrency,
    exchangeRateProvider,
    setExchangeRateProvider,
    exchangeRateRefreshInterval,
    setExchangeRateRefreshInterval,
    stockQuoteProvider,
    setStockQuoteProvider,
    cryptoQuoteProvider,
    setCryptoQuoteProvider,
    section,
    setSection,
    mcpConnection,
    mcpAccess,
    setMcpAccess,
    mcpLoading,
    storagePath,
    setStoragePath,
    storageLocationStatus,
    setStorageLocationStatus,
    submitting,
    mcpError,
    error,
    setError,
    storageLocationPlaceholder,
    handleSubmit
  } = useWorkspaceSettingsForm({
    open,
    onOpenChange,
    workspace,
    initialSection,
    onSubmit
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!submitting) onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="h-[640px] max-h-[calc(100vh-2rem)] max-w-[760px]">
        <DialogHeader>
          <DialogTitle>工作区设置</DialogTitle>
          <DialogDescription className="sr-only">
            管理工作区基础信息、币种与汇率、行情数据、网络代理、MCP 协议和工作区状态
          </DialogDescription>
        </DialogHeader>
        <form
          className="contents"
          aria-invalid={section !== 'mcp' && Boolean(error)}
          onSubmit={handleSubmit}
        >
          <DialogBody className="grid grid-cols-[10.5rem_minmax(0,1fr)] overflow-hidden p-0">
            <aside className="border-r border-border bg-background/40 p-3 text-foreground">
              <nav className="grid content-start gap-1" aria-label="工作区设置菜单">
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    'h-9 justify-start gap-2.5 px-3 font-normal hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    section === 'basic' &&
                      'bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent'
                  )}
                  onClick={() => setSection('basic')}
                >
                  <SlidersHorizontal className="size-4" />
                  基础信息
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    'h-9 justify-start gap-2.5 px-3 font-normal hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    section === 'currency' &&
                      'bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent'
                  )}
                  onClick={() => setSection('currency')}
                >
                  <Coins className="size-4" />
                  币种与汇率
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    'h-9 justify-start gap-2.5 px-3 font-normal hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    section === 'quotes' &&
                      'bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent'
                  )}
                  onClick={() => setSection('quotes')}
                >
                  <ChartCandlestick className="size-4" />
                  行情数据
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    'h-9 justify-start gap-2.5 px-3 font-normal hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    section === 'proxy' &&
                      'bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent'
                  )}
                  onClick={() => setSection('proxy')}
                >
                  <Network data-icon="inline-start" className="size-4" />
                  网络代理
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    'h-9 justify-start gap-2.5 px-3 font-normal hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    section === 'mcp' &&
                      'bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent'
                  )}
                  onClick={() => setSection('mcp')}
                >
                  <Wrench className="size-4" />
                  MCP 协议
                </Button>
              </nav>
            </aside>

            <ScrollArea className="min-h-0 min-w-0">
              <div className="px-6 py-5">
                {section === 'basic' && (
                  <section className="grid gap-5">
                    <h3 className="text-base font-semibold">基础信息</h3>
                    <div className="grid gap-2">
                      <Label htmlFor="workspace-settings-name">工作区名称</Label>
                      <Input
                        id="workspace-settings-name"
                        value={name}
                        onChange={(event) => {
                          setName(event.target.value)
                          setError('')
                        }}
                        placeholder="家庭资产"
                        maxLength={40}
                      />
                    </div>
                    <Field
                      data-disabled={
                        storageLocationStatus === 'loading' ||
                        storageLocationStatus === 'unavailable'
                      }
                      data-invalid={
                        storageLocationStatus === 'unavailable' || storageLocationStatus === 'error'
                      }
                    >
                      <FieldLabel htmlFor="workspace-settings-storage-path">
                        数据存储位置
                      </FieldLabel>
                      <Input
                        id="workspace-settings-storage-path"
                        value={storagePath}
                        placeholder={storageLocationPlaceholder || '/Users/name/.chromie'}
                        aria-invalid={
                          storageLocationStatus === 'unavailable' ||
                          storageLocationStatus === 'error'
                        }
                        disabled={
                          submitting ||
                          storageLocationStatus === 'loading' ||
                          storageLocationStatus === 'unavailable'
                        }
                        autoComplete="off"
                        spellCheck={false}
                        maxLength={4096}
                        onChange={(event) => {
                          setStoragePath(event.target.value)
                          setStorageLocationStatus('ready')
                        }}
                      />
                      <FieldDescription>
                        支持绝对路径或 ~/ 开头的路径，保存时检查写入权限，路径变化后自动重启
                      </FieldDescription>
                    </Field>
                    <Separator />
                    <div className="flex items-center justify-between gap-5">
                      <div className="grid gap-1">
                        <p className="text-sm font-medium">导出工作区</p>
                        <p className="text-xs leading-5 text-muted-foreground">
                          导出工作区数据、历史快照与账户同步配置
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => {
                          onOpenChange(false)
                          onRequestExport()
                        }}
                      >
                        <Upload data-icon="inline-start" />
                        导出
                      </Button>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between gap-5">
                      <div className="grid gap-1">
                        <p className="text-sm font-medium">删除工作区</p>
                        <p className="text-xs leading-5 text-muted-foreground">
                          将删除工作区内的全部数据，且无法撤销
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => {
                          onOpenChange(false)
                          onRequestDelete()
                        }}
                      >
                        <Trash2 data-icon="inline-start" />
                        删除
                      </Button>
                    </div>
                  </section>
                )}

                {section === 'currency' && (
                  <section className="grid gap-5">
                    <h3 className="text-base font-semibold">币种与汇率</h3>
                    <div className="grid gap-2">
                      <Label htmlFor="workspace-settings-base-currency">本位币</Label>
                      <Select
                        value={baseCurrency}
                        onValueChange={(value) => {
                          setBaseCurrency(value as BaseCurrency)
                          setError('')
                        }}
                      >
                        <SelectTrigger id="workspace-settings-base-currency">
                          <SelectValue placeholder="选择本位币" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {BASE_CURRENCIES.map((currency) => (
                              <SelectItem key={currency} value={currency}>
                                {currency}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <p className="text-xs leading-5 text-muted-foreground">
                        各币种市值按参考汇率折算为本位币，并据此计算全部持仓的市值占比
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="workspace-settings-exchange-rate-provider">汇率数据源</Label>
                      <Select
                        value={exchangeRateProvider}
                        onValueChange={(value) => {
                          setExchangeRateProvider(value as ExchangeRateProvider)
                          setError('')
                        }}
                      >
                        <SelectTrigger id="workspace-settings-exchange-rate-provider">
                          <SelectValue placeholder="选择汇率数据源">
                            {exchangeRateProviderLabels[exchangeRateProvider]}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {EXCHANGE_RATE_PROVIDERS.map((provider) => (
                              <SelectItem key={provider} value={provider}>
                                {exchangeRateProviderLabels[provider]}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="workspace-settings-exchange-rate-refresh-interval">
                        更新间隔（分钟）
                      </Label>
                      <Input
                        id="workspace-settings-exchange-rate-refresh-interval"
                        type="number"
                        placeholder={String(DEFAULT_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES)}
                        min={MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES}
                        max={MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES}
                        step={1}
                        value={exchangeRateRefreshInterval}
                        onChange={(event) => {
                          setExchangeRateRefreshInterval(event.target.value)
                          setError('')
                        }}
                      />
                      <p className="text-xs leading-5 text-muted-foreground">
                        打开工作区后立即更新，之后按此间隔自动更新
                      </p>
                    </div>
                  </section>
                )}

                {section === 'quotes' && (
                  <section className="grid gap-5">
                    <div className="grid gap-1">
                      <h3 className="text-base font-semibold">行情数据</h3>
                      <p className="text-xs leading-5 text-muted-foreground">
                        添加或编辑持仓时，根据市场和资产代码自动填写名称、币种与当前价格。场外基金固定使用东方财富。
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="workspace-settings-stock-quote-provider">股票资产</Label>
                      <Select
                        value={stockQuoteProvider}
                        onValueChange={(value) => {
                          setStockQuoteProvider(value as StockQuoteProvider)
                          setError('')
                        }}
                      >
                        <SelectTrigger id="workspace-settings-stock-quote-provider">
                          <SelectValue placeholder="选择股票行情数据源">
                            {stockQuoteProviderLabels[stockQuoteProvider]}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {STOCK_QUOTE_PROVIDERS.map((provider) => (
                              <SelectItem key={provider} value={provider}>
                                {stockQuoteProviderLabels[provider]}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="workspace-settings-crypto-quote-provider">加密资产</Label>
                      <Select
                        value={cryptoQuoteProvider}
                        onValueChange={(value) => {
                          setCryptoQuoteProvider(value as CryptoQuoteProvider)
                          setError('')
                        }}
                      >
                        <SelectTrigger id="workspace-settings-crypto-quote-provider">
                          <SelectValue placeholder="选择加密资产行情数据源">
                            {cryptoQuoteProviderLabels[cryptoQuoteProvider]}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {CRYPTO_QUOTE_PROVIDERS.map((provider) => (
                              <SelectItem key={provider} value={provider}>
                                {cryptoQuoteProviderLabels[provider]}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  </section>
                )}

                {section === 'mcp' && (
                  <div className="grid gap-4">
                    {mcpLoading ? (
                      <div className="grid gap-5" aria-label="正在加载 MCP 协议设置">
                        <div className="grid gap-2">
                          <Skeleton className="h-5 w-16" />
                          <Skeleton className="h-3 w-72 max-w-full" />
                        </div>
                        <div className="grid gap-4 rounded-sm border p-4">
                          {Array.from({ length: 2 }, (_, index) => (
                            <div key={index} className="flex items-center justify-between gap-6">
                              <div className="grid flex-1 gap-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-3 w-3/4" />
                              </div>
                              <Skeleton className="h-5 w-9" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <McpSettingsSection
                        connection={mcpConnection}
                        access={mcpAccess}
                        setAccess={setMcpAccess}
                      />
                    )}
                  </div>
                )}
                {section === 'proxy' && (
                  <ProxySettingsSection
                    profiles={proxyProfiles}
                    onCreate={onCreateProxyProfile}
                    onUpdate={onUpdateProxyProfile}
                    onDelete={onDeleteProxyProfile}
                    onTest={onTestProxy}
                  />
                )}
              </div>
            </ScrollArea>
          </DialogBody>

          <DialogFooter className="items-center sm:justify-end">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={
                  submitting ||
                  (section !== 'mcp' &&
                    (storageLocationStatus === 'loading' ||
                      storageLocationStatus === 'unavailable')) ||
                  (section === 'mcp' && (mcpLoading || Boolean(mcpError && !mcpConnection)))
                }
                aria-busy={submitting}
              >
                {submitting && <Spinner data-icon="inline-start" />}
                {submitting ? '保存中…' : '保存'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
