import { Pie, PieChart } from 'recharts'

import { MaskedAssetValue, formatAmount } from '@/components/portfolio/view-helpers'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '@/components/ui/chart'
import { formatMoney, type AssetAccount, type Position } from '@/lib/portfolio'
import { valuePositions } from '@/lib/valuation'

export type AssetAllocationItem = {
  id: string
  label: string
  positions: Position[]
}

export function createAccountAllocationItems(
  accounts: AssetAccount[]
): AssetAllocationItem[] {
  return accounts.map((account) => ({
    id: account.id,
    label: account.name,
    positions: account.positions
  }))
}

export function createPositionAllocationItems(
  positions: Position[]
): AssetAllocationItem[] {
  return positions.map((position) => ({
    id: position.id,
    label: position.name.trim() || position.symbol,
    positions: [position]
  }))
}

function createCurrencyAllocationItems(
  positions: Position[]
): AssetAllocationItem[] {
  const positionsByCurrency = new Map<string, Position[]>()
  positions.forEach((position) => {
    const currency = position.currency.trim().toUpperCase() || '未标注'
    const currencyPositions = positionsByCurrency.get(currency) ?? []
    currencyPositions.push(position)
    positionsByCurrency.set(currency, currencyPositions)
  })
  return [...positionsByCurrency].map(([currency, currencyPositions]) => ({
    id: `currency:${currency}`,
    label: currency,
    positions: currencyPositions
  }))
}

const chartColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)'
] as const

const chartConfig = {
  value: {
    label: '折算市值'
  }
} satisfies ChartConfig

export function AssetDistributionCharts({
  positions,
  breakdownItems,
  breakdownTitle,
  breakdownDimensionLabel,
  baseCurrency,
  rates
}: {
  positions: Position[]
  breakdownItems: AssetAllocationItem[]
  breakdownTitle: string
  breakdownDimensionLabel: string
  baseCurrency: string
  rates?: Record<string, number>
}) {
  return (
    <div className="grid gap-3 min-[1100px]:grid-cols-2">
      <AssetAllocationChart
        items={createCurrencyAllocationItems(positions)}
        title="币种市值分布"
        dimensionLabel="持仓币种"
        baseCurrency={baseCurrency}
        rates={rates}
      />
      <AssetAllocationChart
        items={breakdownItems}
        title={breakdownTitle}
        dimensionLabel={breakdownDimensionLabel}
        baseCurrency={baseCurrency}
        rates={rates}
      />
    </div>
  )
}

export function AssetAllocationChart({
  items,
  title,
  dimensionLabel,
  baseCurrency,
  rates
}: {
  items: AssetAllocationItem[]
  title: string
  dimensionLabel: string
  baseCurrency: string
  rates?: Record<string, number>
}) {
  const valuedItems = items.map((item) => ({
    ...item,
    valuation: valuePositions(item.positions, baseCurrency, rates)
  }))

  if (valuedItems.some(({ valuation }) => !valuation.isComplete)) return null

  const rankedItems = valuedItems
    .flatMap(({ id, label, valuation }) => {
      const value = valuation.totalConvertedMarketValue
      return value !== undefined && value > 0 ? [{ id, label, value }] : []
    })
    .sort((left, right) => right.value - left.value)

  if (rankedItems.length === 0) return null

  const visibleItems = rankedItems.length > chartColors.length
    ? [
        ...rankedItems.slice(0, chartColors.length - 1),
        {
          id: 'other',
          label: `其他 ${rankedItems.length - chartColors.length + 1} 项`,
          value: rankedItems
            .slice(chartColors.length - 1)
            .reduce((total, item) => total + item.value, 0)
        }
      ]
    : rankedItems
  const chartData = visibleItems.map((item, index) => ({
    ...item,
    fill: chartColors[index]
  }))
  const hasSingleSlice = chartData.length === 1

  return (
    <Card className="flex flex-col border-border/70 shadow-none">
      <CardHeader className="items-center px-4 pb-0 pt-4">
        <CardTitle className="text-base tracking-[-0.02em]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 px-2 pb-2 pt-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto h-[210px] w-full max-w-[720px] aspect-auto pb-0 [&_.recharts-pie-label-text]:fill-foreground [&_.recharts-pie-label-text]:text-[11px]"
          role="img"
          aria-label={`${title}饼图，按${dimensionLabel}统计`}
        >
          <PieChart accessibilityLayer>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideLabel
                  hideIndicator
                  formatter={(value, name, item) => (
                    <div className="flex min-w-48 items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {String(name)}
                      </span>
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        <MaskedAssetValue>
                          {formatMoney(Number(value), baseCurrency)}
                        </MaskedAssetValue>
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="label"
              isAnimationActive={false}
              outerRadius="70%"
              stroke={hasSingleSlice ? 'none' : 'var(--card)'}
              strokeWidth={hasSingleSlice ? 0 : 2}
              labelLine={hasSingleSlice
                ? false
                : {
                    stroke: 'var(--chart-2)',
                    strokeOpacity: 0.72
                  }}
              label={({ name, percent }) => {
                const characters = Array.from(String(name))
                const shortName = characters.length > 7
                  ? `${characters.slice(0, 7).join('')}…`
                  : characters.join('')
                return `${shortName} ${formatAmount((percent ?? 0) * 100)}%`
              }}
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
