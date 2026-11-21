import { useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowLeftRight,
  CircleAlert,
  ClipboardCopy,
  Info,
  Minus,
  TrendingDown,
  TrendingUp
} from 'lucide-react'
import { toast } from 'sonner'

import { reportPortfolioError } from '@/components/portfolio/feedback'
import { PortfolioPage, PortfolioPageHeader } from '@/components/portfolio/page-shell'
import {
  SortableTableHead,
  compareOptionalNumbers,
  useTableSort
} from '@/components/portfolio/sortable-table-head'
import { TableEmptyState } from '@/components/portfolio/table-empty-state'
import {
  TablePagination,
  useTablePagination
} from '@/components/portfolio/table-pagination'
import {
  MaskedAssetValue,
  formatAmount,
  formatExchangeRate,
  formatLastSyncedAt,
  shortSnapshotHash
} from '@/components/portfolio/view-helpers'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
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
  marketMeta,
  type Workspace,
  type WorkspaceSnapshot
} from '@/lib/portfolio'
import {
  comparePortfolios,
  comparisonUnavailableReasonLabels,
  describeComparison,
  formatComparisonReport,
  formatCompactAmount,
  formatSignedAmount,
  formatSignedPercent,
  isMeaningfulChange,
  marketEffect,
  positionChangeKindLabels,
  positionComparisonLabel,
  tradeEffect,
  type ComparisonDriver,
  type ComparisonPoint,
  type PortfolioComparison,
  type PositionChangeKind
} from '@/lib/portfolio-comparison'
import { cn } from '@/lib/utils'

export const LATEST_COMPARISON_POINT = 'latest'

type PointOption = {
  id: string
  label: string
  detail?: string
  point: ComparisonPoint
}

function pointOptions(
  workspace: Workspace,
  snapshots: WorkspaceSnapshot[],
  liveRates?: Record<string, number>
): PointOption[] {
  return [
    {
      id: LATEST_COMPARISON_POINT,
      label: '当前数据',
      point: { workspace, rates: liveRates }
    },
    ...[...snapshots]
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .map((snapshot) => ({
        id: snapshot.id,
        label: `快照 #${shortSnapshotHash(snapshot.id)}`,
        detail: formatLastSyncedAt(snapshot.createdAt),
        point: { workspace: snapshot.workspace, rates: snapshot.exchangeRates?.rates }
      }))
  ]
}

function optionText(option: PointOption): string {
  return option.detail ? `${option.label} · ${option.detail}` : option.label
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

function SignedPercent({ value }: { value: number | undefined }) {
  if (value === undefined) return <span className="text-muted-foreground">-</span>
  return (
    <span className={cn('tabular-nums', changeTone(value))}>
      {formatSignedPercent(value)}
    </span>
  )
}

function PointSelect({
  id,
  label,
  value,
  options,
  onChange
}: {
  id: string
  label: string
  value: string
  options: PointOption[]
  onChange: (value: string) => void
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {optionText(option)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h2 className="text-sm font-medium">{title}</h2>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function EquationTile({
  label,
  children,
  detail,
  emphasis
}: {
  label: string
  children: ReactNode
  detail?: ReactNode
  emphasis?: boolean
}) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-sm border border-border/60 px-3.5 py-3',
        emphasis ? 'bg-muted/40' : 'bg-background/40'
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1.5 truncate text-lg font-semibold tracking-[-0.02em] tabular-nums">
        {children}
      </p>
      {detail && (
        <p className="mt-1 truncate text-xs tabular-nums text-muted-foreground">{detail}</p>
      )}
    </div>
  )
}

function EquationOperator({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="hidden self-center text-lg text-muted-foreground @min-[56rem]:block"
    >
      {children}
    </span>
  )
}

function ComparisonConclusion({
  comparison,
  fromLabel,
  toLabel
}: {
  comparison: PortfolioComparison
  fromLabel: string
  toLabel: string
}) {
  const insights = describeComparison(comparison)
  const { effects } = comparison
  const Icon = comparison.direction === 'up'
    ? TrendingUp
    : comparison.direction === 'down'
      ? TrendingDown
      : Minus
  return (
    <div className="rounded-sm border border-border/70 bg-card p-5">
      <p className="truncate text-xs text-muted-foreground">
        {fromLabel} → {toLabel}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-sm',
            comparison.direction === 'up'
              ? 'bg-gain/15 text-gain'
              : comparison.direction === 'down'
                ? 'bg-loss/15 text-loss'
                : 'bg-muted text-muted-foreground'
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p
            className={cn(
              'text-xl font-semibold tracking-[-0.03em]',
              changeTone(comparison.change)
            )}
          >
            <MaskedAssetValue>{insights.headline}</MaskedAssetValue>
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            <MaskedAssetValue>{insights.summary}</MaskedAssetValue>
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-2 @min-[36rem]:grid-cols-2 @min-[56rem]:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] @min-[56rem]:gap-3">
        <EquationTile label="起点市值" detail={fromLabel}>
          <span title={formatMoney(comparison.fromValue, comparison.baseCurrency)}>
            <MaskedAssetValue>{formatCompactAmount(comparison.fromValue)}</MaskedAssetValue>
          </span>
        </EquationTile>
        <EquationOperator>+</EquationOperator>
        <EquationTile
          label="市场涨跌"
          detail={
            <>
              价格 <SignedValue value={effects.price} compact />
              {' · '}汇率 <SignedValue value={effects.exchangeRate} compact />
            </>
          }
        >
          <SignedValue value={comparison.marketChange} compact />
          {comparison.marketChangePercent !== undefined && (
            <span className="ml-1.5 text-sm font-normal">
              <SignedPercent value={comparison.marketChangePercent} />
            </span>
          )}
        </EquationTile>
        <EquationOperator>+</EquationOperator>
        <EquationTile
          label="买卖调仓"
          detail={
            <>
              买入 <SignedValue value={effects.bought} compact />
              {' · '}卖出 <SignedValue value={effects.sold} compact />
            </>
          }
        >
          <SignedValue value={comparison.tradeChange} compact />
        </EquationTile>
        <EquationOperator>=</EquationOperator>
        <EquationTile label="终点市值" detail={toLabel} emphasis>
          <span title={formatMoney(comparison.toValue, comparison.baseCurrency)}>
            <MaskedAssetValue>{formatCompactAmount(comparison.toValue)}</MaskedAssetValue>
          </span>
        </EquationTile>
      </div>
    </div>
  )
}

function DriverBlock({ driver }: { driver: ComparisonDriver }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium">{driver.title}</p>
        <SignedValue value={driver.value} compact className="font-semibold" />
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{driver.description}</p>
      {driver.items.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {driver.items.map((item) => (
            <li
              key={item.label}
              className="flex items-baseline justify-between gap-3 text-sm"
            >
              <span className="min-w-0 truncate">
                {item.label}
                {item.detail && (
                  <span className="ml-2 text-xs text-muted-foreground">{item.detail}</span>
                )}
              </span>
              <SignedValue value={item.value} compact className="shrink-0 text-xs" />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DriverGroup({
  title,
  value,
  drivers,
  emptyText
}: {
  title: string
  value: number
  drivers: ComparisonDriver[]
  emptyText: string
}) {
  return (
    <div className="rounded-sm border border-border/70 bg-card p-4">
      <div className="flex items-baseline justify-between gap-3 border-b border-border/70 pb-3">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <SignedValue value={value} compact className="text-base font-semibold" />
      </div>
      {drivers.length > 0 ? (
        <div className="divide-y divide-border/50 pt-3">
          {drivers.map((driver) => (
            <DriverBlock key={driver.key} driver={driver} />
          ))}
        </div>
      ) : (
        <p className="pt-3 text-sm text-muted-foreground">{emptyText}</p>
      )}
    </div>
  )
}

function ComparisonReasons({ comparison }: { comparison: PortfolioComparison }) {
  const insights = describeComparison(comparison)
  const marketDrivers = insights.drivers.filter(
    (driver) => driver.key === 'price' || driver.key === 'exchangeRate'
  )
  const tradeDrivers = insights.drivers.filter(
    (driver) => driver.key === 'bought' || driver.key === 'sold'
  )
  return (
    <section className="mt-6">
      <SectionTitle title="为什么会这样" />
      <div className="grid gap-3 @min-[56rem]:grid-cols-2">
        <DriverGroup
          title="市场带来的涨跌"
          value={comparison.marketChange}
          drivers={marketDrivers}
          emptyText="价格和汇率没有明显变化"
        />
        <DriverGroup
          title="你的买卖操作"
          value={comparison.tradeChange}
          drivers={tradeDrivers}
          emptyText="没有买入或卖出"
        />
      </div>
      {insights.notes.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
          {insights.notes.map((note) => (
            <li key={note} className="flex items-start gap-1.5">
              <Info className="mt-0.5 size-3 shrink-0" />
              {note}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function KindBadge({ kind }: { kind: PositionChangeKind }) {
  if (kind === 'unchanged') {
    return <span className="text-xs text-muted-foreground">-</span>
  }
  return (
    <Badge variant="outline" className="border-border/70 font-normal">
      {positionChangeKindLabels[kind]}
    </Badge>
  )
}

function PositionChangeTable({ comparison }: { comparison: PortfolioComparison }) {
  const [sort, onSort] = useTableSort<'impact' | 'change' | 'price'>('impact', 'desc')
  const rows = [...comparison.positions]
  if (sort.key !== 'impact') {
    rows.sort((left, right) =>
      compareOptionalNumbers(
        sort.key === 'change' ? left.change : left.priceChangePercent,
        sort.key === 'change' ? right.change : right.priceChangePercent,
        sort.direction
      )
    )
  }
  const pagination = useTablePagination(
    rows.length,
    [sort.key, sort.direction].join(':')
  )
  const visibleRows = rows.slice(pagination.startIndex, pagination.endIndex)

  if (rows.length === 0) return <TableEmptyState>两个时间点都没有持仓</TableEmptyState>

  return (
    <div className="overflow-hidden rounded-sm border border-border/70 bg-card">
      <Table className="min-w-[960px] [&_.tabular-nums]:whitespace-nowrap">
        <TableHeader className="bg-muted/15">
          <TableRow className="hover:bg-transparent">
            <TableHead className="min-w-48">持仓</TableHead>
            <TableHead className="whitespace-nowrap">操作</TableHead>
            <SortableTableHead
              sortKey="price"
              sort={sort}
              onSort={onSort}
              defaultDirection="desc"
              align="right"
              className="whitespace-nowrap"
            >
              价格涨跌
            </SortableTableHead>
            <TableHead className="whitespace-nowrap text-right">市值 起点 → 终点</TableHead>
            <SortableTableHead
              sortKey="change"
              sort={sort}
              onSort={onSort}
              defaultDirection="desc"
              align="right"
              className="whitespace-nowrap"
            >
              市值变动
            </SortableTableHead>
            <TableHead className="whitespace-nowrap text-right">其中市场</TableHead>
            <TableHead className="whitespace-nowrap text-right">其中买卖</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.map((position) => (
            <TableRow key={position.key}>
              <TableCell>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">
                    {positionComparisonLabel(position)}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {position.accountName} · {marketMeta[position.market].shortLabel} {position.symbol}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <KindBadge kind={position.kind} />
              </TableCell>
              <TableCell className="text-right">
                <SignedPercent value={position.priceChangePercent} />
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                <MaskedAssetValue>
                  {position.fromValue === undefined ? '-' : formatAmount(position.fromValue)}
                  {' → '}
                  {position.toValue === undefined ? '-' : formatAmount(position.toValue)}
                </MaskedAssetValue>
              </TableCell>
              {position.effects ? (
                <>
                  <TableCell className="text-right font-semibold">
                    <SignedValue value={position.change} />
                  </TableCell>
                  <TableCell className="text-right">
                    <SignedValue value={marketEffect(position.effects)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <SignedValue value={tradeEffect(position.effects)} />
                  </TableCell>
                </>
              ) : (
                <TableCell colSpan={3} className="text-right text-destructive">
                  <span className="inline-flex items-center gap-1">
                    <CircleAlert className="size-3.5" />
                    {comparisonUnavailableReasonLabels[position.unavailableReason!]}，未计入
                  </span>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePagination itemCount={rows.length} {...pagination} />
    </div>
  )
}

function AccountChangeTable({ comparison }: { comparison: PortfolioComparison }) {
  return (
    <div className="overflow-hidden rounded-sm border border-border/70 bg-card">
      <Table className="min-w-[760px] [&_.tabular-nums]:whitespace-nowrap">
        <TableHeader className="bg-muted/15">
          <TableRow className="hover:bg-transparent">
            <TableHead className="min-w-40">账户</TableHead>
            <TableHead className="whitespace-nowrap text-right">市值 起点 → 终点</TableHead>
            <TableHead className="whitespace-nowrap text-right">市值变动</TableHead>
            <TableHead className="whitespace-nowrap text-right">其中市场</TableHead>
            <TableHead className="whitespace-nowrap text-right">其中买卖</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {comparison.accounts.map((account) => (
            <TableRow key={account.id}>
              <TableCell>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium">{account.name}</span>
                  {account.unavailableCount > 0 && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {account.unavailableCount} 项未计入
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                <MaskedAssetValue>
                  {formatAmount(account.fromValue)} → {formatAmount(account.toValue)}
                </MaskedAssetValue>
              </TableCell>
              <TableCell className="text-right font-semibold">
                <SignedValue value={account.change} />
              </TableCell>
              <TableCell className="text-right">
                <SignedValue value={account.marketChange} />
              </TableCell>
              <TableCell className="text-right">
                <SignedValue value={account.tradeChange} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function CurrencyChangeTable({ comparison }: { comparison: PortfolioComparison }) {
  const currency = comparison.baseCurrency
  const rows = comparison.currencies.filter((item) => item.currency !== currency)
  if (rows.length === 0) return null
  return (
    <section className="mt-6">
      <SectionTitle title="汇率" hint={`影响金额单位 ${currency}`} />
      <div className="overflow-hidden rounded-sm border border-border/70 bg-card">
        <Table className="min-w-[640px] [&_.tabular-nums]:whitespace-nowrap">
          <TableHeader className="bg-muted/15">
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-28">币种</TableHead>
              <TableHead className="whitespace-nowrap text-right">汇率 起点 → 终点</TableHead>
              <TableHead className="whitespace-nowrap text-right">汇率变化</TableHead>
              <TableHead className="whitespace-nowrap text-right">对市值的影响</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item) => (
              <TableRow key={item.currency}>
                <TableCell className="font-medium">
                  {item.currency}/{currency}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {item.fromRate === undefined ? '-' : formatExchangeRate(item.fromRate)}
                  {' → '}
                  {item.toRate === undefined ? '-' : formatExchangeRate(item.toRate)}
                </TableCell>
                <TableCell className="text-right">
                  <SignedPercent value={item.rateChangePercent} />
                </TableCell>
                <TableCell className="text-right font-semibold">
                  <SignedValue value={item.exchangeRateEffect} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

export function SnapshotComparison({
  workspace,
  snapshots,
  liveRates,
  initialFromId,
  initialToId,
  onBack
}: {
  workspace: Workspace
  snapshots: WorkspaceSnapshot[]
  liveRates?: Record<string, number>
  initialFromId: string
  initialToId: string
  onBack: () => void
}) {
  const [fromId, setFromId] = useState(initialFromId)
  const [toId, setToId] = useState(initialToId)
  const options = pointOptions(workspace, snapshots, liveRates)
  const from = options.find((option) => option.id === fromId) ?? options.at(-1)!
  const to = options.find((option) => option.id === toId) ?? options[0]
  const samePoint = from.id === to.id
  const comparison = samePoint
    ? null
    : comparePortfolios(from.point, to.point, workspace.baseCurrency)
  const currency = workspace.baseCurrency

  async function copyReport(): Promise<void> {
    if (!comparison) return
    try {
      await navigator.clipboard.writeText(
        formatComparisonReport(comparison, { from: optionText(from), to: optionText(to) })
      )
      toast.success('对比报告已复制')
    } catch (error) {
      reportPortfolioError(error, '复制失败')
    }
  }

  return (
    <PortfolioPage>
      <PortfolioPageHeader>
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon-sm" aria-label="返回时间机器" onClick={onBack}>
            <ArrowLeft data-icon="icon-only" />
          </Button>
          <h1 className="text-2xl font-semibold tracking-[-0.035em]">快照对比</h1>
        </div>
        <Button variant="secondary" disabled={!comparison} onClick={() => void copyReport()}>
          <ClipboardCopy data-icon="inline-start" />
          复制报告
        </Button>
      </PortfolioPageHeader>

      <section className="mt-5 flex flex-col gap-3 @min-[40rem]:flex-row @min-[40rem]:items-end">
        <PointSelect
          id="comparison-from"
          label="起点"
          value={from.id}
          options={options}
          onChange={setFromId}
        />
        <Button
          variant="ghost"
          size="icon"
          className="self-center @min-[40rem]:self-end"
          aria-label="交换起点和终点"
          title="交换起点和终点"
          onClick={() => {
            setFromId(to.id)
            setToId(from.id)
          }}
        >
          <ArrowLeftRight data-icon="icon-only" />
        </Button>
        <PointSelect
          id="comparison-to"
          label="终点"
          value={to.id}
          options={options}
          onChange={setToId}
        />
      </section>

      {!comparison ? (
        <TableEmptyState className="mt-5">请选择两个不同的时间点</TableEmptyState>
      ) : (
        <>
          <section className="mt-5">
            <ComparisonConclusion
              comparison={comparison}
              fromLabel={from.label}
              toLabel={to.label}
            />
          </section>

          {!comparison.isComplete && (
            <Alert className="mt-3 border-border/70">
              <CircleAlert />
              <AlertTitle>部分持仓未计入</AlertTitle>
              <AlertDescription>
                {comparison.unavailableCount} 项持仓在起点或终点缺少价格或汇率，对比只统计两个时间点都能估值的持仓。
              </AlertDescription>
            </Alert>
          )}

          <ComparisonReasons comparison={comparison} />

          <section className="mt-6">
            <SectionTitle
              title="持仓明细"
              hint={`金额单位 ${currency}，市值变动 = 其中市场 + 其中买卖`}
            />
            <PositionChangeTable key={`${from.id}:${to.id}`} comparison={comparison} />
          </section>

          {comparison.accounts.length > 0 && (
            <section className="mt-6">
              <SectionTitle title="账户" hint={`金额单位 ${currency}`} />
              <AccountChangeTable comparison={comparison} />
            </section>
          )}

          <CurrencyChangeTable comparison={comparison} />
        </>
      )}
    </PortfolioPage>
  )
}
