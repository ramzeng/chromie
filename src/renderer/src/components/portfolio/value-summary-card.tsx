import { CircleAlert, RefreshCw } from 'lucide-react'

import { portfolioDisplayCurrencies } from '@/components/portfolio/portfolio-view-model'
import {
  MaskedAssetValue,
  cleanErrorMessage,
  formatExchangeRate,
  formatLastSyncedAt,
  type ExchangeRateView
} from '@/components/portfolio/view-helpers'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { formatMoney, type Position } from '@/lib/portfolio'
import { cn } from '@/lib/utils'
import { convertToBaseCurrency, valuePositions } from '@/lib/valuation'
import { createCurrencyMarketValues } from './portfolio-view-model'

function SummaryAmount({
  value,
  unavailableReason
}: {
  value?: string
  unavailableReason: string
}) {
  const label = value ?? unavailableReason

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={label}
          className={cn(
            'block min-w-0 truncate rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            !value && 'mt-1 text-sm font-medium text-muted-foreground'
          )}
        >
          {value
            ? <MaskedAssetValue>{value}</MaskedAssetValue>
            : unavailableReason}
        </span>
      </TooltipTrigger>
      <TooltipContent className="font-medium tabular-nums">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function ExchangeRateLabel({
  currency,
  baseCurrency,
  rate
}: {
  currency: string
  baseCurrency: string
  rate?: number
}) {
  const pair = `${currency}/${baseCurrency}`
  const formattedRate = rate === undefined ? '-' : formatExchangeRate(rate)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="shrink-0 whitespace-nowrap rounded-sm text-xs tabular-nums text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {pair} {formattedRate}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {rate === undefined
          ? `暂无 ${pair} 汇率`
          : `1 ${currency} = ${formattedRate} ${baseCurrency}`}
      </TooltipContent>
    </Tooltip>
  )
}

export function ValueSummaryCard({
  positions,
  baseCurrency,
  exchangeRates
}: {
  positions: Position[]
  baseCurrency: string
  exchangeRates: ExchangeRateView
}) {
  const convertedValuation = valuePositions(
    positions,
    baseCurrency,
    exchangeRates.snapshot?.rates
  )
  const missingPriceCount = positions.filter(
    (position) => position.price === undefined
  ).length
  const hasCompleteConvertedTotal =
    positions.length > 0 &&
    missingPriceCount === 0 &&
    convertedValuation.isComplete &&
    convertedValuation.totalConvertedMarketValue !== undefined
  const normalizedBaseCurrency = baseCurrency.trim().toUpperCase()
  const refreshing =
    exchangeRates.status === 'loading' || exchangeRates.status === 'refreshing'
  const marketValues = createCurrencyMarketValues(positions)
  const totalIssues = [
    ...(missingPriceCount > 0 ? [`缺少 ${missingPriceCount} 项价格`] : []),
    ...(convertedValuation.missingCurrencies.length > 0
      ? [`缺少 ${convertedValuation.missingCurrencies.join('、')} 汇率`]
      : [])
  ]
  const totalUnavailableReason = positions.length === 0
    ? '暂无持仓'
    : totalIssues.join('、') || '暂时无法计算'
  const totalValue = hasCompleteConvertedTotal
    ? formatMoney(
        convertedValuation.totalConvertedMarketValue!,
        baseCurrency
      )
    : undefined
  const refreshedAt = exchangeRates.snapshot?.fetchedAt
    ? formatLastSyncedAt(exchangeRates.snapshot.fetchedAt)
    : undefined
  const refreshFailed = exchangeRates.status === 'error'
  const refreshError = cleanErrorMessage(exchangeRates.error) || '请稍后重试'
  const refreshHint = refreshing
    ? '正在更新汇率'
    : refreshFailed
      ? `汇率更新失败：${refreshError}${refreshedAt ? `；当前使用 ${refreshedAt} 的汇率` : ''}`
      : refreshedAt
        ? `更新汇率 · 上次更新于 ${refreshedAt}`
        : '更新汇率 · 暂无汇率数据'

  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid gap-2 @min-[36rem]:grid-cols-2 @min-[48rem]:grid-cols-3 @min-[68rem]:grid-cols-5">
        <Card
          size="sm"
          className="min-h-[104px] border-0 bg-muted/35 shadow-none data-[size=sm]:gap-0 data-[size=sm]:py-0 @min-[36rem]:col-span-2 @min-[48rem]:col-span-3 @min-[68rem]:col-span-2"
        >
          <CardHeader className="flex-1 grid-cols-1 content-center gap-1 py-3">
            <div className="flex items-center justify-between gap-2">
              <CardDescription>总市值 · {baseCurrency}</CardDescription>
              {exchangeRates.refresh && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className={cn(
                        '-mr-1 shrink-0 text-muted-foreground',
                        refreshFailed && 'text-destructive'
                      )}
                      disabled={refreshing}
                      aria-busy={refreshing}
                      aria-label={
                        refreshFailed ? '汇率更新失败，点击重试' : refreshHint
                      }
                      onClick={() => void exchangeRates.refresh?.()}
                    >
                      {refreshing ? (
                        <Spinner data-icon="icon-only" />
                      ) : refreshFailed ? (
                        <CircleAlert data-icon="icon-only" />
                      ) : (
                        <RefreshCw data-icon="icon-only" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="end" className="max-w-80">
                    {refreshHint}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <CardTitle className="min-w-0 text-2xl tracking-[-0.03em] tabular-nums">
              <SummaryAmount
                value={totalValue}
                unavailableReason={totalUnavailableReason}
              />
            </CardTitle>
          </CardHeader>
        </Card>
        {portfolioDisplayCurrencies.map((currency) => {
          const marketValue = marketValues.get(currency)!
          const currencyPositions = positions.filter(
            (position) =>
              position.currency.trim().toUpperCase() === currency
          )
          const missingCurrencyPriceCount = currencyPositions.filter(
            (position) => position.price === undefined
          ).length
          const currencyValue =
            currencyPositions.length > 0 &&
            missingCurrencyPriceCount === 0 &&
            marketValue.hasValue
              ? formatMoney(marketValue.value, currency)
              : undefined
          const unavailableReason = currencyPositions.length === 0
            ? '暂无持仓'
            : missingCurrencyPriceCount > 0
              ? `缺少 ${missingCurrencyPriceCount} 项价格`
              : '暂时无法计算'
          const exchangeRate = currency === normalizedBaseCurrency
            ? undefined
            : convertToBaseCurrency(
                1,
                currency,
                normalizedBaseCurrency,
                exchangeRates.snapshot?.rates
              )
          return (
            <Card
              key={currency}
              size="sm"
              className={cn(
                'min-h-[104px] border-border/40 shadow-none data-[size=sm]:gap-0 data-[size=sm]:py-0',
                currency === portfolioDisplayCurrencies.at(-1) &&
                  '@min-[36rem]:col-span-2 @min-[48rem]:col-span-1'
              )}
            >
              <CardHeader className="flex-1 grid-cols-1 content-center gap-1 py-3">
                <div className="flex items-center justify-between gap-2">
                  <CardDescription className="shrink-0">
                    {currency} 市值
                  </CardDescription>
                  {currency !== normalizedBaseCurrency && (
                    <ExchangeRateLabel
                      currency={currency}
                      baseCurrency={normalizedBaseCurrency}
                      rate={exchangeRate}
                    />
                  )}
                </div>
                <CardTitle className="min-w-0 text-xl tracking-[-0.03em] tabular-nums">
                  <SummaryAmount
                    value={currencyValue}
                    unavailableReason={unavailableReason}
                  />
                </CardTitle>
              </CardHeader>
            </Card>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
