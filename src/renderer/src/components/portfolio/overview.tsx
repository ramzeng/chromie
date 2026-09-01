import {
  Download,
  Folder,
  RefreshCw,
  WalletCards
} from 'lucide-react'

import {
  AccountTypeIcon,
  MaskedAssetValue,
  compareOptionalValuesDescending,
  formatAmount,
  formatExchangeRate,
  formatLastSyncedAt,
  type ExchangeRateView
} from '@/components/portfolio/view-helpers'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  formatMoney,
  type AssetAccount,
  type Position,
  type PositionGroup,
  type ProductAccount
} from '@/lib/portfolio'
import { valuePositions } from '@/lib/valuation'

export type OverviewMode = 'accounts' | 'groups'

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
    ? `${refreshing ? '正在刷新，上次同步' : '最近同步'} ${formatLastSyncedAt(exchangeRates.snapshot.fetchedAt)}`
    : refreshing
      ? '正在获取汇率'
      : '暂无汇率'

  return (
    <div
      className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border/70 bg-muted/25 px-4 py-2 text-xs"
      role="status"
    >
      <span className="font-medium text-foreground">参考汇率</span>
      {refreshing && rateItems.length === 0 ? (
        <div className="flex flex-1 items-center gap-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-24" />
        </div>
      ) : (
        rateItems.map((item) => (
          <span key={item.label} className="tabular-nums text-foreground/75">
            {item.label} {formatExchangeRate(item.value)}
          </span>
        ))
      )}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <span className="text-muted-foreground">{rateStatus}</span>
        {exchangeRates.refresh && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-muted-foreground"
            disabled={refreshing}
            aria-busy={refreshing}
            aria-label={refreshing ? '正在刷新汇率' : '刷新汇率'}
            title={refreshing ? '正在刷新汇率' : '刷新汇率'}
            onClick={() => void exchangeRates.refresh?.()}
          >
            {refreshing ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RefreshCw data-icon="inline-start" />
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

export function ValueSummaryCard({
  positions,
  anchorCurrency,
  exchangeRates
}: {
  positions: Position[]
  anchorCurrency: string
  exchangeRates: ExchangeRateView
}) {
  const anchoredValuation = valuePositions(
    positions,
    anchorCurrency,
    exchangeRates.snapshot?.rates
  )
  const hasCompleteAnchoredTotal =
    anchoredValuation.isComplete &&
    anchoredValuation.totalAnchoredMarketValue !== undefined
  const marketValueSummaries = accountViewCurrencies.map((currency) => {
    let value = 0
    let hasValue = false
    positions.forEach((position) => {
      if (position.currency !== currency || position.price === undefined) return
      value += position.quantity * position.price
      hasValue = true
    })
    return { currency, value, hasValue }
  })

  return (
    <div>
      <ExchangeRateBanner exchangeRates={exchangeRates} />
      <div className="mt-3 grid gap-3 min-[760px]:grid-cols-2 min-[1100px]:grid-cols-4">
        <Card className="min-h-[112px] border-border/70 shadow-none">
          <CardHeader>
            <CardDescription>锚定市值 · {anchorCurrency}</CardDescription>
            <CardTitle className="truncate text-2xl tracking-[-0.03em] tabular-nums">
              {hasCompleteAnchoredTotal
                ? <MaskedAssetValue>
                    {formatMoney(
                      anchoredValuation.totalAnchoredMarketValue!,
                      anchorCurrency
                    )}
                  </MaskedAssetValue>
                : '-'}
            </CardTitle>
          </CardHeader>
        </Card>
        {marketValueSummaries.map(({ currency, value, hasValue }) => (
          <Card
            key={currency}
            className="min-h-[112px] border-border/70 shadow-none"
          >
            <CardHeader>
              <CardDescription>{currency} 市值</CardDescription>
              <CardTitle className="truncate text-2xl tracking-[-0.03em] tabular-nums">
                {hasValue
                  ? <MaskedAssetValue>{formatMoney(value, currency)}</MaskedAssetValue>
                  : '-'}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <Alert role="note" className="mt-3 bg-muted/25 py-2">
        <AlertDescription className="text-xs text-muted-foreground">
          锚定市值 = USD 市值 + HKD 市值 + CNY 市值（汇率折算后）
        </AlertDescription>
      </Alert>
    </div>
  )
}

function AssetAccountTable({
  accounts,
  accountGroups,
  anchorCurrency,
  exchangeRates,
  onOpen
}: {
  accounts: AssetAccount[]
  accountGroups: ProductAccount['accountGroups']
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
        accountGroupName: accountGroups.find((accountGroup) =>
          accountGroup.assetAccountIds.includes(account.id)
        )?.name,
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
    <div className="overflow-hidden rounded-lg border border-border/70 bg-card">
      <Table className="min-w-[900px] table-fixed">
        <TableHeader className="bg-muted/15">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[19%]">资产账户</TableHead>
            <TableHead className="w-[13%]">资产分组</TableHead>
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
          {rows.map(({ account, accountGroupName, marketValues, valuation }) => (
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
                {accountGroupName ?? '-'}
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
  accountGroups,
  anchorCurrency,
  exchangeRates,
  onOpen
}: {
  items: Array<{ group: PositionGroup; positions: Position[] }>
  assetAccounts: AssetAccount[]
  accountGroups: ProductAccount['accountGroups']
  anchorCurrency: string
  exchangeRates: ExchangeRateView
  onOpen: (id: string) => void
}) {
  const rows = items
    .map(({ group, positions }) => {
      const positionIds = new Set(positions.map((position) => position.id))
      const accountGroupNames = [
        ...new Set(
          assetAccounts
            .filter((account) =>
              account.positions.some((position) => positionIds.has(position.id))
            )
            .map(
              (account) =>
                accountGroups.find((accountGroup) =>
                  accountGroup.assetAccountIds.includes(account.id)
                )?.name ?? '-'
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
        accountGroupLabel: accountGroupNames.join('、'),
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
    <div className="overflow-hidden rounded-lg border border-border/70 bg-card">
      <Table className="min-w-[900px] table-fixed">
        <TableHeader className="bg-muted/15">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[19%]">持仓分组</TableHead>
            <TableHead className="w-[14%]">资产分组</TableHead>
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
          {rows.map(({ group, accountGroupLabel, marketValues, valuation }) => (
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
                  <Folder className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate font-semibold">{group.name}</span>
                </div>
              </TableCell>
              <TableCell className="truncate text-muted-foreground">
                {accountGroupLabel || '-'}
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

export function Overview({
  account,
  mode,
  onModeChange,
  exchangeRates,
  imageExporting,
  onExportImage,
  onOpenAssetAccount,
  onOpenPositionGroup
}: {
  account: ProductAccount
  mode: OverviewMode
  onModeChange: (mode: OverviewMode) => void
  exchangeRates: ExchangeRateView
  imageExporting: boolean
  onExportImage: () => Promise<void>
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
  return (
    <Tabs
      value={mode}
      className="mx-auto w-[calc(50%+36rem)] max-w-full px-4 pb-8 pt-4"
      onValueChange={(value) => {
        if (value === 'accounts' || value === 'groups') onModeChange(value)
      }}
    >
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-[-0.04em]">资产透视</h1>
        <Button
          variant="outline"
          onClick={() => void onExportImage()}
          disabled={imageExporting}
          aria-busy={imageExporting}
        >
          {imageExporting ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Download data-icon="inline-start" />
          )}
          {imageExporting ? '导出中…' : '导出图片'}
        </Button>
      </header>
      <TabsList className="mt-5" aria-label="透视维度">
        <TabsTrigger value="accounts">
          <WalletCards data-icon="inline-start" />
          资产账户
        </TabsTrigger>
        <TabsTrigger value="groups">
          <Folder data-icon="inline-start" />
          持仓分组
        </TabsTrigger>
      </TabsList>

      <section className="mt-6">
        <ValueSummaryCard
          positions={positions}
          anchorCurrency={account.anchorCurrency}
          exchangeRates={exchangeRates}
        />
      </section>

      <section className="mt-6">
        <TabsContent value="accounts" className="mt-0">
          {account.assetAccounts.length > 0 ? (
            <div>
              <h2 className="mb-3 text-base font-semibold tracking-[-0.02em]">持仓分布</h2>
              <AssetAccountTable
                accounts={account.assetAccounts}
                accountGroups={account.accountGroups}
                anchorCurrency={account.anchorCurrency}
                exchangeRates={exchangeRates}
                onOpen={onOpenAssetAccount}
              />
            </div>
          ) : (
            <Empty className="min-h-64 border bg-card">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <WalletCards data-icon="inline-start" />
                </EmptyMedia>
                <EmptyTitle>暂无资产账户</EmptyTitle>
                <EmptyDescription>支持富途牛牛、中银国际、欧易、支付宝、招商银行、中国银行和通用账户</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </TabsContent>
        <TabsContent value="groups" className="mt-0">
          {groupItems.length > 0 ? (
            <div>
              <h2 className="mb-3 text-base font-semibold tracking-[-0.02em]">持仓分布</h2>
              <PositionGroupOverviewTable
                items={groupItems}
                assetAccounts={account.assetAccounts}
                accountGroups={account.accountGroups}
                anchorCurrency={account.anchorCurrency}
                exchangeRates={exchangeRates}
                onOpen={onOpenPositionGroup}
              />
            </div>
          ) : (
            <Empty className="min-h-64 border bg-card">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Folder data-icon="inline-start" />
                </EmptyMedia>
                <EmptyTitle>暂无持仓分组</EmptyTitle>
                <EmptyDescription>将不同资产账户中的持仓归入持仓分组后，在这里查看币种和锚定市值</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </TabsContent>
      </section>
    </Tabs>
  )
}
