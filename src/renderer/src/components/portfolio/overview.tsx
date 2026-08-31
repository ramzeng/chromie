import {
  CircleAlert,
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  formatMoney,
  type AssetAccount,
  type Position,
  type PositionGroup,
  type ProductAccount
} from '@/lib/portfolio'
import { cn } from '@/lib/utils'
import { convertToAnchorCurrency, valuePositions } from '@/lib/valuation'

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
    ? `${exchangeRates.status === 'error' ? '使用缓存' : refreshing ? '正在刷新，上次同步' : '最近同步'} ${formatLastSyncedAt(exchangeRates.snapshot.fetchedAt)}`
    : refreshing
      ? '正在获取汇率'
      : '暂无汇率'

  if (exchangeRates.status === 'error') {
    return (
      <Alert variant={exchangeRates.snapshot ? 'default' : 'destructive'} className="mt-3">
        <CircleAlert data-icon="inline-start" />
        <AlertTitle className="flex items-center gap-2">
          参考汇率
          <Badge variant={exchangeRates.snapshot ? 'secondary' : 'destructive'}>
            {exchangeRates.snapshot ? '使用缓存' : '获取失败'}
          </Badge>
        </AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {rateItems.map((item) => (
            <span key={item.label} className="tabular-nums text-foreground/80">
              {item.label} {formatExchangeRate(item.value)}
            </span>
          ))}
          <span className={cn(exchangeRates.snapshot && 'text-muted-foreground')}>
            {exchangeRates.error || rateStatus}
          </span>
          {exchangeRates.refresh && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto"
              disabled={refreshing}
              aria-busy={refreshing}
              onClick={() => void exchangeRates.refresh?.()}
            >
              {refreshing ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}
              {refreshing ? '重试中…' : '重试'}
            </Button>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div
      className="mt-3 flex min-h-10 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border/70 bg-muted/25 px-4 py-2 text-xs"
      role="status"
    >
      <Badge variant="secondary">参考汇率</Badge>
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
      <Badge variant="outline">{rateStatus}</Badge>
      {exchangeRates.refresh && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto size-7 shrink-0 text-muted-foreground"
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
  )
}

export function ValueSummaryCard({
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
      <div className="grid gap-3 min-[760px]:grid-cols-2 min-[1100px]:grid-cols-3">
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
      <Table className="min-w-[900px] table-fixed">
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
      <Table className="min-w-[900px] table-fixed">
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
                  <Folder className="size-4 shrink-0 text-muted-foreground" />
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

export function Overview({
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
  const isAccountMode = mode === 'accounts'

  return (
    <div className="mx-auto w-[calc(50%+36rem)] max-w-full px-4 pb-8 pt-4">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-[-0.04em]">
          {isAccountMode ? '资产账户透视' : '持仓分组透视'}
        </h1>
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
        {!isAccountMode && !groupItems.length && (
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
      </section>
    </div>
  )
}

export function CurrencySummaryTable({
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
                <TableCell colSpan={5} className="p-0">
                  <Empty className="min-h-24 gap-2 border-0 p-3 md:p-3">
                    <EmptyHeader className="gap-1">
                      <EmptyTitle className="text-sm">暂无币种</EmptyTitle>
                      <EmptyDescription>添加持仓后将在这里汇总</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
