import { useId } from 'react'
import { ChartPie } from 'lucide-react'
import {
  Cell,
  Pie,
  PieChart,
  type PieLabelRenderProps
} from 'recharts'

import {
  MaskedAssetValue,
  formatAmount
} from '@/components/portfolio/view-helpers'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '@/components/ui/chart'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty'
import {
  formatMoney,
  type Account,
  type Position
} from '@/lib/portfolio'
import { valuePositions } from '@/lib/valuation'

const chartColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)'
] as const

export type AssetAllocationItem = {
  id: string
  label: string
  positions: Position[]
  color?: string
}

export function createAccountAllocationItems(
  accounts: Account[]
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

function compactChartLabel(value: string, maxLength = 10): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value
}

function PieValueLabel({
  name,
  percent = 0,
  x,
  y,
  textAnchor
}: PieLabelRenderProps) {
  const resolvedTextAnchor =
    textAnchor === 'start' ||
    textAnchor === 'middle' ||
    textAnchor === 'end' ||
    textAnchor === 'inherit'
      ? textAnchor
      : undefined

  return (
    <text
      x={x}
      y={y}
      textAnchor={resolvedTextAnchor}
      dominantBaseline="central"
      fill="var(--muted-foreground)"
      fontSize={12}
    >
      {compactChartLabel(name, 8)} {formatAmount(percent * 100)}%
    </text>
  )
}

function DistributionStateCard({
  title,
  description
}: {
  title: string
  description: string
}) {
  return (
    <Card className="min-h-[300px] gap-0 border-border/50 py-0 shadow-none">
      <CardHeader className="px-5 pb-0 pt-5">
        <CardTitle className="text-base tracking-[-0.02em]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid flex-1 place-items-center px-5 pb-5 pt-0">
        <Empty className="min-h-40 border-0 p-4 md:p-4">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ChartPie data-icon="inline-start" />
            </EmptyMedia>
            <EmptyTitle>暂时无法生成分布</EmptyTitle>
            <EmptyDescription>{description}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </CardContent>
    </Card>
  )
}

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
    <div className="grid gap-3 @min-[68rem]:grid-cols-2">
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
  const titleId = useId()
  const summaryId = useId()
  const valuedItems = items.map((item) => ({
    ...item,
    valuation: valuePositions(item.positions, baseCurrency, rates)
  }))
  const missingCurrencies = [...new Set(
    valuedItems.flatMap(({ valuation }) => valuation.missingCurrencies)
  )]

  if (missingCurrencies.length > 0) {
    return (
      <DistributionStateCard
        title={title}
        description={`缺少 ${missingCurrencies.join('、')} 汇率，补齐后将自动显示`}
      />
    )
  }

  const rankedItems = valuedItems
    .flatMap(({ id, label, color, valuation }) => {
      const value = valuation.totalConvertedMarketValue
      return value !== undefined && value > 0 ? [{ id, label, color, value }] : []
    })
    .sort((left, right) => right.value - left.value)

  if (rankedItems.length === 0) {
    return (
      <DistributionStateCard
        title={title}
        description="添加带有当前价格的持仓后，将在这里显示市值占比"
      />
    )
  }

  const visibleItems = rankedItems.length > chartColors.length
    ? [
        ...rankedItems.slice(0, chartColors.length - 1),
        {
          id: 'other',
          label: '其他',
          color: undefined,
          value: rankedItems
            .slice(chartColors.length - 1)
            .reduce((total, item) => total + item.value, 0)
        }
      ]
    : rankedItems
  const chartData = visibleItems.map((item, index) => ({
    ...item,
    fill: item.color ?? chartColors[index]
  }))
  const totalValue = chartData.reduce((total, item) => total + item.value, 0)
  const chartConfig = Object.fromEntries(
    chartData.map((item) => [
      item.label,
      { label: item.label, color: item.fill }
    ])
  ) satisfies ChartConfig
  const hasSingleSlice = chartData.length === 1

  return (
    <Card className="min-h-[300px] gap-0 border-border/50 py-0 shadow-none">
      <CardHeader className="px-5 pb-1 pt-5">
        <CardTitle id={titleId} className="text-base tracking-[-0.02em]">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 px-3 pb-4 pt-0">
        <ChartContainer
          config={chartConfig}
          className="h-[270px] w-full aspect-auto"
          role="img"
          aria-labelledby={titleId}
          aria-describedby={summaryId}
        >
          <PieChart accessibilityLayer>
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  nameKey="label"
                  formatter={(value, _name, item) => {
                    const numericValue = Number(value)
                    const label = String(item.payload?.label ?? '')
                    const percentage = totalValue === 0
                      ? 0
                      : numericValue / totalValue * 100
                    return (
                      <div className="flex min-w-44 items-center justify-between gap-4">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium tabular-nums text-foreground">
                          <MaskedAssetValue>
                            {formatMoney(numericValue, baseCurrency)}
                          </MaskedAssetValue>{' '}
                          ·{' '}
                          {formatAmount(percentage)}%
                        </span>
                      </div>
                    )
                  }}
                />
              }
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="label"
              startAngle={hasSingleSlice ? 180 : 90}
              endAngle={hasSingleSlice ? -180 : -270}
              outerRadius="60%"
              isAnimationActive={false}
              stroke="none"
              labelLine={{
                stroke: 'var(--muted-foreground)',
                strokeOpacity: 0.45,
                strokeWidth: 1
              }}
              label={PieValueLabel}
            >
              {chartData.map((item) => (
                <Cell key={item.id} fill={item.fill} />
              ))}
            </Pie>
            <ChartLegend
              content={
                <ChartLegendContent
                  nameKey="label"
                  className="flex-wrap gap-x-3 gap-y-1 px-2"
                />
              }
            />
          </PieChart>
        </ChartContainer>
        <ul id={summaryId} className="sr-only">
          <li>按{dimensionLabel}统计</li>
          {chartData.map((item) => (
            <li key={item.id}>
              {item.label}：{formatMoney(item.value, baseCurrency)}，
              {formatAmount(item.value / totalValue * 100)}%
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
