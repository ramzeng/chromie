import { useEffect, useState, type FormEvent } from 'react'
import {
  Coins,
  Ellipsis,
  Plus,
  ShieldAlert,
  SlidersHorizontal,
  UsersRound
} from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { ExchangeRateState } from '@/lib/exchange-rates'
import {
  ANCHOR_CURRENCIES,
  assetAccountTypeLabels,
  defaultCurrencyByMarket,
  DEFAULT_ANCHOR_CURRENCY,
  DEFAULT_EXCHANGE_RATE_PROVIDER,
  DEFAULT_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  DEFAULT_FUTU_OPEND_HOST,
  DEFAULT_FUTU_OPEND_PORT,
  DEFAULT_IBKR_GATEWAY_HOST,
  DEFAULT_IBKR_GATEWAY_PORT,
  DEFAULT_SYNC_INTERVAL,
  exchangeRateProviderLabels,
  EXCHANGE_RATE_PROVIDERS,
  MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  marketMeta,
  marketOrder,
  MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  type AssetAccount,
  type AssetAccountInput,
  type AssetAccountType,
  type AnchorCurrency,
  type ExchangeRateProvider,
  type Holder,
  type Market,
  type Position,
  type PositionGroup,
  type PositionGroupInput,
  type PositionInput,
  type ProductAccount,
  type ProductAccountInput,
  type ProductAccountSettingsInput
} from '@/lib/portfolio'

type BaseDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function FieldMessage({ children }: { children: string }) {
  return <p className="text-xs leading-5 text-destructive">{children}</p>
}

function operationErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/^Error invoking remote method '[^']+': Error: /, '')
}

type ExchangeRateView = Pick<ExchangeRateState, 'snapshot' | 'status' | 'error'>

function formatReferenceRate(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(value)
}

function formatExchangeRateTime(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date)
}

function ReferenceExchangeRates({ exchangeRates }: { exchangeRates: ExchangeRateView }) {
  const cnyRate = exchangeRates.snapshot?.rates.CNY
  const hkdRate = exchangeRates.snapshot?.rates.HKD
  const rates: Array<{ label: string; value: number }> = []
  if (typeof cnyRate === 'number' && Number.isFinite(cnyRate) && cnyRate > 0) {
    rates.push({ label: 'USD/CNY', value: cnyRate })
  }
  if (typeof hkdRate === 'number' && Number.isFinite(hkdRate) && hkdRate > 0) {
    rates.push({ label: 'USD/HKD', value: hkdRate })
  }
  if (
    typeof cnyRate === 'number' &&
    Number.isFinite(cnyRate) &&
    cnyRate > 0 &&
    typeof hkdRate === 'number' &&
    Number.isFinite(hkdRate) &&
    hkdRate > 0
  ) {
    rates.push({ label: 'HKD/CNY', value: cnyRate / hkdRate })
  }

  const status = exchangeRates.snapshot
    ? `${exchangeRates.status === 'error' ? '使用缓存' : exchangeRates.status === 'refreshing' ? '正在刷新' : '更新时间'} ${formatExchangeRateTime(exchangeRates.snapshot.fetchedAt)}`
    : exchangeRates.status === 'loading' || exchangeRates.status === 'refreshing'
      ? '正在获取汇率'
      : exchangeRates.error || '暂无汇率数据'

  return (
    <div className="grid gap-3 rounded-xl border bg-muted/20 p-4" role="status">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">参考汇率</p>
        <span className="text-xs text-muted-foreground">{status}</span>
      </div>
      {rates.length ? (
        <div className="grid grid-cols-3 gap-3">
          {rates.map((rate) => (
            <div key={rate.label} className="rounded-lg bg-background px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">{rate.label}</p>
              <p className="mt-1 font-medium tabular-nums">
                {formatReferenceRate(rate.value)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">暂时没有可用的参考汇率</p>
      )}
      {exchangeRates.error && (
        <p className="text-xs leading-5 text-destructive">{exchangeRates.error}</p>
      )}
    </div>
  )
}

function HolderDialog({
  open,
  onOpenChange,
  holder,
  holders,
  onSubmit
}: BaseDialogProps & {
  holder?: Holder
  holders: Holder[]
  onSubmit: (holder: Holder) => void
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setName(holder?.name ?? '')
    setError('')
  }, [holder, open])

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const normalizedName = name.trim()
    if (!normalizedName) {
      setError('请输入持有人名称')
      return
    }
    const duplicate = holders.some(
      (item) =>
        item.id !== holder?.id &&
        item.name.trim().toLocaleLowerCase() === normalizedName.toLocaleLowerCase()
    )
    if (duplicate) {
      setError('持有人名称不能重复')
      return
    }
    onSubmit({ id: holder?.id ?? crypto.randomUUID(), name: normalizedName })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{holder ? '编辑持有人' : '新增持有人'}</DialogTitle>
          <DialogDescription className="sr-only">
            {holder ? '修改持有人名称' : '为当前账户新增持有人'}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="holder-name">持有人名称</Label>
            <Input
              id="holder-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setError('')
              }}
              placeholder="输入持有人名称"
              autoFocus
              maxLength={40}
            />
          </div>
          {error && <FieldMessage>{error}</FieldMessage>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit">{holder ? '保存' : '新增'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ProductAccountDialog({
  open,
  onOpenChange,
  onSubmit
}: BaseDialogProps & {
  onSubmit: (input: ProductAccountInput) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [anchorCurrency, setAnchorCurrency] = useState<AnchorCurrency>(
    DEFAULT_ANCHOR_CURRENCY
  )
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setName('')
    setAnchorCurrency(DEFAULT_ANCHOR_CURRENCY)
    setError('')
  }, [open])

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!name.trim()) {
      setError('请输入账户名称')
      return
    }
    try {
      await onSubmit({ name, anchorCurrency })
      onOpenChange(false)
    } catch (submitError) {
      setError(operationErrorMessage(submitError))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建账户</DialogTitle>
          <DialogDescription>不同账户的数据相互独立</DialogDescription>
        </DialogHeader>
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="product-account-name">账户名称</Label>
            <Input
              id="product-account-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setError('')
              }}
              placeholder="例如：我的账户"
              autoFocus
              maxLength={40}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="product-account-anchor-currency">锚定币种</Label>
            <Select
              value={anchorCurrency}
              onValueChange={(value) => {
                setAnchorCurrency(value as AnchorCurrency)
                setError('')
              }}
            >
              <SelectTrigger id="product-account-anchor-currency">
                <SelectValue placeholder="选择锚定币种" />
              </SelectTrigger>
              <SelectContent>
                {ANCHOR_CURRENCIES.map((currency) => (
                  <SelectItem key={currency} value={currency}>
                    {currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs leading-5 text-muted-foreground">
              自动换算锚定市值，并据此计算全部持仓占比
            </p>
          </div>
          {error && <FieldMessage>{error}</FieldMessage>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit">创建账户</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ProductAccountSettingsDialog({
  open,
  onOpenChange,
  account,
  exchangeRates,
  initialSection = 'basic',
  onSubmit,
  onRequestDelete
}: BaseDialogProps & {
  account: ProductAccount
  exchangeRates: ExchangeRateView
  initialSection?: 'basic' | 'currency' | 'holders' | 'other'
  onSubmit: (input: ProductAccountSettingsInput) => Promise<void>
  onRequestDelete: () => void
}) {
  const [name, setName] = useState('')
  const [anchorCurrency, setAnchorCurrency] = useState<AnchorCurrency>(
    DEFAULT_ANCHOR_CURRENCY
  )
  const [exchangeRateProvider, setExchangeRateProvider] =
    useState<ExchangeRateProvider>(DEFAULT_EXCHANGE_RATE_PROVIDER)
  const [exchangeRateRefreshInterval, setExchangeRateRefreshInterval] = useState(
    String(DEFAULT_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES)
  )
  const [holders, setHolders] = useState<Holder[]>([])
  const [section, setSection] = useState<
    'basic' | 'currency' | 'holders' | 'other'
  >('basic')
  const [holderDialog, setHolderDialog] = useState<{
    open: boolean
    holderId?: string
  }>({ open: false })
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setName(account.name)
    setAnchorCurrency(account.anchorCurrency)
    setExchangeRateProvider(
      EXCHANGE_RATE_PROVIDERS.includes(account.exchangeRateProvider)
        ? account.exchangeRateProvider
        : DEFAULT_EXCHANGE_RATE_PROVIDER
    )
    setExchangeRateRefreshInterval(
      String(
        Number.isInteger(account.exchangeRateRefreshIntervalMinutes) &&
          account.exchangeRateRefreshIntervalMinutes >=
            MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES &&
          account.exchangeRateRefreshIntervalMinutes <=
            MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES
          ? account.exchangeRateRefreshIntervalMinutes
          : DEFAULT_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES
      )
    )
    setHolders(account.holders.map((holder) => ({ ...holder })))
    setSection(initialSection)
    setHolderDialog({ open: false })
    setError('')
  }, [account.id, initialSection, open])

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!name.trim()) {
      setSection('basic')
      setError('请输入账户名称')
      return
    }
    const refreshInterval = Number(exchangeRateRefreshInterval)
    if (
      !Number.isInteger(refreshInterval) ||
      refreshInterval < MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES ||
      refreshInterval > MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES
    ) {
      setSection('currency')
      setError(
        `刷新间隔请输入 ${MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES}–${MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES} 分钟之间的整数`
      )
      return
    }
    const normalizedHolderNames = holders.map((holder) => holder.name.trim())
    if (normalizedHolderNames.some((holderName) => !holderName)) {
      setSection('holders')
      setError('请填写持有人名称')
      return
    }
    const uniqueHolderNames = new Set(
      normalizedHolderNames.map((holderName) => holderName.toLocaleLowerCase())
    )
    if (uniqueHolderNames.size !== normalizedHolderNames.length) {
      setSection('holders')
      setError('持有人名称不能重复')
      return
    }
    try {
      await onSubmit({
        name,
        anchorCurrency,
        exchangeRateProvider,
        exchangeRateRefreshIntervalMinutes: refreshInterval,
        holders: holders.map((holder) => ({ ...holder, name: holder.name.trim() }))
      })
      onOpenChange(false)
    } catch (submitError) {
      setError(operationErrorMessage(submitError))
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[640px] max-h-[calc(100vh-2rem)] max-w-[760px] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>账户设置</DialogTitle>
          <DialogDescription className="sr-only">
            管理账户基础信息、币种与汇率、持有人和账户状态
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto]"
          onSubmit={handleSubmit}
        >
          <div className="grid min-h-0 grid-cols-[10.5rem_minmax(0,1fr)] overflow-hidden">
            <aside className="border-r bg-muted/25 p-3">
              <nav className="grid content-start gap-1" aria-label="账户设置菜单">
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    'h-9 justify-start gap-2.5 px-3 font-normal',
                    section === 'basic' &&
                      'bg-background font-medium shadow-xs hover:bg-background'
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
                    'h-9 justify-start gap-2.5 px-3 font-normal',
                    section === 'currency' &&
                      'bg-background font-medium shadow-xs hover:bg-background'
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
                    'h-9 justify-start gap-2.5 px-3 font-normal',
                    section === 'holders' &&
                      'bg-background font-medium shadow-xs hover:bg-background'
                  )}
                  onClick={() => setSection('holders')}
                >
                  <UsersRound className="size-4" />
                  持有人管理
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    'h-9 justify-start gap-2.5 px-3 font-normal',
                    section === 'other' &&
                      'bg-background font-medium shadow-xs hover:bg-background'
                  )}
                  onClick={() => setSection('other')}
                >
                  <ShieldAlert className="size-4" />
                  其他设置
                </Button>
              </nav>
            </aside>

            <div className="min-w-0 overflow-y-auto px-6 py-5">
              {section === 'basic' && (
                <section className="grid gap-4">
                  <h3 className="text-base font-semibold">基础信息</h3>
                  <div className="grid gap-2">
                    <Label htmlFor="account-settings-name">账户名称</Label>
                    <Input
                      id="account-settings-name"
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value)
                        setError('')
                      }}
                      placeholder="输入账户名称"
                      maxLength={40}
                    />
                  </div>
                </section>
              )}

              {section === 'currency' && (
                <section className="grid gap-5">
                  <h3 className="text-base font-semibold">币种与汇率</h3>
                  <ReferenceExchangeRates exchangeRates={exchangeRates} />
                  <div className="grid gap-2">
                    <Label htmlFor="account-settings-anchor-currency">
                      锚定币种
                    </Label>
                    <Select
                      value={anchorCurrency}
                      onValueChange={(value) => {
                        setAnchorCurrency(value as AnchorCurrency)
                        setError('')
                      }}
                    >
                      <SelectTrigger id="account-settings-anchor-currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ANCHOR_CURRENCIES.map((currency) => (
                          <SelectItem key={currency} value={currency}>
                            {currency}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs leading-5 text-muted-foreground">
                      自动换算锚定市值，并据此计算全部持仓占比
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="account-settings-exchange-rate-provider">
                      汇率数据源
                    </Label>
                    <Select
                      value={exchangeRateProvider}
                      onValueChange={(value) => {
                        setExchangeRateProvider(value as ExchangeRateProvider)
                        setError('')
                      }}
                    >
                      <SelectTrigger id="account-settings-exchange-rate-provider">
                        <SelectValue placeholder="选择汇率数据源">
                          {exchangeRateProviderLabels[exchangeRateProvider]}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {EXCHANGE_RATE_PROVIDERS.map((provider) => (
                          <SelectItem key={provider} value={provider}>
                            {exchangeRateProviderLabels[provider]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs leading-5 text-muted-foreground">
                      用于获取不同持仓币种之间的参考汇率
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="account-settings-exchange-rate-refresh-interval">
                      刷新间隔（分钟）
                    </Label>
                    <Input
                      id="account-settings-exchange-rate-refresh-interval"
                      type="number"
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
                      打开账户后立即同步，之后按此间隔自动刷新
                    </p>
                  </div>
                </section>
              )}

              {section === 'holders' && (
                <section className="grid gap-4">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-base font-semibold">持有人管理</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setHolderDialog({ open: true })}
                    >
                      <Plus className="size-4" />
                      新增
                    </Button>
                  </div>
                  {holders.length ? (
                    <div className="overflow-hidden rounded-lg border">
                      <Table>
                        <TableHeader className="bg-muted/20">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="h-9 px-3">持有人</TableHead>
                            <TableHead className="h-9 w-24 px-3 text-right">
                              资产账户
                            </TableHead>
                            <TableHead className="h-9 w-14 px-3 text-right">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {holders.map((holder) => {
                            const assetAccountCount = account.assetAccounts.filter(
                              (assetAccount) => assetAccount.holderId === holder.id
                            ).length
                            return (
                              <TableRow key={holder.id}>
                                <TableCell className="px-3 py-2 font-medium">
                                  {holder.name}
                                </TableCell>
                                <TableCell className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                  {assetAccountCount}
                                </TableCell>
                                <TableCell className="px-3 py-2">
                                  <div className="flex justify-end">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="size-8 text-muted-foreground"
                                          aria-label={`${holder.name}操作`}
                                        >
                                          <Ellipsis className="size-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="min-w-24">
                                        <DropdownMenuItem
                                          onSelect={() =>
                                            setHolderDialog({
                                              open: true,
                                              holderId: holder.id
                                            })
                                          }
                                        >
                                          编辑
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          variant="destructive"
                                          onSelect={() => {
                                            if (assetAccountCount > 0) {
                                              setError(
                                                '请先为该持有人名下的资产账户重新指定持有人'
                                              )
                                              return
                                            }
                                            setHolders((current) =>
                                              current.filter((item) => item.id !== holder.id)
                                            )
                                            setError('')
                                          }}
                                        >
                                          删除
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                      暂无持有人
                    </div>
                  )}
                </section>
              )}

              {section === 'other' && (
                <section className="grid gap-4">
                  <h3 className="text-base font-semibold">其他设置</h3>
                  <div className="rounded-xl border bg-card">
                    <div className="flex items-center justify-between gap-5 p-4">
                      <div>
                        <p className="text-sm font-medium">注销账户</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          将删除账户内的全部数据，且无法撤销
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        className="shrink-0"
                        onClick={() => {
                          onOpenChange(false)
                          onRequestDelete()
                        }}
                      >
                        注销账户
                      </Button>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t px-6 py-3">
            <div>{error && <FieldMessage>{error}</FieldMessage>}</div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="submit">保存设置</Button>
            </DialogFooter>
          </div>
        </form>
        </DialogContent>
      </Dialog>
      <HolderDialog
        open={holderDialog.open}
        onOpenChange={(dialogOpen) =>
          setHolderDialog((current) => ({ ...current, open: dialogOpen }))
        }
        holder={holders.find((holder) => holder.id === holderDialog.holderId)}
        holders={holders}
        onSubmit={(nextHolder) => {
          setHolders((current) =>
            current.some((holder) => holder.id === nextHolder.id)
              ? current.map((holder) =>
                  holder.id === nextHolder.id ? nextHolder : holder
                )
              : [...current, nextHolder]
          )
          setError('')
        }}
      />
    </>
  )
}

export function PositionGroupDialog({
  open,
  onOpenChange,
  group,
  onSubmit
}: BaseDialogProps & {
  group?: PositionGroup
  onSubmit: (input: PositionGroupInput) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setName(group?.name ?? '')
    setError('')
  }, [group, open])

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!name.trim()) {
      setError('请输入持仓分组名称')
      return
    }
    try {
      await onSubmit({ name })
      onOpenChange(false)
    } catch (submitError) {
      setError(operationErrorMessage(submitError))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{group ? '编辑持仓分组' : '新建持仓分组'}</DialogTitle>
          <DialogDescription>把不同资产账户中的持仓汇总到一起查看</DialogDescription>
        </DialogHeader>
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="position-group-name">持仓分组名称</Label>
            <Input
              id="position-group-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setError('')
              }}
              placeholder="例如：长期持有"
              autoFocus
              maxLength={40}
            />
            {error && <FieldMessage>{error}</FieldMessage>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit">{group ? '保存修改' : '创建持仓分组'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function GroupPositionsDialog({
  open,
  onOpenChange,
  group,
  assetAccounts,
  positionGroups,
  onSubmit
}: BaseDialogProps & {
  group: PositionGroup
  assetAccounts: AssetAccount[]
  positionGroups: PositionGroup[]
  onSubmit: (positionIds: string[]) => Promise<string | null>
}) {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setSelectedKeys(group.positionIds)
    setQuery('')
    setError('')
    // Only reset when the dialog opens or switches to another group. Background
    // account syncs should not discard selections that are still being edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id, open])

  const normalizedQuery = query.trim().toLowerCase()
  const visibleAccounts = assetAccounts.flatMap((account) => {
    const positions = normalizedQuery
      ? account.positions.filter((position) =>
          [
            account.name,
            position.symbol,
            position.name,
            marketMeta[position.market].label,
            position.currency
          ].some((value) => value.toLowerCase().includes(normalizedQuery))
        )
      : account.positions
    return positions.length ? [{ account, positions }] : []
  })
  const positionCount = assetAccounts.reduce(
    (total, account) => total + account.positions.length,
    0
  )
  const assignedGroupByPositionId = new Map(
    positionGroups.flatMap((positionGroup) =>
      positionGroup.id === group.id
        ? []
        : positionGroup.positionIds.map(
            (positionId) => [positionId, positionGroup.name] as const
          )
    )
  )

  function toggle(positionId: string): void {
    if (assignedGroupByPositionId.has(positionId)) return
    setSelectedKeys((current) =>
      current.includes(positionId)
        ? current.filter((item) => item !== positionId)
        : [...current, positionId]
    )
    setError('')
  }

  async function handleSubmit(): Promise<void> {
    try {
      const submitError = await onSubmit(selectedKeys)
      if (submitError) {
        setError(submitError)
        return
      }
      onOpenChange(false)
    } catch (submitError) {
      setError(operationErrorMessage(submitError))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl">
        <DialogHeader>
          <DialogTitle>管理“{group.name}”的持仓</DialogTitle>
          <DialogDescription>
            每个持仓只能加入一个分组，已属于其他分组的持仓不可选择
          </DialogDescription>
        </DialogHeader>
        {positionCount > 0 && (
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索资产账户、代码或名称"
            autoFocus
          />
        )}
        <div className="min-h-28 overflow-y-auto rounded-xl border bg-muted/10">
          {visibleAccounts.length ? (
            <div className="divide-y">
              {visibleAccounts.map(({ account, positions }) => (
                <section key={account.id} className="p-3">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <p className="text-sm font-medium">{account.name}</p>
                    <p className="text-xs text-muted-foreground">{positions.length} 项</p>
                  </div>
                  <div className="grid gap-1">
                    {positions.map((position) => {
                      const selected = selectedKeys.includes(position.id)
                      const assignedGroupName = assignedGroupByPositionId.get(position.id)
                      return (
                        <label
                          key={position.id}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                            assignedGroupName
                              ? 'cursor-not-allowed opacity-55'
                              : 'cursor-pointer hover:bg-muted/70'
                          )}
                        >
                          <input
                            type="checkbox"
                            className="size-4 accent-emerald-900"
                            checked={selected}
                            disabled={Boolean(assignedGroupName)}
                            onChange={() => toggle(position.id)}
                          />
                          <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">
                            {marketMeta[position.market].shortLabel}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {position.symbol}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {position.name}
                            </span>
                          </span>
                          <span className="text-right text-xs tabular-nums text-muted-foreground">
                            {assignedGroupName
                              ? `已在 ${assignedGroupName}`
                              : `${position.quantity} ${position.currency}`}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="grid min-h-32 place-items-center px-6 text-center text-sm text-muted-foreground">
              {positionCount ? '没有匹配的持仓' : '请先在资产账户中添加或同步持仓'}
            </div>
          )}
        </div>
        {error && <FieldMessage>{error}</FieldMessage>}
        <DialogFooter className="items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">已选择 {selectedKeys.length} 项持仓</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="button" onClick={() => void handleSubmit()}>
              保存
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SyncErrorDialog({
  open,
  onOpenChange,
  accountName,
  message
}: BaseDialogProps & {
  accountName: string
  message: string
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>同步失败</AlertDialogTitle>
          <AlertDialogDescription>
            {accountName}：{message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>知道了</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function BackupErrorDialog({
  open,
  onOpenChange,
  message
}: BaseDialogProps & {
  message: string
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>操作失败</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>知道了</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function ImportBackupDialog({
  open,
  onOpenChange,
  accountName,
  assetAccountCount,
  groupCount,
  positionCount,
  snapshotCount,
  onConfirm
}: BaseDialogProps & {
  accountName: string
  assetAccountCount: number
  groupCount: number
  positionCount: number
  snapshotCount: number
  onConfirm: () => void | Promise<void>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>导入“{accountName}”？</DialogTitle>
          <DialogDescription>
            包含 {assetAccountCount} 个资产账户、{groupCount} 个持仓分组、{positionCount}{' '}
            项持仓和 {snapshotCount} 个历史快照，将作为新账户导入
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false)
              void onConfirm()
            }}
          >
            导入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ExportBackupDialog({
  open,
  onOpenChange,
  onConfirm
}: BaseDialogProps & {
  onConfirm: () => void | Promise<void>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>导出当前账户</DialogTitle>
          <DialogDescription>备份包含同步凭据，请妥善保管</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false)
              void onConfirm()
            }}
          >
            导出
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AssetAccountDialog({
  open,
  onOpenChange,
  account,
  holders,
  onManageHolders,
  onSubmit
}: BaseDialogProps & {
  account?: AssetAccount
  holders: Holder[]
  onManageHolders: () => void
  onSubmit: (input: AssetAccountInput) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [holderId, setHolderId] = useState('unassigned')
  const [type, setType] = useState<AssetAccountType>('Futu')
  const [autoSync, setAutoSync] = useState(false)
  const [syncHost, setSyncHost] = useState(DEFAULT_FUTU_OPEND_HOST)
  const [syncPort, setSyncPort] = useState(String(DEFAULT_FUTU_OPEND_PORT))
  const [syncInterval, setSyncInterval] = useState(String(DEFAULT_SYNC_INTERVAL))
  const [syncKey, setSyncKey] = useState('')
  const [okxApiKey, setOkxApiKey] = useState('')
  const [okxSecretKey, setOkxSecretKey] = useState('')
  const [okxPassphrase, setOkxPassphrase] = useState('')
  const [ibkrGatewayHost, setIbkrGatewayHost] = useState(DEFAULT_IBKR_GATEWAY_HOST)
  const [ibkrGatewayPort, setIbkrGatewayPort] = useState(
    String(DEFAULT_IBKR_GATEWAY_PORT)
  )
  const [binanceApiKey, setBinanceApiKey] = useState('')
  const [binanceSecretKey, setBinanceSecretKey] = useState('')
  const [error, setError] = useState('')
  const supportsAutoSync =
    type === 'Futu' || type === 'Okx' || type === 'Ibkr' || type === 'Binance'

  useEffect(() => {
    if (!open) return
    setName(account?.name ?? assetAccountTypeLabels[account?.type ?? 'Futu'])
    setHolderId(account?.holderId ?? 'unassigned')
    setType(account?.type ?? 'Futu')
    setAutoSync(Boolean(account?.sync))
    setSyncHost(account?.sync?.websocket?.host ?? DEFAULT_FUTU_OPEND_HOST)
    setSyncPort(String(account?.sync?.websocket?.port ?? DEFAULT_FUTU_OPEND_PORT))
    setSyncInterval(String(account?.sync?.interval ?? DEFAULT_SYNC_INTERVAL))
    setSyncKey(account?.sync?.websocket?.key ?? '')
    setOkxApiKey(account?.sync?.api?.apiKey ?? '')
    setOkxSecretKey(account?.sync?.api?.secretKey ?? '')
    setOkxPassphrase(account?.sync?.api?.passphrase ?? '')
    setIbkrGatewayHost(account?.sync?.gateway?.host ?? DEFAULT_IBKR_GATEWAY_HOST)
    setIbkrGatewayPort(
      String(account?.sync?.gateway?.port ?? DEFAULT_IBKR_GATEWAY_PORT)
    )
    setBinanceApiKey(account?.sync?.api?.apiKey ?? '')
    setBinanceSecretKey(account?.sync?.api?.secretKey ?? '')
    setError('')
  }, [account, open])

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!name.trim()) {
      setError('请输入资产账户名称')
      return
    }
    const holder = holders.find((item) => item.id === holderId)
    if (!holder) {
      setError(holders.length ? '请选择持有人' : '请先添加持有人')
      return
    }
    const parsedSyncPort = Number(syncPort)
    const parsedSyncInterval = Number(syncInterval)
    const syncEnabled = supportsAutoSync && autoSync
    if (type === 'Futu' && syncEnabled && !syncHost.trim()) {
      setError('请输入 Futu OpenD 地址')
      return
    }
    if (
      type === 'Futu' &&
      syncEnabled &&
      (!Number.isInteger(parsedSyncPort) || parsedSyncPort < 1 || parsedSyncPort > 65535)
    ) {
      setError('Futu OpenD 端口需为 1–65535')
      return
    }
    if (
      syncEnabled &&
      (!Number.isInteger(parsedSyncInterval) || parsedSyncInterval < 5 || parsedSyncInterval > 3600)
    ) {
      setError('同步间隔需为 5–3600 秒')
      return
    }
    if (
      type === 'Okx' &&
      syncEnabled &&
      (!okxApiKey.trim() || !okxSecretKey || !okxPassphrase)
    ) {
      setError('请填写完整的 OKX API 配置')
      return
    }
    const parsedIbkrGatewayPort = Number(ibkrGatewayPort)
    const normalizedIbkrGatewayHost = ibkrGatewayHost
      .trim()
      .toLowerCase()
      .replace(/^\[|\]$/g, '')
    if (
      type === 'Ibkr' &&
      syncEnabled &&
      !['127.0.0.1', 'localhost', '::1'].includes(normalizedIbkrGatewayHost)
    ) {
      setError('IBKR Client Portal Gateway 地址必须是本机回环地址')
      return
    }
    if (
      type === 'Ibkr' &&
      syncEnabled &&
      (!Number.isInteger(parsedIbkrGatewayPort) ||
        parsedIbkrGatewayPort < 1 ||
        parsedIbkrGatewayPort > 65535)
    ) {
      setError('IBKR Client Portal Gateway 端口需为 1–65535')
      return
    }
    if (
      type === 'Binance' &&
      syncEnabled &&
      (!binanceApiKey.trim() || !binanceSecretKey)
    ) {
      setError('请填写完整的币安 API 配置')
      return
    }
    const lastSyncedAt =
      account?.type === type ? account.sync?.lastSyncedAt : undefined
    try {
      await onSubmit({
        name: name.trim(),
        type,
        holderId: holder.id,
        ...(syncEnabled
          ? {
              sync: {
              interval:
                Number.isInteger(parsedSyncInterval) &&
                parsedSyncInterval >= 5 &&
                parsedSyncInterval <= 3600
                  ? parsedSyncInterval
                  : DEFAULT_SYNC_INTERVAL,
              ...(type === 'Futu'
                ? {
                    websocket: {
                      host: syncHost.trim() || DEFAULT_FUTU_OPEND_HOST,
                      port:
                        Number.isInteger(parsedSyncPort) &&
                        parsedSyncPort >= 1 &&
                        parsedSyncPort <= 65535
                          ? parsedSyncPort
                          : DEFAULT_FUTU_OPEND_PORT,
                      ...(syncKey.trim() ? { key: syncKey.trim() } : {})
                    }
                  }
                : type === 'Ibkr'
                  ? {
                      gateway: {
                        host: normalizedIbkrGatewayHost,
                        port: parsedIbkrGatewayPort
                      }
                    }
                  : type === 'Okx'
                    ? {
                        api: {
                          apiKey: okxApiKey.trim(),
                          secretKey: okxSecretKey,
                          passphrase: okxPassphrase
                        }
                      }
                    : {
                        api: {
                          apiKey: binanceApiKey.trim(),
                          secretKey: binanceSecretKey
                        }
                      }),
              ...(lastSyncedAt ? { lastSyncedAt } : {})
              }
            }
          : {})
      })
      onOpenChange(false)
    } catch (submitError) {
      setError(operationErrorMessage(submitError))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{account ? '编辑资产账户' : '添加资产账户'}</DialogTitle>
          <DialogDescription>选择资产账户的持有人和来源</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label>账户类型</Label>
            <Select
              value={type}
              onValueChange={(value) => {
                const nextType = value as AssetAccountType
                setName((currentName) =>
                  !currentName.trim() ||
                  currentName === assetAccountTypeLabels[type]
                    ? assetAccountTypeLabels[nextType]
                    : currentName
                )
                setType(nextType)
                if (
                  nextType === 'Boci' ||
                  nextType === 'Alipay' ||
                  nextType === 'General' ||
                  nextType === 'Cmb' ||
                  nextType === 'Boc'
                ) {
                  setAutoSync(false)
                }
                setError('')
              }}
            >
              <SelectTrigger autoFocus>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Futu">富途牛牛</SelectItem>
                <SelectItem value="Ibkr">盈透证券</SelectItem>
                <SelectItem value="Boci">中银国际</SelectItem>
                <SelectItem value="Okx">欧易</SelectItem>
                <SelectItem value="Binance">币安</SelectItem>
                <SelectItem value="Alipay">支付宝</SelectItem>
                <SelectItem value="Cmb">招商银行</SelectItem>
                <SelectItem value="Boc">中国银行</SelectItem>
                <SelectItem value="General">通用</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="asset-account-name">账户名称</Label>
            <Input
              id="asset-account-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setError('')
              }}
              placeholder="例如：我的美股账户"
              maxLength={50}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="asset-account-holder">持有人</Label>
            <Select
              value={holderId}
              disabled={!holders.length}
              onValueChange={(value) => {
                setHolderId(value)
                setError('')
              }}
            >
              <SelectTrigger id="asset-account-holder">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned" disabled>
                  请选择持有人
                </SelectItem>
                {holders.map((holder) => (
                  <SelectItem key={holder.id} value={holder.id}>
                    {holder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs leading-5 text-muted-foreground">
                {holders.length
                  ? '每个资产账户都需要指定持有人'
                  : '请先在账户设置中添加持有人'}
              </p>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto shrink-0 px-0 py-0"
                onClick={onManageHolders}
              >
                {holders.length ? '管理持有人' : '添加持有人'}
              </Button>
            </div>
          </div>
          {supportsAutoSync && (
            <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/20 px-4 py-3.5">
              <div>
                <Label htmlFor="asset-account-auto-sync">自动同步</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  {type === 'Futu'
                    ? '通过本机 Futu OpenD 同步持仓'
                    : type === 'Ibkr'
                      ? '通过本机 Client Portal Gateway 同步资产'
                      : type === 'Okx'
                        ? '通过 OKX 只读 API 同步资产'
                        : '通过币安只读 API 同步资产'}
                </p>
              </div>
              <Switch
                id="asset-account-auto-sync"
                checked={autoSync}
                onCheckedChange={(checked) => {
                  setAutoSync(checked)
                  setError('')
                }}
              />
            </div>
          )}
          {!supportsAutoSync && (
            <div className="rounded-xl border bg-muted/20 px-4 py-3.5">
              <p className="text-sm font-medium">手动维护</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {type === 'Alipay'
                  ? '支付宝'
                  : type === 'Boci'
                    ? '中银国际'
                  : type === 'Cmb'
                    ? '招商银行'
                    : type === 'Boc'
                      ? '中国银行'
                    : '通用'}
                账户暂不支持自动同步，可手动添加和编辑持仓
              </p>
            </div>
          )}
          {type === 'Futu' && autoSync && (
            <div className="grid gap-3 rounded-xl border bg-muted/20 p-4">
              <div>
                <p className="text-sm font-medium">Futu OpenD 配置</p>
                <p className="mt-1 text-xs text-muted-foreground">连接 WebSocket 服务</p>
              </div>
              <div className="grid grid-cols-[1fr_8rem] gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="asset-account-sync-host">地址</Label>
                  <Input
                    id="asset-account-sync-host"
                    value={syncHost}
                    onChange={(event) => {
                      setSyncHost(event.target.value)
                      setError('')
                    }}
                    placeholder={DEFAULT_FUTU_OPEND_HOST}
                    maxLength={253}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="asset-account-sync-port">端口</Label>
                  <Input
                    id="asset-account-sync-port"
                    type="number"
                    value={syncPort}
                    onChange={(event) => {
                      setSyncPort(event.target.value)
                      setError('')
                    }}
                    min="1"
                    max="65535"
                    step="1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-[1fr_8rem] gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="asset-account-sync-key">密钥</Label>
                  <Input
                    id="asset-account-sync-key"
                    type="password"
                    value={syncKey}
                    onChange={(event) => {
                      setSyncKey(event.target.value)
                      setError('')
                    }}
                    placeholder="WebSocket Authentication Key"
                    autoComplete="off"
                    maxLength={256}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="asset-account-sync-interval">间隔（秒）</Label>
                  <Input
                    id="asset-account-sync-interval"
                    type="number"
                    value={syncInterval}
                    onChange={(event) => {
                      setSyncInterval(event.target.value)
                      setError('')
                    }}
                    min="5"
                    max="3600"
                    step="1"
                  />
                </div>
              </div>
            </div>
          )}
          {type === 'Okx' && autoSync && (
            <div className="grid gap-3 rounded-xl border bg-muted/20 p-4">
              <div>
                <p className="text-sm font-medium">OKX API 配置</p>
                <p className="mt-1 text-xs text-muted-foreground">仅需读取权限</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="asset-account-okx-api-key">API Key</Label>
                <Input
                  id="asset-account-okx-api-key"
                  value={okxApiKey}
                  onChange={(event) => {
                    setOkxApiKey(event.target.value)
                    setError('')
                  }}
                  autoComplete="off"
                  maxLength={256}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="asset-account-okx-secret-key">Secret Key</Label>
                  <Input
                    id="asset-account-okx-secret-key"
                    type="password"
                    value={okxSecretKey}
                    onChange={(event) => {
                      setOkxSecretKey(event.target.value)
                      setError('')
                    }}
                    autoComplete="new-password"
                    maxLength={512}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="asset-account-okx-passphrase">Passphrase</Label>
                  <Input
                    id="asset-account-okx-passphrase"
                    type="password"
                    value={okxPassphrase}
                    onChange={(event) => {
                      setOkxPassphrase(event.target.value)
                      setError('')
                    }}
                    autoComplete="new-password"
                    maxLength={256}
                  />
                </div>
              </div>
              <div className="grid max-w-40 gap-2">
                <Label htmlFor="asset-account-okx-sync-interval">间隔（秒）</Label>
                <Input
                  id="asset-account-okx-sync-interval"
                  type="number"
                  value={syncInterval}
                  onChange={(event) => {
                    setSyncInterval(event.target.value)
                    setError('')
                  }}
                  min="5"
                  max="3600"
                  step="1"
                />
              </div>
            </div>
          )}
          {type === 'Ibkr' && autoSync && (
            <div className="grid gap-3 rounded-xl border bg-muted/20 p-4">
              <div>
                <p className="text-sm font-medium">IBKR Client Portal Gateway</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  请先启动本机 Gateway，并在浏览器完成登录；仅支持回环地址
                </p>
              </div>
              <div className="grid grid-cols-[1fr_8rem] gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="asset-account-ibkr-host">地址</Label>
                  <Input
                    id="asset-account-ibkr-host"
                    value={ibkrGatewayHost}
                    onChange={(event) => {
                      setIbkrGatewayHost(event.target.value)
                      setError('')
                    }}
                    placeholder={DEFAULT_IBKR_GATEWAY_HOST}
                    maxLength={64}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="asset-account-ibkr-port">端口</Label>
                  <Input
                    id="asset-account-ibkr-port"
                    type="number"
                    value={ibkrGatewayPort}
                    onChange={(event) => {
                      setIbkrGatewayPort(event.target.value)
                      setError('')
                    }}
                    min="1"
                    max="65535"
                    step="1"
                  />
                </div>
              </div>
              <div className="grid max-w-40 gap-2">
                <Label htmlFor="asset-account-ibkr-sync-interval">间隔（秒）</Label>
                <Input
                  id="asset-account-ibkr-sync-interval"
                  type="number"
                  value={syncInterval}
                  onChange={(event) => {
                    setSyncInterval(event.target.value)
                    setError('')
                  }}
                  min="5"
                  max="3600"
                  step="1"
                />
              </div>
            </div>
          )}
          {type === 'Binance' && autoSync && (
            <div className="grid gap-3 rounded-xl border bg-muted/20 p-4">
              <div>
                <p className="text-sm font-medium">币安 API 配置</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  使用 HMAC API Key，仅需读取权限
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="asset-account-binance-api-key">API Key</Label>
                <Input
                  id="asset-account-binance-api-key"
                  value={binanceApiKey}
                  onChange={(event) => {
                    setBinanceApiKey(event.target.value)
                    setError('')
                  }}
                  autoComplete="off"
                  maxLength={256}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="asset-account-binance-secret-key">Secret Key</Label>
                <Input
                  id="asset-account-binance-secret-key"
                  type="password"
                  value={binanceSecretKey}
                  onChange={(event) => {
                    setBinanceSecretKey(event.target.value)
                    setError('')
                  }}
                  autoComplete="new-password"
                  maxLength={512}
                />
              </div>
              <div className="grid max-w-40 gap-2">
                <Label htmlFor="asset-account-binance-sync-interval">间隔（秒）</Label>
                <Input
                  id="asset-account-binance-sync-interval"
                  type="number"
                  value={syncInterval}
                  onChange={(event) => {
                    setSyncInterval(event.target.value)
                    setError('')
                  }}
                  min="5"
                  max="3600"
                  step="1"
                />
              </div>
            </div>
          )}
          {error && <FieldMessage>{error}</FieldMessage>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit">{account ? '保存修改' : '添加账户'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function PositionDialog({
  open,
  onOpenChange,
  position,
  onSubmit
}: BaseDialogProps & {
  position?: Position
  onSubmit: (input: PositionInput) => Promise<string | null>
}) {
  const [market, setMarket] = useState<Market>('US')
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setMarket(position?.market ?? 'US')
    setSymbol(position?.symbol ?? '')
    setName(position?.name ?? '')
    setCurrency(position?.currency ?? 'USD')
    setQuantity(position ? String(position.quantity) : '')
    setPrice(position?.price === undefined ? '' : String(position.price))
    setError('')
  }, [open, position])

  function handleMarketChange(value: string): void {
    const nextMarket = value as Market
    const previousDefault = defaultCurrencyByMarket[market]
    setMarket(nextMarket)
    if (!currency || currency === previousDefault) setCurrency(defaultCurrencyByMarket[nextMarket])
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const parsedQuantity = Number(quantity)
    const parsedPrice = price.trim() ? Number(price) : undefined
    if (!symbol.trim() || !name.trim() || !currency.trim()) {
      setError('请填写代码、名称和币种')
      return
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError('持仓数量必须大于 0')
      return
    }
    if (parsedPrice !== undefined && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      setError('当前价格不能小于 0')
      return
    }

    try {
      const submitError = await onSubmit({
        market,
        symbol,
        name,
        currency,
        quantity: parsedQuantity,
        ...(parsedPrice === undefined ? {} : { price: parsedPrice })
      })
      if (submitError) {
        setError(submitError)
        return
      }
      onOpenChange(false)
    } catch (submitError) {
      setError(operationErrorMessage(submitError))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{position ? '编辑持仓' : '添加持仓'}</DialogTitle>
          <DialogDescription>市值按数量和价格自动计算</DialogDescription>
        </DialogHeader>
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>市场</Label>
              <Select value={market} onValueChange={handleMarketChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {marketOrder.map((value) => (
                    <SelectItem key={value} value={value}>
                      {marketMeta[value].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="position-symbol">资产代码</Label>
              <Input
                id="position-symbol"
                value={symbol}
                onChange={(event) => {
                  setSymbol(event.target.value.toUpperCase())
                  setError('')
                }}
                placeholder={
                  market === 'CN'
                    ? '600519'
                    : market === 'HK'
                      ? '00700'
                      : market === 'US'
                        ? 'AAPL'
                        : 'BTC'
                }
                autoFocus
                maxLength={24}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="position-name">资产名称</Label>
            <Input
              id="position-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setError('')
              }}
              placeholder="例如：Apple"
              maxLength={60}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="position-currency">币种</Label>
              <Input
                id="position-currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                placeholder="USD"
                maxLength={10}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="position-quantity">持仓数量</Label>
              <Input
                id="position-quantity"
                type="number"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="0"
                min="0"
                step="any"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="position-price">当前价格</Label>
              <Input
                id="position-price"
                type="number"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="可不填"
                min="0"
                step="any"
              />
            </div>
          </div>
          {error && <FieldMessage>{error}</FieldMessage>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit">{position ? '保存修改' : '添加持仓'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  actionLabel = '确认删除',
  onConfirm
}: BaseDialogProps & {
  title: string
  description: string
  actionLabel?: string
  onConfirm: () => void | Promise<void>
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction onClick={() => void onConfirm()}>
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
