import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'
import {
  ChartPie,
  ChartSpline,
  Check,
  ChevronDown,
  Download,
  Ellipsis,
  Eye,
  EyeOff,
  Folder,
  History,
  Layers3,
  ListPlus,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  UsersRound,
  WalletCards,
  Wrench
} from 'lucide-react'

import {
  AssetAccountDialog,
  BackupErrorDialog,
  DeleteConfirmDialog,
  ExchangeRateErrorDialog,
  ExportBackupDialog,
  ImportBackupDialog,
  GroupPositionsDialog,
  PositionDialog,
  PositionGroupDialog,
  ProductAccountDialog,
  ProductAccountSettingsDialog,
  SyncErrorDialog
} from '@/components/portfolio/dialogs'
import {
  createShareImageDataUrl,
  type ShareImageScope
} from '@/components/portfolio/share-image-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { BOC_ICON_DATA_URL } from '@/lib/boc-icon'
import { BOCI_ICON_DATA_URL } from '@/lib/boci-icon'
import { FUTU_ICON_DATA_URL } from '@/lib/futu-icon'
import { CMB_ICON_DATA_URL } from '@/lib/cmb-icon'
import { OKX_ICON_DATA_URL } from '@/lib/okx-icon'
import {
  useExchangeRates,
  type ExchangeRateState
} from '@/lib/exchange-rates'
import { cn } from '@/lib/utils'
import { convertToAnchorCurrency, valuePositions } from '@/lib/valuation'
import {
  DEFAULT_SYNC_INTERVAL,
  formatMoney,
  formatNumber,
  marketMeta,
  type AssetAccount,
  type AssetAccountInput,
  type Market,
  type Position,
  type PositionGroup,
  type PositionGroupInput,
  type PositionInput,
  type PortfolioSnapshot,
  type ProductAccount,
  type ProductAccountInput,
  type ProductAccountSettingsInput,
  usePortfolio
} from '@/lib/portfolio'

type ProductDialogState = { open: boolean }
type AssetDialogState = { open: boolean; account?: AssetAccount }
type PositionDialogState = { open: boolean; accountId?: string; position?: Position }
type PositionGroupDialogState = { open: boolean; group?: PositionGroup }
type OverviewMode = 'accounts' | 'groups'
type DeleteTarget =
  | { kind: 'product'; account: ProductAccount }
  | { kind: 'asset'; account: AssetAccount }
  | { kind: 'group'; group: PositionGroup }
  | { kind: 'position'; account: AssetAccount; position: Position }
  | { kind: 'snapshot'; snapshot: PortfolioSnapshot }
  | null

type AccountSyncState = {
  status: 'syncing' | 'success' | 'error'
  message: string
}

type SyncErrorDialogState = {
  accountId: string
  accountName: string
  message: string
} | null

type PendingImport = {
  account: ProductAccount
  snapshots: PortfolioSnapshot[]
  assetAccountCount: number
  groupCount: number
  positionCount: number
  snapshotCount: number
} | null

const ASSET_VALUE_MASK_STORAGE_KEY = 'chromie.asset-values-masked'
const AssetValueMaskContext = createContext(false)

function MaskedAssetValue({ children }: { children: ReactNode }) {
  const masked = useContext(AssetValueMaskContext)
  return masked ? (
    <span
      aria-label="资产数据已遮蔽"
      className="select-none tracking-[0.12em] text-muted-foreground"
    >
      ••••••
    </span>
  ) : (
    <>{children}</>
  )
}

function loadAssetValueMask(): boolean {
  try {
    return window.localStorage.getItem(ASSET_VALUE_MASK_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function accountSyncInterval(account: AssetAccount): number {
  const value = account.sync?.interval
  return typeof value === 'number' && Number.isFinite(value) && value >= 5
    ? Math.min(Math.round(value), 3600)
    : DEFAULT_SYNC_INTERVAL
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

function formatExchangeRate(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(value)
}

function compareOptionalValuesDescending(
  left: number | undefined,
  right: number | undefined
): number {
  if (left === undefined) return right === undefined ? 0 : 1
  if (right === undefined) return -1
  return right - left
}

function formatLastSyncedAt(value: string): string {
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

function formatSnapshotTime(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date)
}

function shortSnapshotHash(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 7)
}

type ExchangeRateView = Pick<ExchangeRateState, 'snapshot' | 'status' | 'error'> &
  Partial<Pick<ExchangeRateState, 'refresh'>>

function AccountTypeIcon({ type, className }: { type: string; className?: string }) {
  if (type === 'Futu') {
    return (
      <img
        src={FUTU_ICON_DATA_URL}
        alt=""
        aria-hidden="true"
        className={cn('shrink-0', className)}
      />
    )
  }

  if (type === 'Alipay') {
    return (
      <svg
        viewBox="0 0 48 48"
        aria-hidden="true"
        className={cn('shrink-0', className)}
      >
        <rect width="48" height="48" rx="7" fill="#1677ff" />
        <text
          x="24"
          y="32"
          fill="white"
          fontSize="25"
          fontWeight="700"
          textAnchor="middle"
        >
          支
        </text>
      </svg>
    )
  }

  if (type === 'Boci') {
    return (
      <img
        aria-hidden="true"
        src={BOCI_ICON_DATA_URL}
        alt=""
        className={cn('shrink-0 rounded-[14%]', className)}
      />
    )
  }

  if (type === 'Boc') {
    return (
      <img
        aria-hidden="true"
        src={BOC_ICON_DATA_URL}
        alt=""
        className={cn('shrink-0 rounded-[14%]', className)}
      />
    )
  }

  if (type === 'General') {
    return <ShieldCheck aria-hidden="true" className={cn('shrink-0 text-foreground', className)} />
  }

  if (type === 'Cmb') {
    return (
      <img
        aria-hidden="true"
        src={CMB_ICON_DATA_URL}
        alt=""
        className={cn('shrink-0 rounded-[14%]', className)}
      />
    )
  }

  if (type === 'Ibkr') {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'grid shrink-0 place-items-center rounded-[18%] bg-[#d81222] text-[0.42em] font-bold tracking-[-0.04em] text-white',
          className
        )}
      >
        IB
      </span>
    )
  }

  if (type === 'Binance') {
    return (
      <svg
        viewBox="0 0 48 48"
        aria-hidden="true"
        className={cn('shrink-0', className)}
      >
        <rect width="48" height="48" rx="9" fill="#181a20" />
        <g fill="#f3ba2f">
          <path d="M24 10l5.1 5.1L24 20.2l-5.1-5.1L24 10Z" />
          <path d="m15.1 18.9 5.1 5.1-5.1 5.1L10 24l5.1-5.1Z" />
          <path d="m32.9 18.9 5.1 5.1-5.1 5.1-5.1-5.1 5.1-5.1Z" />
          <path d="m24 27.8 5.1 5.1L24 38l-5.1-5.1 5.1-5.1Z" />
          <path d="m24 20.3 3.7 3.7-3.7 3.7-3.7-3.7 3.7-3.7Z" />
        </g>
      </svg>
    )
  }

  if (type === 'Okx') {
    return (
      <img
        src={OKX_ICON_DATA_URL}
        alt=""
        aria-hidden="true"
        className={cn('shrink-0', className)}
      />
    )
  }

  return <ShieldCheck aria-hidden="true" className={cn('shrink-0', className)} />
}

function LocalMark() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="grid size-6 place-items-center rounded-md bg-emerald-900/8 text-emerald-900">
        <ShieldCheck className="size-3.5" />
      </span>
      <span>数据仅保存在本地</span>
    </div>
  )
}

function EmptyProductAccount({
  onCreate,
  onImport
}: {
  onCreate: () => void
  onImport: () => void
}) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background p-8">
      <div className="window-drag absolute inset-x-0 top-0 h-12" />
      <div className="absolute -left-32 top-24 size-80 rounded-full bg-emerald-200/35 blur-3xl" />
      <div className="absolute -right-28 bottom-0 size-96 rounded-full bg-orange-100/55 blur-3xl" />
      <Card className="relative w-full max-w-lg border-white/80 bg-white/85 shadow-2xl shadow-stone-200/60 backdrop-blur-xl">
        <CardHeader className="items-center pb-3 pt-9 text-center">
          <span className="mb-4 grid size-14 place-items-center rounded-xl bg-emerald-950 text-white shadow-lg shadow-emerald-950/15">
            <Layers3 className="size-6" />
          </span>
          <CardTitle className="text-3xl tracking-[-0.035em]">Chromie</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 px-9 pb-9 pt-4">
          <Button size="lg" onClick={onCreate}>
            <Plus className="size-4" />
            创建账户
          </Button>
          <Button variant="outline" onClick={onImport}>
            <Download className="size-4" />
            导入账户
          </Button>
          <div className="flex justify-center">
            <LocalMark />
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

const accountViewCurrencies = ['USD', 'HKD', 'CNY'] as const

function ExchangeRateBanner({ exchangeRates }: { exchangeRates: ExchangeRateView }) {
  const cnyRate = exchangeRates.snapshot?.rates.CNY
  const hkdRate = exchangeRates.snapshot?.rates.HKD
  const rateItems: Array<{ label: string; value: number }> = []
  if (typeof cnyRate === 'number' && Number.isFinite(cnyRate) && cnyRate > 0) {
    rateItems.push({ label: 'USD/CNY', value: cnyRate })
  }
  if (typeof hkdRate === 'number' && Number.isFinite(hkdRate) && hkdRate > 0) {
    rateItems.push({ label: 'USD/HKD', value: hkdRate })
  }
  if (
    typeof cnyRate === 'number' &&
    Number.isFinite(cnyRate) &&
    cnyRate > 0 &&
    typeof hkdRate === 'number' &&
    Number.isFinite(hkdRate) &&
    hkdRate > 0
  ) {
    rateItems.push({ label: 'HKD/CNY', value: cnyRate / hkdRate })
  }
  const refreshing =
    exchangeRates.status === 'loading' || exchangeRates.status === 'refreshing'
  const rateStatus = exchangeRates.snapshot
    ? `${exchangeRates.status === 'error' ? '使用缓存' : refreshing ? '正在刷新，上次同步' : '最近同步'} ${formatLastSyncedAt(exchangeRates.snapshot.fetchedAt)}`
    : refreshing
      ? '正在获取汇率'
      : '暂无汇率'

  return (
    <div
      className="mt-3 flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border/70 bg-muted/25 px-4 py-2 text-xs"
      role="status"
    >
      <span className="shrink-0 font-medium">参考汇率</span>
      {rateItems.map((item) => (
        <span key={item.label} className="tabular-nums text-foreground/75">
          {item.label} {formatExchangeRate(item.value)}
        </span>
      ))}
      {rateItems.length > 0 && <span className="text-border">·</span>}
      <span className="text-muted-foreground">{rateStatus}</span>
      {exchangeRates.refresh && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto size-7 shrink-0 text-muted-foreground"
          disabled={refreshing}
          aria-label={refreshing ? '正在刷新汇率' : '刷新汇率'}
          title={refreshing ? '正在刷新汇率' : '刷新汇率'}
          onClick={() => void exchangeRates.refresh?.()}
        >
          <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
        </Button>
      )}
    </div>
  )
}

function ValueSummaryCard({
  positions,
  exchangeRates
}: {
  positions: Position[]
  exchangeRates: ExchangeRateView
}) {
  const summaries = accountViewCurrencies.map((currency) => {
    const valuation = valuePositions(
      positions,
      currency,
      exchangeRates.snapshot?.rates
    )
    const hint = valuation.missingCurrencies.length
      ? `缺少 ${valuation.missingCurrencies.join('、')} 汇率`
      : ''

    return {
      currency,
      valuation,
      hint,
      hasCompleteTotal:
        valuation.isComplete && valuation.totalAnchoredMarketValue !== undefined
    }
  })

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        {summaries.map(({ currency, valuation, hint, hasCompleteTotal }) => (
          <Card key={currency} className="border-border/70 shadow-none">
            <CardContent className="min-h-[112px] p-5">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{currency} 市值</p>
                <p className="mt-2 truncate text-2xl font-semibold tracking-[-0.03em] tabular-nums">
                  {hasCompleteTotal
                    ? <MaskedAssetValue>
                        {formatMoney(valuation.totalAnchoredMarketValue!, currency)}
                      </MaskedAssetValue>
                    : '-'}
                </p>
                {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <ExchangeRateBanner exchangeRates={exchangeRates} />
    </div>
  )
}

function AssetAccountTable({
  accounts,
  holders,
  anchorCurrency,
  exchangeRates,
  onOpen
}: {
  accounts: AssetAccount[]
  holders: ProductAccount['holders']
  anchorCurrency: string
  exchangeRates: ExchangeRateView
  onOpen: (id: string) => void
}) {
  const rows = accounts
    .map((account) => {
      const marketValues = new Map<string, { value: number; hasValue: boolean }>()
      accountViewCurrencies.forEach((currency) => {
        marketValues.set(currency, { value: 0, hasValue: false })
      })
      account.positions.forEach((position) => {
        if (position.price === undefined || !marketValues.has(position.currency)) return
        const current = marketValues.get(position.currency)!
        current.value += position.quantity * position.price
        current.hasValue = true
      })
      return {
        account,
        holderName: holders.find((holder) => holder.id === account.holderId)?.name,
        marketValues,
        valuation: valuePositions(
          account.positions,
          anchorCurrency,
          exchangeRates.snapshot?.rates
        )
      }
    })
    .sort((left, right) => {
      const leftValue = left.valuation.isComplete
        ? left.valuation.totalAnchoredMarketValue
        : undefined
      const rightValue = right.valuation.isComplete
        ? right.valuation.totalAnchoredMarketValue
        : undefined
      return compareOptionalValuesDescending(leftValue, rightValue)
    })
  const hasMissingRate = rows.some(({ valuation }) => !valuation.isComplete)
  const totalAnchoredMarketValue = rows.reduce(
    (total, { valuation }) => total + (valuation.totalAnchoredMarketValue ?? 0),
    0
  )
  const canCalculatePercentage = !hasMissingRate && totalAnchoredMarketValue !== 0

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
      <Table className="table-fixed">
        <TableHeader className="bg-muted/15">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[19%]">资产账户</TableHead>
            <TableHead className="w-[13%]">持有人</TableHead>
            {accountViewCurrencies.map((currency) => (
              <TableHead key={currency} className="w-[12%] text-right">
                {currency}
              </TableHead>
            ))}
            <TableHead className="w-[20%] text-right">锚定市值</TableHead>
            <TableHead className="w-[10%] text-right">占比</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ account, holderName, marketValues, valuation }) => (
            <TableRow
              key={account.id}
              role="button"
              tabIndex={0}
              className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              onClick={() => onOpen(account.id)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                onOpen(account.id)
              }}
            >
              <TableCell className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <AccountTypeIcon type={account.type} className="size-4 shrink-0" />
                  <span className="truncate font-semibold">{account.name}</span>
                </div>
              </TableCell>
              <TableCell className="truncate text-muted-foreground">
                {holderName ?? '-'}
              </TableCell>
              {accountViewCurrencies.map((currency) => {
                const marketValue = marketValues.get(currency)!
                return (
                  <TableCell key={currency} className="text-right tabular-nums">
                    {marketValue.hasValue
                      ? <MaskedAssetValue>{formatAmount(marketValue.value)}</MaskedAssetValue>
                      : '-'}
                  </TableCell>
                )
              })}
              <TableCell className="text-right font-semibold tabular-nums">
                {valuation.isComplete && valuation.totalAnchoredMarketValue !== undefined
                  ? <MaskedAssetValue>
                      {formatMoney(valuation.totalAnchoredMarketValue, anchorCurrency)}
                    </MaskedAssetValue>
                  : '-'}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {!canCalculatePercentage || valuation.totalAnchoredMarketValue === undefined
                  ? '-'
                  : `${formatAmount(
                      valuation.totalAnchoredMarketValue / totalAnchoredMarketValue * 100
                    )}%`}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function PositionGroupOverviewTable({
  items,
  assetAccounts,
  holders,
  anchorCurrency,
  exchangeRates,
  onOpen
}: {
  items: Array<{ group: PositionGroup; positions: Position[] }>
  assetAccounts: AssetAccount[]
  holders: ProductAccount['holders']
  anchorCurrency: string
  exchangeRates: ExchangeRateView
  onOpen: (id: string) => void
}) {
  const rows = items
    .map(({ group, positions }) => {
      const positionIds = new Set(positions.map((position) => position.id))
      const holderNames = [
        ...new Set(
          assetAccounts
            .filter((account) =>
              account.positions.some((position) => positionIds.has(position.id))
            )
            .map(
              (account) =>
                holders.find((holder) => holder.id === account.holderId)?.name ?? '-'
            )
        )
      ]
      const marketValues = new Map<string, { value: number; hasValue: boolean }>()
      accountViewCurrencies.forEach((currency) => {
        marketValues.set(currency, { value: 0, hasValue: false })
      })
      positions.forEach((position) => {
        if (position.price === undefined || !marketValues.has(position.currency)) return
        const current = marketValues.get(position.currency)!
        current.value += position.quantity * position.price
        current.hasValue = true
      })
      return {
        group,
        holderLabel: holderNames.join('、'),
        marketValues,
        valuation: valuePositions(
          positions,
          anchorCurrency,
          exchangeRates.snapshot?.rates
        )
      }
    })
    .sort((left, right) => {
      const leftValue = left.valuation.isComplete
        ? left.valuation.totalAnchoredMarketValue
        : undefined
      const rightValue = right.valuation.isComplete
        ? right.valuation.totalAnchoredMarketValue
        : undefined
      return compareOptionalValuesDescending(leftValue, rightValue)
    })
  const hasMissingRate = rows.some(({ valuation }) => !valuation.isComplete)
  const totalAnchoredMarketValue = rows.reduce(
    (total, { valuation }) => total + (valuation.totalAnchoredMarketValue ?? 0),
    0
  )
  const canCalculatePercentage = !hasMissingRate && totalAnchoredMarketValue !== 0

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
      <Table className="table-fixed">
        <TableHeader className="bg-muted/15">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[19%]">持仓分组</TableHead>
            <TableHead className="w-[14%]">持有人</TableHead>
            {accountViewCurrencies.map((currency) => (
              <TableHead key={currency} className="w-[11%] text-right">
                {currency}
              </TableHead>
            ))}
            <TableHead className="w-[22%] text-right">锚定市值</TableHead>
            <TableHead className="w-[10%] text-right">占比</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ group, holderLabel, marketValues, valuation }) => (
            <TableRow
              key={group.id}
              role="button"
              tabIndex={0}
              className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              onClick={() => onOpen(group.id)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                onOpen(group.id)
              }}
            >
              <TableCell className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <Folder className="size-4 shrink-0 text-emerald-950" />
                  <span className="truncate font-semibold">{group.name}</span>
                </div>
              </TableCell>
              <TableCell className="truncate text-muted-foreground">
                {holderLabel || '-'}
              </TableCell>
              {accountViewCurrencies.map((currency) => {
                const marketValue = marketValues.get(currency)!
                return (
                  <TableCell key={currency} className="text-right tabular-nums">
                    {marketValue.hasValue
                      ? <MaskedAssetValue>{formatAmount(marketValue.value)}</MaskedAssetValue>
                      : '-'}
                  </TableCell>
                )
              })}
              <TableCell className="text-right font-semibold tabular-nums">
                {valuation.isComplete && valuation.totalAnchoredMarketValue !== undefined
                  ? <MaskedAssetValue>
                      {formatMoney(valuation.totalAnchoredMarketValue, anchorCurrency)}
                    </MaskedAssetValue>
                  : '-'}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {!canCalculatePercentage || valuation.totalAnchoredMarketValue === undefined
                  ? '-'
                  : `${formatAmount(
                      valuation.totalAnchoredMarketValue / totalAnchoredMarketValue * 100
                    )}%`}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function TimeMachine({
  account,
  snapshots,
  selectedSnapshotId,
  liveExchangeRates,
  onCreate,
  onViewLatest,
  onViewSnapshot,
  onDeleteSnapshot
}: {
  account: ProductAccount
  snapshots: PortfolioSnapshot[]
  selectedSnapshotId: string | null
  liveExchangeRates: ExchangeRateView
  onCreate: () => void
  onViewLatest: () => void
  onViewSnapshot: (snapshotId: string) => void
  onDeleteSnapshot: (snapshot: PortfolioSnapshot) => void
}) {
  const rows = [
    {
      id: 'latest',
      kind: 'latest' as const,
      account,
      createdAt: null,
      rates: liveExchangeRates.snapshot?.rates
    },
    ...snapshots.map((snapshot) => ({
      id: snapshot.id,
      kind: 'snapshot' as const,
      account: snapshot.account,
      createdAt: snapshot.createdAt,
      rates: snapshot.exchangeRates?.rates,
      snapshot
    }))
  ]

  return (
    <div className="mx-auto w-[calc(50%+36rem)] max-w-full px-4 pb-8 pt-4">
      <header className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em]">时间机器</h1>
        </div>
        <Button
          onClick={onCreate}
          disabled={selectedSnapshotId !== null}
          title={selectedSnapshotId ? '请先切换到最新版' : undefined}
        >
          <Plus className="size-4" />
          创建快照
        </Button>
      </header>

      <section className="mt-6 overflow-hidden rounded-xl border border-border/70 bg-card">
        <Table>
          <TableHeader className="bg-muted/15">
            <TableRow className="hover:bg-transparent">
              <TableHead>版本</TableHead>
              <TableHead>时间点</TableHead>
              <TableHead className="text-right">资产账户</TableHead>
              <TableHead className="text-right">持仓</TableHead>
              <TableHead className="text-right">锚定市值</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const positions = row.account.assetAccounts.flatMap(
                (assetAccount) => assetAccount.positions
              )
              const valuation = valuePositions(
                positions,
                row.account.anchorCurrency,
                row.rates
              )
              const isSelected = row.kind === 'latest'
                ? selectedSnapshotId === null
                : selectedSnapshotId === row.id
              return (
                <TableRow key={row.id} className={cn(isSelected && 'bg-emerald-900/5')}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          'grid size-8 shrink-0 place-items-center rounded-lg',
                          row.kind === 'latest'
                            ? 'bg-emerald-900/10 text-emerald-950'
                            : 'bg-amber-100 text-amber-900'
                        )}
                      >
                        {row.kind === 'latest' ? (
                          <RefreshCw className="size-4" />
                        ) : (
                          <History className="size-4" />
                        )}
                      </span>
                      <div>
                        <p className="font-medium">
                          {row.kind === 'latest'
                            ? '最新版'
                            : `版本 #${shortSnapshotHash(row.id)}`}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {row.account.name}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {row.createdAt ? formatLastSyncedAt(row.createdAt) : '实时更新'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.account.assetAccounts.length}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{positions.length}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {valuation.isComplete &&
                    valuation.totalAnchoredMarketValue !== undefined ? (
                      <MaskedAssetValue>
                        {formatMoney(
                          valuation.totalAnchoredMarketValue,
                          row.account.anchorCurrency
                        )}
                      </MaskedAssetValue>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={isSelected ? 'default' : 'secondary'}
                      className={cn(
                        !isSelected && row.kind === 'snapshot' &&
                          'bg-amber-100 text-amber-900'
                      )}
                    >
                      {isSelected
                        ? '正在查看'
                        : row.kind === 'latest'
                          ? '实时'
                          : '只读'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isSelected && row.kind === 'latest'}
                          aria-label={`${row.kind === 'latest' ? '最新版' : `版本 #${shortSnapshotHash(row.id)}`}操作`}
                        >
                          <Ellipsis className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-20">
                        <DropdownMenuItem
                          disabled={isSelected}
                          onSelect={() =>
                            row.kind === 'latest'
                              ? onViewLatest()
                              : onViewSnapshot(row.id)
                          }
                        >
                          <Eye className="size-4" />
                          {isSelected ? '当前版本' : '查看'}
                        </DropdownMenuItem>
                        {row.kind === 'snapshot' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => onDeleteSnapshot(row.snapshot)}
                            >
                              <Trash2 className="size-4" />
                              删除
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </section>

    </div>
  )
}

function Overview({
  account,
  mode,
  exchangeRates,
  imageExporting,
  onExportImage,
  onOpenAssetAccount,
  onOpenPositionGroup
}: {
  account: ProductAccount
  mode: OverviewMode
  exchangeRates: ExchangeRateView
  imageExporting: boolean
  onExportImage: () => void
  onOpenAssetAccount: (id: string) => void
  onOpenPositionGroup: (id: string) => void
}) {
  const positions = account.assetAccounts.flatMap((assetAccount) => assetAccount.positions)
  const positionsById = new Map(positions.map((position) => [position.id, position]))
  const groupItems = account.positionGroups
    .map((group) => {
      const groupPositions = group.positionIds.flatMap((positionId) => {
        const position = positionsById.get(positionId)
        return position ? [position] : []
      })
      return {
        group,
        positions: groupPositions
      }
    })
  const isAccountMode = mode === 'accounts'

  return (
    <div className="mx-auto w-[calc(50%+36rem)] max-w-full px-4 pb-8 pt-4">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-[-0.04em]">
          {isAccountMode ? '资产账户透视' : '持仓分组透视'}
        </h1>
        <Button variant="outline" onClick={onExportImage} disabled={imageExporting}>
          <Download className="size-4" />
          导出图片
        </Button>
      </header>

      <section className="mt-6">
        <ValueSummaryCard
          positions={positions}
          exchangeRates={exchangeRates}
        />
      </section>

      {positions.length > 0 && (
        <div className="mt-6">
          <CurrencySummaryTable
            positions={positions}
            anchorCurrency={account.anchorCurrency}
            exchangeRates={exchangeRates}
          />
        </div>
      )}

      <section className="mt-6">
        {isAccountMode && account.assetAccounts.length > 0 && (
          <div>
            <h2 className="mb-3 text-base font-semibold tracking-[-0.02em]">持仓分布</h2>
            <AssetAccountTable
              accounts={account.assetAccounts}
              holders={account.holders}
              anchorCurrency={account.anchorCurrency}
              exchangeRates={exchangeRates}
              onOpen={onOpenAssetAccount}
            />
          </div>
        )}
        {!isAccountMode && groupItems.length > 0 && (
          <div>
            <h2 className="mb-3 text-base font-semibold tracking-[-0.02em]">持仓分布</h2>
            <PositionGroupOverviewTable
              items={groupItems}
              assetAccounts={account.assetAccounts}
              holders={account.holders}
              anchorCurrency={account.anchorCurrency}
              exchangeRates={exchangeRates}
              onOpen={onOpenPositionGroup}
            />
          </div>
        )}
        {isAccountMode && !account.assetAccounts.length && (
          <Card className="border-dashed bg-card/45 shadow-none">
            <CardContent className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
              <span className="grid size-12 place-items-center rounded-xl bg-secondary text-muted-foreground">
                <WalletCards className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">暂无资产账户</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                支持富途牛牛、中银国际、欧易、支付宝、招商银行、中国银行和通用账户
              </p>
            </CardContent>
          </Card>
        )}
        {!isAccountMode && !groupItems.length && (
          <Card className="border-dashed bg-card/45 shadow-none">
            <CardContent className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
              <span className="grid size-12 place-items-center rounded-xl bg-secondary text-muted-foreground">
                <Folder className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">暂无持仓分组</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                将不同资产账户中的持仓归入持仓分组后，在这里查看币种和锚定市值
              </p>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}

function CurrencySummaryTable({
  positions,
  anchorCurrency,
  exchangeRates
}: {
  positions: Position[]
  anchorCurrency: string
  exchangeRates: ExchangeRateView
}) {
  const summaries = new Map<
    string,
    {
      currency: string
      positionCount: number
      value: number
      hasValue: boolean
    }
  >()
  positions.forEach((position) => {
    const current = summaries.get(position.currency) ?? {
      currency: position.currency,
      positionCount: 0,
      value: 0,
      hasValue: false
    }
    current.positionCount += 1
    if (position.price !== undefined) {
      current.value += position.quantity * position.price
      current.hasValue = true
    }
    summaries.set(position.currency, current)
  })
  const summaryRows = [...summaries.values()]
    .map((summary) => ({
      ...summary,
      anchoredMarketValue: summary.hasValue
        ? convertToAnchorCurrency(
            summary.value,
            summary.currency,
            anchorCurrency,
            exchangeRates.snapshot?.rates
          )
        : undefined
    }))
    .sort((left, right) =>
      compareOptionalValuesDescending(left.anchoredMarketValue, right.anchoredMarketValue)
    )
  const hasMissingRate = summaryRows.some(
    (summary) => summary.hasValue && summary.anchoredMarketValue === undefined
  )
  const totalAnchoredMarketValue = summaryRows.reduce(
    (total, summary) => total + (summary.anchoredMarketValue ?? 0),
    0
  )
  const canCalculatePercentage = !hasMissingRate && totalAnchoredMarketValue !== 0

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold tracking-[-0.02em]">币种分布</h2>
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
        <Table>
          <TableHeader className="bg-muted/15">
            <TableRow className="hover:bg-transparent">
              <TableHead>币种</TableHead>
              <TableHead className="text-right">持仓</TableHead>
              <TableHead className="text-right">市值</TableHead>
              <TableHead className="text-right">锚定市值</TableHead>
              <TableHead className="text-right">占比</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summaries.size ? (
              summaryRows.map((summary) => {
                return (
                  <TableRow key={summary.currency}>
                    <TableCell className="font-semibold">{summary.currency}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {summary.positionCount}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {summary.hasValue
                        ? <MaskedAssetValue>
                            {formatMoney(summary.value, summary.currency)}
                          </MaskedAssetValue>
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {summary.anchoredMarketValue === undefined
                        ? '-'
                        : <MaskedAssetValue>
                            {formatMoney(summary.anchoredMarketValue, anchorCurrency)}
                          </MaskedAssetValue>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {!canCalculatePercentage || summary.anchoredMarketValue === undefined
                        ? '-'
                        : `${formatAmount(
                            summary.anchoredMarketValue / totalAnchoredMarketValue * 100
                          )}%`}
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  暂无币种
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

function PositionTable({
  positions,
  readOnly,
  anchorCurrency,
  exchangeRates,
  onEditPosition,
  onDeletePosition
}: {
  positions: Position[]
  readOnly: boolean
  anchorCurrency: string
  exchangeRates: ExchangeRateView
  onEditPosition: (position: Position) => void
  onDeletePosition: (position: Position) => void
}) {
  const valuation = valuePositions(
    positions,
    anchorCurrency,
    exchangeRates.snapshot?.rates
  )
  const canCalculatePercentage =
    valuation.isComplete &&
    valuation.totalAnchoredMarketValue !== undefined &&
    valuation.totalAnchoredMarketValue !== 0
  const sortedPositions = [...positions].sort((left, right) =>
    compareOptionalValuesDescending(
      valuation.byPositionId.get(left.id)?.anchoredMarketValue,
      valuation.byPositionId.get(right.id)?.anchoredMarketValue
    )
  )

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold tracking-[-0.02em]">持仓分布</h2>
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
        <Table className="table-fixed">
          <TableHeader className="bg-muted/15">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[25%]">名称代码</TableHead>
              <TableHead className="w-[12%] text-right">数量</TableHead>
              <TableHead className="w-[14%] text-right">当前价格</TableHead>
              <TableHead className="w-[19%] text-right">市值</TableHead>
              <TableHead className="w-[19%] text-right">锚定市值</TableHead>
              <TableHead className="w-[7%] text-right">占比</TableHead>
              {!readOnly && <TableHead className="w-16" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.length ? (
              sortedPositions.map((position) => {
                const positionValuation = valuation.byPositionId.get(position.id)
                return (
                  <TableRow key={position.id}>
                    <TableCell className="min-w-0">
                      <p className="truncate font-semibold">
                        {marketMeta[position.market].shortLabel}.{position.symbol}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{position.name}</p>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      <MaskedAssetValue>{formatNumber(position.quantity)}</MaskedAssetValue>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {position.price === undefined
                        ? '-'
                        : <MaskedAssetValue>{formatAmount(position.price)}</MaskedAssetValue>}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {positionValuation?.marketValue === undefined
                        ? '-'
                        : <MaskedAssetValue>
                            {formatMoney(positionValuation.marketValue, position.currency)}
                          </MaskedAssetValue>}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {positionValuation?.anchoredMarketValue === undefined
                        ? '-'
                        : <MaskedAssetValue>
                            {formatMoney(positionValuation.anchoredMarketValue, anchorCurrency)}
                          </MaskedAssetValue>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {!canCalculatePercentage ||
                      positionValuation?.anchoredMarketValue === undefined
                        ? '-'
                        : `${formatAmount(
                            positionValuation.anchoredMarketValue /
                              valuation.totalAnchoredMarketValue! *
                              100
                          )}%`}
                    </TableCell>
                    {!readOnly && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`${position.symbol} 操作`}
                            >
                              <Ellipsis className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-20">
                            <DropdownMenuItem onSelect={() => onEditPosition(position)}>
                              <Pencil className="size-4" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => onDeletePosition(position)}
                            >
                              <Trash2 className="size-4" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={readOnly ? 6 : 7}
                  className="h-32 text-center text-muted-foreground"
                >
                  暂无持仓
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

function AssetAccountDetail({
  account,
  holderName,
  readOnly,
  anchorCurrency,
  exchangeRates,
  imageExporting,
  onExportImage,
  onAddPosition,
  onSync,
  syncState,
  onEditPosition,
  onDeletePosition
}: {
  account: AssetAccount
  holderName?: string
  readOnly: boolean
  anchorCurrency: string
  exchangeRates: ExchangeRateView
  imageExporting: boolean
  onExportImage: () => void
  onAddPosition: () => void
  onSync: () => void
  syncState?: AccountSyncState
  onEditPosition: (position: Position) => void
  onDeletePosition: (position: Position) => void
}) {
  return (
    <div className="mx-auto w-[calc(50%+36rem)] max-w-full px-4 pb-8 pt-4">
      <header className="flex items-center justify-between gap-6">
        <div className="flex min-w-0 items-center gap-4">
          <span
            className="grid size-12 shrink-0 place-items-center"
          >
            <AccountTypeIcon
              type={account.type}
              className={account.type === 'Futu' ? 'size-12' : 'size-11'}
            />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-semibold tracking-[-0.04em]">
              {account.name}
            </h1>
            <dl className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
              <div className="flex min-w-0 items-center gap-1.5">
                <UsersRound
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
                <dt className="shrink-0 text-muted-foreground">持有人</dt>
                <dd className="ml-0.5 truncate font-medium text-foreground">
                  {holderName ?? '-'}
                </dd>
              </div>
              <div className="flex items-center gap-1.5">
                <Wrench
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
                <dt className="shrink-0 text-muted-foreground">维护模式</dt>
                <dd className="ml-0.5 font-medium text-foreground">
                  {account.sync ? '自动' : '手动'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && account.sync && (
            <>
              <span className="mr-1 text-xs tabular-nums text-muted-foreground">
                {account.sync.lastSyncedAt
                  ? `最近同步 ${formatLastSyncedAt(account.sync.lastSyncedAt)}`
                  : '尚未同步'}
              </span>
              <Button
                variant="outline"
                onClick={onSync}
                disabled={syncState?.status === 'syncing'}
              >
                <RefreshCw
                  className={cn('size-4', syncState?.status === 'syncing' && 'animate-spin')}
                />
                同步
              </Button>
            </>
          )}
          {!readOnly && !account.sync && (
            <Button onClick={onAddPosition}>
              <Plus className="size-4" />
              添加持仓
            </Button>
          )}
          <Button variant="outline" onClick={onExportImage} disabled={imageExporting}>
            <Download className="size-4" />
            导出图片
          </Button>
        </div>
      </header>

      <div className="mt-6 grid gap-6">
        <ValueSummaryCard
          positions={account.positions}
          exchangeRates={exchangeRates}
        />
        {account.positions.length ? (
          <>
            <CurrencySummaryTable
              positions={account.positions}
              anchorCurrency={anchorCurrency}
              exchangeRates={exchangeRates}
            />
            <PositionTable
              positions={account.positions}
              readOnly={readOnly || Boolean(account.sync)}
              anchorCurrency={anchorCurrency}
              exchangeRates={exchangeRates}
              onEditPosition={onEditPosition}
              onDeletePosition={onDeletePosition}
            />
          </>
        ) : (
          <Card className="border-dashed bg-card/45 shadow-none">
            <CardContent className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
              <span className="grid size-12 place-items-center rounded-xl bg-secondary text-muted-foreground">
                <WalletCards className="size-5" />
              </span>
              <h2 className="mt-4 font-semibold">
                {account.sync ? '同步资产账户' : '为资产账户添加持仓'}
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                {account.sync
                  ? '同步后，可以查看币种、市值和持仓分布'
                  : '添加持仓后，可以查看币种、市值和持仓分布'}
              </p>
              {!readOnly && (
                <Button
                  className="mt-5"
                  variant={account.sync ? 'outline' : 'default'}
                  onClick={account.sync ? onSync : onAddPosition}
                  disabled={syncState?.status === 'syncing'}
                >
                  {account.sync ? (
                    <RefreshCw
                      className={cn(
                        'size-4',
                        syncState?.status === 'syncing' && 'animate-spin'
                      )}
                    />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  {account.sync ? '同步' : '添加持仓'}
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

type GroupPositionItem = {
  positionId: string
  account: AssetAccount
  position: Position
}

function GroupPositionTable({
  items,
  holders,
  readOnly,
  anchorCurrency,
  exchangeRates,
  onRemove
}: {
  items: GroupPositionItem[]
  holders: ProductAccount['holders']
  readOnly: boolean
  anchorCurrency: string
  exchangeRates: ExchangeRateView
  onRemove: (positionId: string) => void
}) {
  const positions = items.map((item) => item.position)
  const valuation = valuePositions(
    positions,
    anchorCurrency,
    exchangeRates.snapshot?.rates
  )
  const canCalculatePercentage =
    valuation.isComplete &&
    valuation.totalAnchoredMarketValue !== undefined &&
    valuation.totalAnchoredMarketValue !== 0
  const sortedItems = [...items].sort((left, right) =>
    compareOptionalValuesDescending(
      valuation.byPositionId.get(left.position.id)?.anchoredMarketValue,
      valuation.byPositionId.get(right.position.id)?.anchoredMarketValue
    )
  )

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold tracking-[-0.02em]">持仓分布</h2>
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
        <Table className="table-fixed">
          <TableHeader className="bg-muted/15">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[13%]">资产账户</TableHead>
              <TableHead className="w-[10%]">持有人</TableHead>
              <TableHead className="w-[18%]">名称代码</TableHead>
              <TableHead className="w-[8%] text-right">数量</TableHead>
              <TableHead className="w-[11%] text-right">当前价格</TableHead>
              <TableHead className="w-[15%] text-right">市值</TableHead>
              <TableHead className="w-[15%] text-right">锚定市值</TableHead>
              <TableHead className="w-[6%] text-right">占比</TableHead>
              {!readOnly && <TableHead className="w-16" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length ? (
              sortedItems.map(({ positionId, account, position }) => {
                const positionValuation = valuation.byPositionId.get(position.id)
                return (
                  <TableRow key={positionId}>
                    <TableCell className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <AccountTypeIcon type={account.type} className="size-4" />
                        <span className="min-w-0 flex-1 truncate text-sm">{account.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground">
                      {holders.find((holder) => holder.id === account.holderId)?.name ?? '-'}
                    </TableCell>
                    <TableCell className="min-w-0">
                      <p className="truncate font-semibold">
                        {marketMeta[position.market].shortLabel}.{position.symbol}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{position.name}</p>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      <MaskedAssetValue>{formatNumber(position.quantity)}</MaskedAssetValue>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {position.price === undefined
                        ? '-'
                        : <MaskedAssetValue>{formatAmount(position.price)}</MaskedAssetValue>}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {positionValuation?.marketValue === undefined
                        ? '-'
                        : <MaskedAssetValue>
                            {formatMoney(positionValuation.marketValue, position.currency)}
                          </MaskedAssetValue>}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {positionValuation?.anchoredMarketValue === undefined
                        ? '-'
                        : <MaskedAssetValue>
                            {formatMoney(positionValuation.anchoredMarketValue, anchorCurrency)}
                          </MaskedAssetValue>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {!canCalculatePercentage ||
                      positionValuation?.anchoredMarketValue === undefined
                        ? '-'
                        : `${formatAmount(
                            positionValuation.anchoredMarketValue /
                              valuation.totalAnchoredMarketValue! *
                              100
                          )}%`}
                    </TableCell>
                    {!readOnly && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`将 ${position.symbol} 移出持仓分组`}
                          onClick={() => onRemove(positionId)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={readOnly ? 8 : 9} className="h-32 text-center text-muted-foreground">
                  暂无持仓
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

function PositionGroupDetail({
  group,
  assetAccounts,
  holders,
  readOnly,
  anchorCurrency,
  exchangeRates,
  imageExporting,
  onExportImage,
  onManagePositions,
  onRemovePosition
}: {
  group: PositionGroup
  assetAccounts: AssetAccount[]
  holders: ProductAccount['holders']
  readOnly: boolean
  anchorCurrency: string
  exchangeRates: ExchangeRateView
  imageExporting: boolean
  onExportImage: () => void
  onManagePositions: () => void
  onRemovePosition: (positionId: string) => void
}) {
  const items = group.positionIds.flatMap((positionId) => {
    const account = assetAccounts.find((item) =>
      item.positions.some((position) => position.id === positionId)
    )
    const position = account?.positions.find((item) => item.id === positionId)
    return account && position ? [{ positionId, account, position }] : []
  })

  return (
    <div className="mx-auto w-[calc(50%+36rem)] max-w-full px-4 pb-8 pt-4">
      <header className="flex items-center justify-between gap-6">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-emerald-900/10 text-emerald-950">
            <Folder className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-semibold tracking-[-0.04em]">{group.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <Button onClick={onManagePositions}>
              <ListPlus className="size-4" />
              管理持仓
            </Button>
          )}
          <Button variant="outline" onClick={onExportImage} disabled={imageExporting}>
            <Download className="size-4" />
            导出图片
          </Button>
        </div>
      </header>

      <div className="mt-6">
        <ValueSummaryCard
          positions={items.map((item) => item.position)}
          exchangeRates={exchangeRates}
        />
      </div>

      {items.length ? (
        <div className="mt-6 grid gap-6">
          <CurrencySummaryTable
            positions={items.map((item) => item.position)}
            anchorCurrency={anchorCurrency}
            exchangeRates={exchangeRates}
          />
          <GroupPositionTable
            items={items}
            holders={holders}
            readOnly={readOnly}
            anchorCurrency={anchorCurrency}
            exchangeRates={exchangeRates}
            onRemove={onRemovePosition}
          />
        </div>
      ) : (
        <Card className="mt-6 border-dashed bg-card/45 shadow-none">
          <CardContent className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
            <span className="grid size-12 place-items-center rounded-xl bg-secondary text-muted-foreground">
              <Folder className="size-5" />
            </span>
            <h2 className="mt-4 font-semibold">为持仓分组添加持仓</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              可混合选择不同资产账户中的持仓，数据会跟随原账户更新
            </p>
            {!readOnly && (
              <Button className="mt-5" onClick={onManagePositions}>
                <ListPlus className="size-4" />
                选择持仓
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function AssetAccountNavigation({
  accounts,
  holders,
  readOnly,
  selectedAccountId,
  onSelect,
  onEdit,
  onDelete
}: {
  accounts: AssetAccount[]
  holders: ProductAccount['holders']
  readOnly: boolean
  selectedAccountId: string | null
  onSelect: (account: AssetAccount) => void
  onEdit: (account: AssetAccount) => void
  onDelete: (account: AssetAccount) => void
}) {
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(
    () => new Set()
  )
  const holderIds = new Set(holders.map((holder) => holder.id))
  const groups = [
    ...holders.map((holder) => ({
      id: holder.id,
      label: holder.name,
      accessibilityLabel: holder.name,
      accounts: accounts.filter((account) => account.holderId === holder.id)
    })),
    {
      id: 'unassigned',
      label: '-',
      accessibilityLabel: '未指定持有人',
      accounts: accounts.filter(
        (account) => !account.holderId || !holderIds.has(account.holderId)
      )
    }
  ].filter((group) => group.accounts.length > 0)

  function toggleGroup(groupId: string): void {
    setCollapsedGroupIds((current) => {
      const next = new Set(current)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  return (
    <div className="grid gap-3">
      {groups.map((group) => {
        const collapsed = collapsedGroupIds.has(group.id)
        return (
          <div key={group.id}>
            <button
              type="button"
              className="flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
              aria-expanded={!collapsed}
              aria-label={`${collapsed ? '展开' : '收起'}${group.accessibilityLabel}分组`}
              onClick={() => toggleGroup(group.id)}
            >
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  'size-3.5 shrink-0 transition-transform',
                  collapsed && '-rotate-90'
                )}
              />
              <UsersRound aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{group.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground/75">
                {group.accounts.length}
              </span>
            </button>

            {!collapsed && (
              <div className="mt-1 grid gap-1 pl-3">
                {group.accounts.map((account) => {
                  const selected = selectedAccountId === account.id
                  return (
                    <div
                      key={account.id}
                      className={cn(
                        'group flex items-center rounded-lg pr-1 transition-colors hover:bg-muted/70',
                        selected && 'bg-emerald-900/9 text-emerald-950'
                      )}
                    >
                      <Button
                        variant="ghost"
                        className={cn(
                          'h-auto min-w-0 flex-1 justify-start gap-3 px-3 py-2.5 font-normal hover:bg-transparent',
                          selected && 'font-medium'
                        )}
                        onClick={() => onSelect(account)}
                      >
                        <AccountTypeIcon
                          type={account.type}
                          className="size-4 shrink-0"
                        />
                        <span className="min-w-0 flex-1 truncate text-left">
                          {account.name}
                        </span>
                      </Button>
                      {!readOnly && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                'size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100',
                                selected && 'opacity-100'
                              )}
                              aria-label={`${account.name}操作`}
                            >
                              <Ellipsis className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-20">
                            <DropdownMenuItem onSelect={() => onEdit(account)}>
                              <Pencil className="size-4" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => onDelete(account)}
                            >
                              <Trash2 className="size-4" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function App(): React.JSX.Element {
  const portfolio = usePortfolio()
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null)
  const selectedSnapshot =
    portfolio.activeSnapshots.find((snapshot) => snapshot.id === selectedSnapshotId) ?? null
  const latestProductAccount = portfolio.activeProductAccount
  const liveExchangeRates = useExchangeRates(
    latestProductAccount?.exchangeRateProvider,
    latestProductAccount?.exchangeRateRefreshIntervalMinutes,
    Boolean(latestProductAccount) && !selectedSnapshot
  )
  const shownExchangeRateError = useRef('')
  async function refreshLiveExchangeRates(): Promise<void> {
    shownExchangeRateError.current = ''
    await liveExchangeRates.refresh()
  }
  const liveExchangeRateView: ExchangeRateState = {
    ...liveExchangeRates,
    refresh: refreshLiveExchangeRates
  }
  const exchangeRates: ExchangeRateView = selectedSnapshot
    ? {
        snapshot: selectedSnapshot.exchangeRates ?? null,
        status: selectedSnapshot.exchangeRates ? 'ready' : 'error',
        error: selectedSnapshot.exchangeRates ? '' : '快照中没有汇率数据'
      }
    : liveExchangeRateView
  const [selectedAssetAccountId, setSelectedAssetAccountId] = useState<string | null>(null)
  const [selectedPositionGroupId, setSelectedPositionGroupId] = useState<string | null>(null)
  const [overviewMode, setOverviewMode] = useState<OverviewMode>('accounts')
  const [showTimeMachine, setShowTimeMachine] = useState(false)
  const [productDialog, setProductDialog] = useState<ProductDialogState>({ open: false })
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false)
  const [accountSettingsSection, setAccountSettingsSection] = useState<
    'basic' | 'currency' | 'holders' | 'other'
  >('basic')
  const [assetDialog, setAssetDialog] = useState<AssetDialogState>({ open: false })
  const [positionDialog, setPositionDialog] = useState<PositionDialogState>({ open: false })
  const [positionGroupDialog, setPositionGroupDialog] = useState<PositionGroupDialogState>({
    open: false
  })
  const [groupPositionsDialogOpen, setGroupPositionsDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)
  const [syncStates, setSyncStates] = useState<Record<string, AccountSyncState>>({})
  const [syncErrorDialog, setSyncErrorDialog] = useState<SyncErrorDialogState>(null)
  const [exchangeRateErrorDialog, setExchangeRateErrorDialog] = useState('')
  const [pendingImport, setPendingImport] = useState<PendingImport>(null)
  const [backupError, setBackupError] = useState('')
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [imageExporting, setImageExporting] = useState(false)
  const [assetValuesMasked, setAssetValuesMasked] = useState(loadAssetValueMask)
  const syncingAccountIds = useRef(new Set<string>())
  const shownSyncErrors = useRef(new Map<string, string>())

  function reportPortfolioError(error: unknown): void {
    const rawMessage = error instanceof Error ? error.message : String(error)
    setBackupError(rawMessage.replace(/^Error invoking remote method '[^']+': Error: /, ''))
  }

  const activeProductAccount = selectedSnapshot?.account ?? latestProductAccount
  const selectedAssetAccount =
    activeProductAccount?.assetAccounts.find(
      (account) => account.id === selectedAssetAccountId
    ) ?? null
  const selectedPositionGroup =
    activeProductAccount?.positionGroups.find(
      (group) => group.id === selectedPositionGroupId
    ) ?? null

  useEffect(() => {
    setSelectedSnapshotId(null)
    setSelectedAssetAccountId(null)
    setSelectedPositionGroupId(null)
    setExchangeRateErrorDialog('')
    shownExchangeRateError.current = ''
  }, [latestProductAccount?.id])

  useEffect(() => {
    if (!latestProductAccount || selectedSnapshot) {
      setExchangeRateErrorDialog('')
      return
    }
    if (liveExchangeRates.status === 'ready') {
      shownExchangeRateError.current = ''
      return
    }
    if (
      liveExchangeRates.status === 'error' &&
      liveExchangeRates.error &&
      shownExchangeRateError.current !== liveExchangeRates.error
    ) {
      shownExchangeRateError.current = liveExchangeRates.error
      setExchangeRateErrorDialog(liveExchangeRates.error)
    }
  }, [
    latestProductAccount,
    liveExchangeRates.error,
    liveExchangeRates.status,
    selectedSnapshot
  ])

  async function syncAssetAccount(
    assetAccountId: string,
    notifyRepeatedError = false
  ): Promise<void> {
    if (
      !latestProductAccount ||
      selectedSnapshot ||
      syncingAccountIds.current.has(assetAccountId)
    ) return
    const assetAccount = latestProductAccount.assetAccounts.find(
      (account) => account.id === assetAccountId
    )
    if (!assetAccount?.sync) return

    syncingAccountIds.current.add(assetAccountId)
    setSyncStates((current) => ({
      ...current,
      [assetAccountId]: {
        status: 'syncing',
        message:
          assetAccount.type === 'Futu'
            ? '正在连接 Futu OpenD…'
            : assetAccount.type === 'Ibkr'
              ? '正在连接 IBKR Gateway…'
              : assetAccount.type === 'Binance'
                ? '正在同步币安…'
                : '正在同步 OKX…'
      }
    }))
    try {
      const result = await portfolio.syncAssetAccount(
        latestProductAccount.id,
        assetAccountId
      )
      setSyncStates((current) => ({
        ...current,
        [assetAccountId]: {
          status: 'success',
          message: `已同步 ${result.positionCount} 项持仓`
        }
      }))
      shownSyncErrors.current.delete(assetAccountId)
      setSyncErrorDialog((current) =>
        current?.accountId === assetAccountId ? null : current
      )
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error)
      const message = rawMessage.replace(/^Error invoking remote method '[^']+': Error: /, '')
      setSyncStates((current) => ({
        ...current,
        [assetAccountId]: { status: 'error', message }
      }))
      if (notifyRepeatedError || shownSyncErrors.current.get(assetAccountId) !== message) {
        setSyncErrorDialog({
          accountId: assetAccountId,
          accountName: assetAccount.name,
          message
        })
      }
      shownSyncErrors.current.set(assetAccountId, message)
    } finally {
      syncingAccountIds.current.delete(assetAccountId)
    }
  }

  const autoSyncAccounts =
    selectedSnapshot
      ? []
      : latestProductAccount?.assetAccounts.flatMap((account) =>
          account.sync
            ? [
                {
                  id: account.id,
                  type: account.type,
                  interval: accountSyncInterval(account)
                }
              ]
            : []
        ) ?? []
  const autoSyncKey = JSON.stringify(autoSyncAccounts)

  useEffect(() => {
    if (!autoSyncAccounts.length) return
    const timers = autoSyncAccounts.map((account) => {
      void syncAssetAccount(account.id)
      return window.setInterval(
        () => void syncAssetAccount(account.id),
        account.interval * 1000
      )
    })
    return () => timers.forEach((timer) => window.clearInterval(timer))
    // Restart timers when an auto-sync account or its connection settings change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestProductAccount?.id, selectedSnapshotId, autoSyncKey])

  async function exportAccount(): Promise<void> {
    try {
      if (!window.desktop.backup?.exportData) {
        throw new Error('数据组件尚未加载，请重启 Chromie')
      }
      await window.desktop.backup.exportData(await portfolio.exportAccount())
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error)
      setBackupError(rawMessage.replace(/^Error invoking remote method '[^']+': Error: /, ''))
    }
  }

  async function exportImage(scope: ShareImageScope): Promise<void> {
    if (imageExporting) return
    try {
      setImageExporting(true)
      if (!activeProductAccount) throw new Error('没有找到可导出的账户')
      if (!window.desktop.shareImage?.save) {
        throw new Error('图片导出组件尚未加载，请重启 Chromie')
      }
      const dataUrl = await createShareImageDataUrl({
        account: activeProductAccount,
        scope,
        exchangeRates,
        masked: assetValuesMasked,
        snapshotAt: selectedSnapshot?.createdAt
      })
      const exportName = scope.kind === 'asset-account'
        ? scope.account.name
        : scope.kind === 'position-group'
          ? scope.group.name
          : activeProductAccount.name
      await window.desktop.shareImage.save(dataUrl, exportName)
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error)
      setBackupError(rawMessage.replace(/^Error invoking remote method '[^']+': Error: /, ''))
    } finally {
      setImageExporting(false)
    }
  }

  async function chooseImportAccount(): Promise<void> {
    try {
      if (!window.desktop.backup?.importData) {
        throw new Error('数据组件尚未加载，请重启 Chromie')
      }
      const result = await window.desktop.backup.importData()
      if (result.canceled || !result.content) return
      const backup = await portfolio.inspectBackup(result.content)
      if (!backup) {
        setBackupError('备份文件无效或版本不受支持')
        return
      }
      const { account, snapshots } = backup
      setPendingImport({
        account,
        snapshots,
        assetAccountCount: account.assetAccounts.length,
        groupCount: account.positionGroups.length,
        positionCount: account.assetAccounts.reduce(
          (total, assetAccount) => total + assetAccount.positions.length,
          0
        ),
        snapshotCount: snapshots.length
      })
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error)
      setBackupError(rawMessage.replace(/^Error invoking remote method '[^']+': Error: /, ''))
    }
  }

  async function confirmImportAccount(): Promise<void> {
    if (!pendingImport) return
    try {
      setSelectedAssetAccountId(null)
      setSelectedPositionGroupId(null)
      await portfolio.importAccount(pendingImport.account, pendingImport.snapshots)
      setPendingImport(null)
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error)
      setBackupError(rawMessage.replace(/^Error invoking remote method '[^']+': Error: /, ''))
    }
  }

  if (portfolio.loading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        正在加载资产数据…
      </div>
    )
  }

  if (portfolio.error) {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center text-sm text-destructive">
        {portfolio.error}
      </div>
    )
  }

  if (!activeProductAccount) {
    return (
      <>
        <EmptyProductAccount
          onCreate={() => setProductDialog({ open: true })}
          onImport={() => void chooseImportAccount()}
        />
        <ProductAccountDialog
          open={productDialog.open}
          onOpenChange={(open) => setProductDialog({ open })}
          onSubmit={(input) => portfolio.createProductAccount(input).then(() => undefined)}
        />
        <ImportBackupDialog
          open={pendingImport !== null}
          onOpenChange={(open) => {
            if (!open) setPendingImport(null)
          }}
          accountName={pendingImport?.account.name ?? ''}
          assetAccountCount={pendingImport?.assetAccountCount ?? 0}
          groupCount={pendingImport?.groupCount ?? 0}
          positionCount={pendingImport?.positionCount ?? 0}
          snapshotCount={pendingImport?.snapshotCount ?? 0}
          onConfirm={confirmImportAccount}
        />
        <BackupErrorDialog
          open={Boolean(backupError)}
          onOpenChange={(open) => {
            if (!open) setBackupError('')
          }}
          message={backupError}
        />
      </>
    )
  }

  async function submitProductAccount(input: ProductAccountInput): Promise<void> {
    await portfolio.createProductAccount(input)
  }

  async function createCurrentSnapshot(): Promise<void> {
    if (!latestProductAccount || selectedSnapshot) return
    try {
      await portfolio.createSnapshot(latestProductAccount.id, liveExchangeRates.snapshot)
    } catch (error) {
      reportPortfolioError(error)
    }
  }

  async function submitProductAccountSettings(
    input: ProductAccountSettingsInput
  ): Promise<void> {
    if (!activeProductAccount) return
    await portfolio.updateProductAccount(activeProductAccount.id, input)
  }

  async function submitAssetAccount(input: AssetAccountInput): Promise<void> {
    if (!activeProductAccount) return
    if (assetDialog.account) {
      await portfolio.updateAssetAccount(activeProductAccount.id, assetDialog.account.id, input)
      return
    }
    const id = await portfolio.createAssetAccount(activeProductAccount.id, input)
    setSelectedPositionGroupId(null)
    setSelectedAssetAccountId(id)
  }

  async function submitPositionGroup(input: PositionGroupInput): Promise<void> {
    if (!activeProductAccount) return
    if (positionGroupDialog.group) {
      await portfolio.updatePositionGroup(
        activeProductAccount.id,
        positionGroupDialog.group.id,
        input
      )
      return
    }
    const id = await portfolio.createPositionGroup(activeProductAccount.id, input)
    setSelectedAssetAccountId(null)
    setSelectedPositionGroupId(id)
  }

  function submitGroupPositions(positionIds: string[]): Promise<string | null> {
    if (!activeProductAccount || !selectedPositionGroup) {
      return Promise.resolve('没有找到对应的持仓分组')
    }
    return portfolio.setPositionGroupPositions(
      activeProductAccount.id,
      selectedPositionGroup.id,
      positionIds
    )
  }

  function submitPosition(input: PositionInput): Promise<string | null> {
    if (!activeProductAccount || !positionDialog.accountId) {
      return Promise.resolve('没有找到对应的资产账户')
    }
    return portfolio.savePosition(
      activeProductAccount.id,
      positionDialog.accountId,
      input,
      positionDialog.position?.id
    )
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget) return
    try {
      if (deleteTarget.kind === 'snapshot') {
        await portfolio.deleteSnapshot(deleteTarget.snapshot.id)
        if (deleteTarget.snapshot.id === selectedSnapshotId) {
          setSelectedSnapshotId(null)
        }
      } else if (!latestProductAccount) {
        return
      } else if (deleteTarget.kind === 'product') {
        await portfolio.deleteProductAccount(deleteTarget.account.id)
      } else if (deleteTarget.kind === 'asset') {
        await portfolio.deleteAssetAccount(latestProductAccount.id, deleteTarget.account.id)
        setSelectedAssetAccountId(null)
      } else if (deleteTarget.kind === 'group') {
        await portfolio.deletePositionGroup(latestProductAccount.id, deleteTarget.group.id)
        setSelectedPositionGroupId(null)
      } else {
        await portfolio.deletePosition(
          latestProductAccount.id,
          deleteTarget.account.id,
          deleteTarget.position.id
        )
      }
      setDeleteTarget(null)
    } catch (error) {
      reportPortfolioError(error)
    }
  }

  function toggleAssetValueMask(): void {
    setAssetValuesMasked((current) => {
      const next = !current
      try {
        window.localStorage.setItem(ASSET_VALUE_MASK_STORAGE_KEY, String(next))
      } catch {
        // The privacy toggle still works for the current session if storage is unavailable.
      }
      return next
    })
  }

  const deleteDialogCopy = (() => {
    if (!deleteTarget) return { title: '', description: '' }
    if (deleteTarget.kind === 'snapshot') {
      return {
        title: `删除版本 #${shortSnapshotHash(deleteTarget.snapshot.id)}？`,
        description: '只会删除这个历史版本，最新版资产不会受到影响。此操作无法撤销'
      }
    }
    if (deleteTarget.kind === 'product') {
      return {
        title: `注销账户“${deleteTarget.account.name}”？`,
        description: `将同时删除 ${deleteTarget.account.holders.length} 个持有人、${deleteTarget.account.assetAccounts.length} 个资产账户、${deleteTarget.account.positionGroups.length} 个持仓分组和全部持仓。此操作无法撤销`
      }
    }
    if (deleteTarget.kind === 'asset') {
      return {
        title: `删除“${deleteTarget.account.name}”？`,
        description: `将同时删除 ${deleteTarget.account.positions.length} 项持仓。此操作无法撤销`
      }
    }
    if (deleteTarget.kind === 'group') {
      return {
        title: `删除持仓分组“${deleteTarget.group.name}”？`,
        description: '只会删除持仓分组，不会影响原资产账户及其中的持仓。此操作无法撤销'
      }
    }
    return {
      title: `删除 ${deleteTarget.position.symbol}？`,
      description: `将从“${deleteTarget.account.name}”移除。此操作无法撤销`
    }
  })()

  return (
    <div className="flex h-screen min-h-[600px] overflow-hidden bg-background">
      <div className="window-drag fixed inset-x-0 top-0 z-40 h-12" />
      <aside className="flex w-64 shrink-0 flex-col border-r bg-stone-100/65 pt-12">
        <div className="px-4 pb-4 pt-2">
          <div className="mb-5 flex items-center gap-2 px-2">
            <span className="grid size-8 place-items-center rounded-xl bg-emerald-950 text-white">
              <Layers3 className="size-4" />
            </span>
            <span className="text-[15px] font-semibold tracking-[-0.02em]">Chromie</span>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto size-8"
              aria-label={assetValuesMasked ? '显示资产数据' : '遮蔽资产数据'}
              aria-pressed={assetValuesMasked}
              title={assetValuesMasked ? '显示资产数据' : '遮蔽资产数据'}
              onClick={toggleAssetValueMask}
            >
              {assetValuesMasked ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-auto w-full justify-start gap-3 bg-white/70 px-3 py-2.5 shadow-none"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-900/10 text-sm font-semibold text-emerald-950">
                  {activeProductAccount.name.trim().slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">
                  {activeProductAccount.name}
                </span>
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              <DropdownMenuLabel>切换账户</DropdownMenuLabel>
              {portfolio.productAccounts.map((account) => (
                <DropdownMenuItem
                  key={account.id}
                  onSelect={() => {
                    setSelectedSnapshotId(null)
                    void portfolio
                      .setActiveProductAccount(account.id)
                      .catch(reportPortfolioError)
                  }}
                >
                  <span className="grid size-7 place-items-center rounded-md bg-secondary text-xs font-semibold">
                    {account.name.trim().slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{account.name}</span>
                  {account.id === activeProductAccount.id && <Check className="size-4" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {!selectedSnapshot && (
                <DropdownMenuItem
                  onSelect={() => {
                    setAccountSettingsSection('basic')
                    setAccountSettingsOpen(true)
                  }}
                >
                  <Pencil className="size-4" />
                  账户设置
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => setExportDialogOpen(true)}>
                <Upload className="size-4" />
                导出账户
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void chooseImportAccount()}>
                <Download className="size-4" />
                导入账户
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setProductDialog({ open: true })}>
                <Plus className="size-4" />
                新建账户
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

        </div>

        <Separator />

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-5 grid gap-1">
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-start px-3 font-normal',
                !selectedAssetAccountId &&
                  !selectedPositionGroupId &&
                  !showTimeMachine &&
                  overviewMode === 'accounts' &&
                  'bg-emerald-900/9 font-medium text-emerald-950'
              )}
              onClick={() => {
                setOverviewMode('accounts')
                setShowTimeMachine(false)
                setSelectedAssetAccountId(null)
                setSelectedPositionGroupId(null)
              }}
            >
              <ChartSpline className="size-4" />
              资产账户透视
            </Button>
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-start px-3 font-normal',
                !selectedAssetAccountId &&
                  !selectedPositionGroupId &&
                  !showTimeMachine &&
                  overviewMode === 'groups' &&
                  'bg-emerald-900/9 font-medium text-emerald-950'
              )}
              onClick={() => {
                setOverviewMode('groups')
                setShowTimeMachine(false)
                setSelectedAssetAccountId(null)
                setSelectedPositionGroupId(null)
              }}
            >
              <ChartPie className="size-4" />
              持仓分组透视
            </Button>
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-start px-3 font-normal',
                showTimeMachine && 'bg-emerald-900/9 font-medium text-emerald-950'
              )}
              onClick={() => {
                setShowTimeMachine(true)
                setSelectedAssetAccountId(null)
                setSelectedPositionGroupId(null)
              }}
            >
              <History className="size-4" />
              时间机器
              {portfolio.activeSnapshots.length > 0 && (
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {portfolio.activeSnapshots.length}
                </span>
              )}
            </Button>
          </div>

          <div className="mb-2 flex items-center justify-between pl-3 pr-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              资产账户
            </p>
            {!selectedSnapshot && (
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label="添加资产账户"
                onClick={() => setAssetDialog({ open: true })}
              >
                <Plus className="size-3.5" />
              </Button>
            )}
          </div>
          <div className="grid gap-1">
            <AssetAccountNavigation
              key={activeProductAccount.id}
              accounts={activeProductAccount.assetAccounts}
              holders={activeProductAccount.holders}
              readOnly={Boolean(selectedSnapshot)}
              selectedAccountId={selectedAssetAccountId}
              onSelect={(account) => {
                setShowTimeMachine(false)
                setSelectedPositionGroupId(null)
                setSelectedAssetAccountId(account.id)
              }}
              onEdit={(account) => setAssetDialog({ open: true, account })}
              onDelete={(account) => setDeleteTarget({ kind: 'asset', account })}
            />
            {!activeProductAccount.assetAccounts.length && (
              <p className="px-3 py-2 text-xs leading-5 text-muted-foreground">还没有资产账户</p>
            )}
          </div>

          <div className="mb-2 mt-6 flex items-center justify-between pl-3 pr-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              持仓分组
            </p>
            {!selectedSnapshot && (
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label="新建持仓分组"
                onClick={() => setPositionGroupDialog({ open: true })}
              >
                <Plus className="size-3.5" />
              </Button>
            )}
          </div>
          <div className="grid gap-1">
            {activeProductAccount.positionGroups.map((group) => {
              const selected = selectedPositionGroupId === group.id
              return (
                <div
                  key={group.id}
                  className={cn(
                    'group flex items-center rounded-lg pr-1 transition-colors hover:bg-muted/70',
                    selected && 'bg-emerald-900/9 text-emerald-950'
                  )}
                >
                  <Button
                    variant="ghost"
                    className={cn(
                      'h-auto min-w-0 flex-1 justify-start gap-3 px-3 py-2.5 font-normal hover:bg-transparent',
                      selected && 'font-medium'
                    )}
                    onClick={() => {
                      setShowTimeMachine(false)
                      setSelectedAssetAccountId(null)
                      setSelectedPositionGroupId(group.id)
                    }}
                  >
                    <Folder className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-left">{group.name}</span>
                  </Button>
                  {!selectedSnapshot && <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100',
                          selected && 'opacity-100'
                        )}
                        aria-label={`${group.name}操作`}
                      >
                        <Ellipsis className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-20">
                      <DropdownMenuItem
                        onSelect={() => setPositionGroupDialog({ open: true, group })}
                      >
                        <Pencil className="size-4" />
                        编辑
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeleteTarget({ kind: 'group', group })}
                      >
                        <Trash2 className="size-4" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>}
                </div>
              )
            })}
            {!activeProductAccount.positionGroups.length && (
              <p className="px-3 py-2 text-xs leading-5 text-muted-foreground">还没有持仓分组</p>
            )}
          </div>
        </nav>

        <div className="border-t px-5 py-4">
          <LocalMark />
        </div>
      </aside>

      <AssetValueMaskContext.Provider value={assetValuesMasked}>
        <main className="min-w-0 flex-1 overflow-y-auto pt-12">
        {selectedSnapshot && !showTimeMachine && (
          <div className="pointer-events-none fixed left-64 right-0 top-0 z-50 flex h-12 items-center justify-center px-4">
            <div className="pointer-events-auto flex h-9 max-w-full items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/95 py-1 pl-3 pr-1 shadow-sm backdrop-blur">
              <History className="size-4 shrink-0 text-amber-900" />
              <p className="truncate text-sm text-amber-950">
                版本 #{shortSnapshotHash(selectedSnapshot.id)} · {formatLastSyncedAt(selectedSnapshot.createdAt)}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-amber-900 hover:bg-amber-100 hover:text-amber-950"
                onClick={() => setSelectedSnapshotId(null)}
              >
                返回最新版
              </Button>
            </div>
          </div>
        )}
        {showTimeMachine ? (
          <TimeMachine
            account={latestProductAccount ?? activeProductAccount}
            snapshots={portfolio.activeSnapshots}
            selectedSnapshotId={selectedSnapshotId}
            liveExchangeRates={liveExchangeRates}
            onCreate={createCurrentSnapshot}
            onViewLatest={() => {
              setSelectedSnapshotId(null)
              setShowTimeMachine(false)
            }}
            onViewSnapshot={(snapshotId) => {
              setSelectedSnapshotId(snapshotId)
              setShowTimeMachine(false)
            }}
            onDeleteSnapshot={(snapshot) =>
              setDeleteTarget({ kind: 'snapshot', snapshot })
            }
          />
        ) : selectedPositionGroup ? (
          <PositionGroupDetail
            group={selectedPositionGroup}
            assetAccounts={activeProductAccount.assetAccounts}
            holders={activeProductAccount.holders}
            readOnly={Boolean(selectedSnapshot)}
            anchorCurrency={activeProductAccount.anchorCurrency}
            exchangeRates={exchangeRates}
            imageExporting={imageExporting}
            onExportImage={() =>
              void exportImage({ kind: 'position-group', group: selectedPositionGroup })
            }
            onManagePositions={() => setGroupPositionsDialogOpen(true)}
            onRemovePosition={(positionId) => {
              void portfolio
                .removePositionFromGroup(
                  activeProductAccount.id,
                  selectedPositionGroup.id,
                  positionId
                )
                .catch(reportPortfolioError)
            }}
          />
        ) : selectedAssetAccount ? (
          <AssetAccountDetail
            account={selectedAssetAccount}
            holderName={activeProductAccount.holders.find(
              (holder) => holder.id === selectedAssetAccount.holderId
            )?.name}
            readOnly={Boolean(selectedSnapshot)}
            anchorCurrency={activeProductAccount.anchorCurrency}
            exchangeRates={exchangeRates}
            imageExporting={imageExporting}
            onExportImage={() =>
              void exportImage({ kind: 'asset-account', account: selectedAssetAccount })
            }
            onAddPosition={() =>
              setPositionDialog({ open: true, accountId: selectedAssetAccount.id })
            }
            onSync={() => void syncAssetAccount(selectedAssetAccount.id, true)}
            syncState={syncStates[selectedAssetAccount.id]}
            onEditPosition={(position) =>
              setPositionDialog({
                open: true,
                accountId: selectedAssetAccount.id,
                position
              })
            }
            onDeletePosition={(position) =>
              setDeleteTarget({ kind: 'position', account: selectedAssetAccount, position })
            }
          />
        ) : (
          <Overview
            account={activeProductAccount}
            mode={overviewMode}
            exchangeRates={exchangeRates}
            imageExporting={imageExporting}
            onExportImage={() =>
              void exportImage({ kind: 'overview', mode: overviewMode })
            }
            onOpenAssetAccount={(id) => {
              setSelectedPositionGroupId(null)
              setSelectedAssetAccountId(id)
            }}
            onOpenPositionGroup={(id) => {
              setSelectedAssetAccountId(null)
              setSelectedPositionGroupId(id)
            }}
          />
        )}
        </main>
      </AssetValueMaskContext.Provider>

      <ProductAccountDialog
        open={productDialog.open}
        onOpenChange={(open) => setProductDialog((current) => ({ ...current, open }))}
        onSubmit={submitProductAccount}
      />
      <ProductAccountSettingsDialog
        open={accountSettingsOpen}
        onOpenChange={setAccountSettingsOpen}
        account={activeProductAccount}
        exchangeRates={liveExchangeRateView}
        initialSection={accountSettingsSection}
        onSubmit={submitProductAccountSettings}
        onRequestDelete={() =>
          setDeleteTarget({ kind: 'product', account: activeProductAccount })
        }
      />
      <AssetAccountDialog
        open={assetDialog.open}
        onOpenChange={(open) => setAssetDialog((current) => ({ ...current, open }))}
        account={assetDialog.account}
        integration={
          assetDialog.account
            ? portfolio.getAssetAccountIntegration(assetDialog.account.id)
            : undefined
        }
        holders={activeProductAccount.holders}
        onManageHolders={() => {
          setAccountSettingsSection('holders')
          setAccountSettingsOpen(true)
        }}
        onSubmit={submitAssetAccount}
      />
      <PositionDialog
        open={positionDialog.open}
        onOpenChange={(open) => setPositionDialog((current) => ({ ...current, open }))}
        position={positionDialog.position}
        onSubmit={submitPosition}
      />
      <PositionGroupDialog
        open={positionGroupDialog.open}
        onOpenChange={(open) =>
          setPositionGroupDialog((current) => ({ ...current, open }))
        }
        group={positionGroupDialog.group}
        onSubmit={submitPositionGroup}
      />
      {selectedPositionGroup && (
        <GroupPositionsDialog
          open={groupPositionsDialogOpen}
          onOpenChange={setGroupPositionsDialogOpen}
          group={selectedPositionGroup}
          assetAccounts={activeProductAccount.assetAccounts}
          positionGroups={activeProductAccount.positionGroups}
          onSubmit={submitGroupPositions}
        />
      )}
      <SyncErrorDialog
        open={syncErrorDialog !== null}
        onOpenChange={(open) => {
          if (!open) setSyncErrorDialog(null)
        }}
        accountName={syncErrorDialog?.accountName ?? ''}
        message={syncErrorDialog?.message ?? ''}
      />
      <ExchangeRateErrorDialog
        open={Boolean(exchangeRateErrorDialog)}
        onOpenChange={(open) => {
          if (!open) setExchangeRateErrorDialog('')
        }}
        message={exchangeRateErrorDialog}
      />
      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={deleteDialogCopy.title}
        description={deleteDialogCopy.description}
        actionLabel={deleteTarget?.kind === 'product' ? '确认注销' : '确认删除'}
        onConfirm={confirmDelete}
      />
      <ImportBackupDialog
        open={pendingImport !== null}
        onOpenChange={(open) => {
          if (!open) setPendingImport(null)
        }}
        accountName={pendingImport?.account.name ?? ''}
        assetAccountCount={pendingImport?.assetAccountCount ?? 0}
        groupCount={pendingImport?.groupCount ?? 0}
        positionCount={pendingImport?.positionCount ?? 0}
        snapshotCount={pendingImport?.snapshotCount ?? 0}
        onConfirm={confirmImportAccount}
      />
      <ExportBackupDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onConfirm={() => void exportAccount()}
      />
      <BackupErrorDialog
        open={Boolean(backupError)}
        onOpenChange={(open) => {
          if (!open) setBackupError('')
        }}
        message={backupError}
      />
    </div>
  )
}
