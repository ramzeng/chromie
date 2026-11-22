import { useState, type ReactNode } from 'react'
import { ArrowLeft, CircleAlert, GitCompareArrows } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis
} from 'recharts'

import { PortfolioPage, PortfolioPageHeader } from '@/components/portfolio/page-shell'
import { TableEmptyState } from '@/components/portfolio/table-empty-state'
import {
  MaskedAssetValue,
  formatAmount,
  shortSnapshotHash
} from '@/components/portfolio/view-helpers'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig
} from '@/components/ui/chart'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  formatMoney,
  type Workspace,
  type WorkspaceSnapshot
} from '@/lib/portfolio'
import {
  formatCompactAmount,
  formatSignedAmount,
  formatSignedPercent,
  isMeaningfulChange,
  netFlowLabel
} from '@/lib/portfolio-comparison'
import { buildPortfolioTrend, type TrendPoint } from '@/lib/portfolio-trend'
import { cn } from '@/lib/utils'
import { LATEST_COMPARISON_POINT } from './snapshot-comparison'

type TrendMetric = 'value' | 'return'

const chartConfig = {
  value: { label: '市值', color: 'var(--chart-2)' },
  return: { label: '累计收益率', color: 'var(--chart-2)' }
} satisfies ChartConfig

function formatPointTime(time: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(time)
}

function formatAxisTime(time: number, spansYears: boolean): string {
  return new Intl.DateTimeFormat('zh-CN', spansYears
    ? { year: '2-digit', month: '2-digit' }
    : { month: '2-digit', day: '2-digit' }
  ).format(time)
}

// 坐标轴空间有限，金额最多保留一位小数。
function formatAxisAmount(value: number): string {
  const absolute = Math.abs(value)
  if (absolute >= 1e8) return `${Number((value / 1e8).toFixed(1))}亿`
  if (absolute >= 1e4) return `${Number((value / 1e4).toFixed(1))}万`
  return String(Number(value.toFixed(0)))
}

function pointLabel(id: string): string {
  return id === LATEST_COMPARISON_POINT ? '当前数据' : `快照 #${shortSnapshotHash(id)}`
}

function changeTone(value: number | undefined): string {
  if (!isMeaningfulChange(value)) return 'text-muted-foreground'
  return value > 0 ? 'text-gain' : 'text-loss'
}

function SignedValue({
  value,
  compact,
  className
}: {
  value: number | undefined
  compact?: boolean
  className?: string
}) {
  if (value === undefined) return <span className="text-muted-foreground">-</span>
  return (
    <span
      className={cn('tabular-nums', changeTone(value), className)}
      title={compact ? formatSignedAmount(value) : undefined}
    >
      <MaskedAssetValue>
        {compact ? formatCompactAmount(value, { signed: true }) : formatSignedAmount(value)}
      </MaskedAssetValue>
    </span>
  )
}

function SignedPercent({ value, className }: { value: number | undefined; className?: string }) {
  if (value === undefined) return <span className="text-muted-foreground">-</span>
  return (
    <span className={cn('tabular-nums', changeTone(value), className)}>
      {formatSignedPercent(value)}
    </span>
  )
}

function TrendStat({
  title,
  children,
  hint
}: {
  title: string
  children: ReactNode
  hint?: ReactNode
}) {
  return (
    <Card
      size="sm"
      className="min-h-[104px] border-border/40 shadow-none data-[size=sm]:gap-0 data-[size=sm]:py-0"
    >
      <CardHeader className="flex-1 grid-cols-1 content-center gap-1 py-3">
        <CardDescription className="flex h-7 items-center">{title}</CardDescription>
        <CardTitle className="flex h-6 min-w-0 items-center truncate text-xl tracking-[-0.03em] tabular-nums">
          {children}
        </CardTitle>
        {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
      </CardHeader>
    </Card>
  )
}

function TrendTooltip({
  active,
  payload,
  baseCurrency
}: {
  active?: boolean
  payload?: Array<{ payload?: TrendPoint }>
  baseCurrency: string
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="grid min-w-44 gap-1.5 rounded-sm border border-border/50 bg-popover px-2.5 py-2 text-xs shadow-xl">
      <div>
        <p className="font-medium">{pointLabel(point.id)}</p>
        <p className="text-muted-foreground tabular-nums">{formatPointTime(point.time)}</p>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">市值</span>
        <span className="font-medium tabular-nums">
          {point.value === undefined ? (
            '-'
          ) : (
            <MaskedAssetValue>{formatMoney(point.value, baseCurrency)}</MaskedAssetValue>
          )}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">累计收益率</span>
        <span className="font-medium tabular-nums">
          {formatSignedPercent(point.cumulativeReturnPercent)}
        </span>
      </div>
    </div>
  )
}

function TrendChart({
  points,
  baseCurrency
}: {
  points: TrendPoint[]
  baseCurrency: string
}) {
  const [metric, setMetric] = useState<TrendMetric>('value')
  const data = metric === 'value'
    ? points.filter((point) => point.value !== undefined)
    : points
  const spansYears = points.length > 1 &&
    new Date(points[0].time).getFullYear() !== new Date(points.at(-1)!.time).getFullYear()
  const dataKey = metric === 'value' ? 'value' : 'cumulativeReturnPercent'

  return (
    <div className="rounded-sm border border-border/70 bg-card px-4 pb-3 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">
            {metric === 'value' ? `总市值 · ${baseCurrency}` : '累计收益率（剔除买卖）'}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {metric === 'value'
              ? '包含买卖带来的资金进出'
              : '只看价格和汇率带来的涨跌，加仓、取出不影响'}
          </p>
        </div>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={metric}
          onValueChange={(value) => {
            if (value) setMetric(value as TrendMetric)
          }}
        >
          <ToggleGroupItem value="value" className="px-3 text-xs">
            市值
          </ToggleGroupItem>
          <ToggleGroupItem value="return" className="px-3 text-xs">
            收益率
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <ChartContainer
        config={chartConfig}
        className="mt-3 aspect-auto h-[280px] w-full"
        role="img"
        aria-label={metric === 'value' ? '总市值走势' : '累计收益率走势'}
      >
        <LineChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="time"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(value: number) => formatAxisTime(value, spansYears)}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
          />
          <YAxis
            width={64}
            tickLine={false}
            axisLine={false}
            tickMargin={4}
            domain={['auto', 'auto']}
            tickFormatter={(value: number) =>
              metric === 'value' ? formatAxisAmount(value) : `${Number(value.toFixed(1))}%`
            }
          />
          {metric === 'return' && (
            <ReferenceLine
              y={0}
              ifOverflow="extendDomain"
              stroke="var(--muted-foreground)"
              strokeOpacity={0.5}
            />
          )}
          <ChartTooltip
            cursor={{ stroke: 'var(--border)' }}
            content={<TrendTooltip baseCurrency={baseCurrency} />}
          />
          <Line
            dataKey={dataKey}
            type="linear"
            stroke="var(--color-value)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={{ r: 4, fill: 'var(--color-value)', stroke: 'var(--card)', strokeWidth: 2 }}
            activeDot={{ r: 5, fill: 'var(--color-value)', stroke: 'var(--card)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
    </div>
  )
}

export function PortfolioTrend({
  workspace,
  snapshots,
  liveRates,
  onBack,
  onCompare
}: {
  workspace: Workspace
  snapshots: WorkspaceSnapshot[]
  liveRates?: Record<string, number>
  onBack: () => void
  onCompare: (fromId: string, toId: string) => void
}) {
  const baseCurrency = workspace.baseCurrency
  const trend = buildPortfolioTrend(
    [
      ...snapshots.map((snapshot) => ({
        id: snapshot.id,
        time: Date.parse(snapshot.createdAt),
        point: { workspace: snapshot.workspace, rates: snapshot.exchangeRates?.rates }
      })),
      {
        id: LATEST_COMPARISON_POINT,
        time: Date.now(),
        point: { workspace, rates: liveRates }
      }
    ],
    baseCurrency
  )
  const first = trend.points[0]
  const last = trend.points.at(-1)!
  const periods = [...trend.periods].reverse()

  return (
    <PortfolioPage>
      <PortfolioPageHeader>
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon-sm" aria-label="返回时间机器" onClick={onBack}>
            <ArrowLeft data-icon="icon-only" />
          </Button>
          <h1 className="text-2xl font-semibold tracking-[-0.035em]">资产走势</h1>
        </div>
      </PortfolioPageHeader>

      {trend.periods.length === 0 ? (
        <TableEmptyState className="mt-5">创建快照后即可查看走势</TableEmptyState>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatPointTime(first.time)} 至今，共 {trend.points.length} 个时间点
          </p>

          {!trend.isComplete && (
            <Alert className="mt-3 border-border/70">
              <CircleAlert />
              <AlertTitle>部分持仓未计入</AlertTitle>
              <AlertDescription>
                有些时间点的持仓缺少价格或汇率，市值和收益率只统计能估值的持仓。
              </AlertDescription>
            </Alert>
          )}

          <section className="mt-4 grid gap-2 @min-[36rem]:grid-cols-2 @min-[68rem]:grid-cols-4">
            <TrendStat
              title={`当前市值 · ${baseCurrency}`}
              hint={
                <>
                  期间变动 <SignedValue value={trend.totalChange} compact />
                </>
              }
            >
              {last.value === undefined ? (
                '-'
              ) : (
                <span title={formatMoney(last.value, baseCurrency)}>
                  <MaskedAssetValue>{formatCompactAmount(last.value)}</MaskedAssetValue>
                </span>
              )}
            </TrendStat>
            <TrendStat title="累计收益率" hint="剔除买卖，只看市场涨跌">
              <SignedPercent value={trend.cumulativeReturnPercent} />
            </TrendStat>
            <TrendStat title="市场累计涨跌" hint="价格 + 汇率">
              <SignedValue value={trend.totalMarketChange} compact />
            </TrendStat>
            <TrendStat
              title={netFlowLabel(trend.totalTradeChange)}
              hint={
                isMeaningfulChange(trend.totalRebalanceAmount)
                  ? `另有 ${formatCompactAmount(trend.totalRebalanceAmount)} 内部调仓`
                  : '买卖带来的资金进出'
              }
            >
              <SignedValue value={trend.totalTradeChange} compact />
            </TrendStat>
          </section>

          <section className="mt-6">
            <TrendChart points={trend.points} baseCurrency={baseCurrency} />
          </section>

          <section className="mt-6">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 className="text-sm font-medium">分段明细</h2>
              <p className="text-xs text-muted-foreground">
                金额单位 {baseCurrency}，市值变动 = 市场涨跌 + 资金进出
              </p>
            </div>
            <div className="overflow-hidden rounded-sm border border-border/70 bg-card">
              <Table className="min-w-[960px] [&_.tabular-nums]:whitespace-nowrap">
                <TableHeader className="bg-muted/15">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-56">区间</TableHead>
                    <TableHead className="whitespace-nowrap text-right">市值 起点 → 终点</TableHead>
                    <TableHead className="whitespace-nowrap text-right">市场涨跌</TableHead>
                    <TableHead className="whitespace-nowrap text-right">区间收益率</TableHead>
                    <TableHead className="whitespace-nowrap text-right">资金进出</TableHead>
                    <TableHead className="whitespace-nowrap text-right">内部调仓</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periods.map((period) => (
                    <TableRow key={`${period.fromId}:${period.toId}`}>
                      <TableCell>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">
                            {pointLabel(period.fromId)} → {pointLabel(period.toId)}
                          </span>
                          <span className="truncate text-xs tabular-nums text-muted-foreground">
                            {formatPointTime(period.fromTime)} → {formatPointTime(period.toTime)}
                            {!period.isComplete && ' · 部分持仓未计入'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        <MaskedAssetValue>
                          {formatAmount(period.fromValue)} → {formatAmount(period.toValue)}
                        </MaskedAssetValue>
                      </TableCell>
                      <TableCell className="text-right">
                        <SignedValue value={period.marketChange} />
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        <SignedPercent value={period.returnPercent} />
                      </TableCell>
                      <TableCell className="text-right">
                        <SignedValue value={period.tradeChange} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {isMeaningfulChange(period.rebalanceAmount) ? (
                          <MaskedAssetValue>{formatAmount(period.rebalanceAmount)}</MaskedAssetValue>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onCompare(period.fromId, period.toId)}
                        >
                          <GitCompareArrows data-icon="inline-start" />
                          对比
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      )}
    </PortfolioPage>
  )
}
