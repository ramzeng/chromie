import { useState } from 'react'
import {
  ChartLine,
  Ellipsis,
  Eye,
  GitCompareArrows,
  History,
  Plus,
  RefreshCw,
  Trash2
} from 'lucide-react'

import {
  MaskedAssetValue,
  formatLastSyncedAt,
  shortSnapshotHash,
  type ExchangeRateView
} from '@/components/portfolio/view-helpers'
import {
  SortableTableHead,
  compareOptionalNumbers,
  compareText,
  useTableSort
} from '@/components/portfolio/sortable-table-head'
import {
  TablePagination,
  useTablePagination
} from '@/components/portfolio/table-pagination'
import { PortfolioPage, PortfolioPageHeader } from '@/components/portfolio/page-shell'
import { PortfolioTrend } from '@/components/portfolio/portfolio-trend'
import {
  LATEST_COMPARISON_POINT,
  SnapshotComparison
} from '@/components/portfolio/snapshot-comparison'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
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
  type WorkspaceSnapshot,
  type Workspace
} from '@/lib/portfolio'
import { cn } from '@/lib/utils'
import { valuePositions } from '@/lib/valuation'

export function TimeMachine({
  workspace,
  snapshots,
  readOnly,
  selectedSnapshotId,
  liveExchangeRates,
  creating,
  onCreate,
  onViewLatest,
  onViewSnapshot,
  onDeleteSnapshot
}: {
  workspace: Workspace
  snapshots: WorkspaceSnapshot[]
  readOnly: boolean
  selectedSnapshotId: string | null
  liveExchangeRates: ExchangeRateView
  creating: boolean
  onCreate: () => Promise<void>
  onViewLatest: () => void
  onViewSnapshot: (snapshotId: string) => void
  onDeleteSnapshot: (snapshot: WorkspaceSnapshot) => void
}) {
  const [showTrend, setShowTrend] = useState(false)
  const [comparison, setComparison] = useState<{
    fromId: string
    toId: string
  } | null>(null)
  const [sort, onSort] = useTableSort<
    'workspace' | 'time' | 'accounts' | 'positions' | 'value'
  >('time', 'desc')
  const rows = [
    {
      id: 'latest',
      kind: 'latest' as const,
      workspace,
      createdAt: null,
      rates: liveExchangeRates.snapshot?.rates
    },
    ...snapshots.map((snapshot) => ({
      id: snapshot.id,
      kind: 'snapshot' as const,
      workspace: snapshot.workspace,
      createdAt: snapshot.createdAt,
      rates: snapshot.exchangeRates?.rates,
      snapshot
    }))
  ].map((row) => {
    const positions = row.workspace.accounts.flatMap(
      (account) => account.positions
    )
    return {
      ...row,
      positionCount: positions.length,
      valuation: valuePositions(
        positions,
        row.workspace.baseCurrency,
        row.rates
      )
    }
  })
  rows.sort((left, right) => {
    if (sort.key === 'workspace') {
      return compareText(left.workspace.name, right.workspace.name, sort.direction)
    }
    if (sort.key === 'time') {
      return compareOptionalNumbers(
        left.createdAt ? new Date(left.createdAt).getTime() : Number.MAX_SAFE_INTEGER,
        right.createdAt ? new Date(right.createdAt).getTime() : Number.MAX_SAFE_INTEGER,
        sort.direction
      )
    }
    if (sort.key === 'accounts') {
      return compareOptionalNumbers(
        left.workspace.accounts.length,
        right.workspace.accounts.length,
        sort.direction
      )
    }
    if (sort.key === 'positions') {
      return compareOptionalNumbers(left.positionCount, right.positionCount, sort.direction)
    }
    return compareOptionalNumbers(
      left.valuation.totalConvertedMarketValue,
      right.valuation.totalConvertedMarketValue,
      sort.direction
    )
  })
  const paginationResetKey = [
    sort.key,
    sort.direction,
    'latest',
    ...snapshots.map((snapshot) => snapshot.id)
  ].join(':')
  const pagination = useTablePagination(
    rows.length,
    paginationResetKey
  )
  const visibleRows = rows.slice(pagination.startIndex, pagination.endIndex)
  const latestSnapshot = snapshots.reduce<WorkspaceSnapshot | undefined>(
    (latest, snapshot) =>
      !latest || Date.parse(snapshot.createdAt) > Date.parse(latest.createdAt)
        ? snapshot
        : latest,
    undefined
  )

  if (comparison) {
    return (
      <SnapshotComparison
        workspace={workspace}
        snapshots={snapshots}
        liveRates={liveExchangeRates.snapshot?.rates}
        initialFromId={comparison.fromId}
        initialToId={comparison.toId}
        onBack={() => setComparison(null)}
      />
    )
  }

  if (showTrend) {
    return (
      <PortfolioTrend
        workspace={workspace}
        snapshots={snapshots}
        liveRates={liveExchangeRates.snapshot?.rates}
        onBack={() => setShowTrend(false)}
        onCompare={(fromId, toId) => setComparison({ fromId, toId })}
      />
    )
  }

  return (
    <PortfolioPage>
      <PortfolioPageHeader>
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.035em]">时间机器</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            disabled={!latestSnapshot}
            title={latestSnapshot ? undefined : '创建快照后即可查看走势'}
            onClick={() => setShowTrend(true)}
          >
            <ChartLine data-icon="inline-start" />
            走势
          </Button>
          <Button
            variant="secondary"
            disabled={!latestSnapshot}
            title={latestSnapshot ? undefined : '创建快照后即可对比'}
            onClick={() =>
              latestSnapshot &&
              setComparison({
                fromId: latestSnapshot.id,
                toId: LATEST_COMPARISON_POINT
              })
            }
          >
            <GitCompareArrows data-icon="inline-start" />
            对比
          </Button>
          <Button
            onClick={() => void onCreate()}
            disabled={readOnly || selectedSnapshotId !== null || creating}
            aria-busy={creating}
            title={
              readOnly
                ? '示例工作区为只读'
                : selectedSnapshotId
                  ? '请先切换到当前数据'
                  : undefined
            }
          >
            {creating ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Plus data-icon="inline-start" />
            )}
            {creating ? '创建中…' : '创建快照'}
          </Button>
        </div>
      </PortfolioPageHeader>

      <section className="mt-5 overflow-hidden rounded-sm border border-border/70 bg-card">
        <Table className="min-w-[760px] [&_.tabular-nums]:whitespace-nowrap">
          <TableHeader className="bg-muted/15">
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-36">数据</TableHead>
              <SortableTableHead
                sortKey="workspace"
                sort={sort}
                onSort={onSort}
                className="min-w-36"
              >
                工作区名称
              </SortableTableHead>
              <SortableTableHead
                sortKey="time"
                sort={sort}
                onSort={onSort}
                defaultDirection="desc"
                className="whitespace-nowrap"
              >
                时间点
              </SortableTableHead>
              <SortableTableHead
                sortKey="accounts"
                sort={sort}
                onSort={onSort}
                defaultDirection="desc"
                align="right"
                className="whitespace-nowrap"
              >
                账户数
              </SortableTableHead>
              <SortableTableHead
                sortKey="positions"
                sort={sort}
                onSort={onSort}
                defaultDirection="desc"
                align="right"
                className="whitespace-nowrap"
              >
                持仓数
              </SortableTableHead>
              <SortableTableHead
                sortKey="value"
                sort={sort}
                onSort={onSort}
                defaultDirection="desc"
                align="right"
                className="whitespace-nowrap"
              >
                折算市值
              </SortableTableHead>
              <TableHead className="whitespace-nowrap">状态</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row) => {
              const isSelected = row.kind === 'latest'
                ? selectedSnapshotId === null
                : selectedSnapshotId === row.id
              return (
                <TableRow key={row.id} data-state={isSelected ? 'selected' : undefined}>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={cn(
                          'grid size-8 shrink-0 place-items-center rounded-sm',
                          row.kind === 'latest'
                            ? 'bg-secondary text-secondary-foreground'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {row.kind === 'latest' ? (
                          <RefreshCw className="size-4" />
                        ) : (
                          <History className="size-4" />
                        )}
                      </span>
                      <span className="truncate font-medium">
                        {row.kind === 'latest'
                          ? '当前数据'
                          : `快照 #${shortSnapshotHash(row.id)}`}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="truncate text-muted-foreground">
                    {row.workspace.name}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {row.createdAt ? formatLastSyncedAt(row.createdAt) : '当前数据'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.workspace.accounts.length}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.positionCount}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {row.valuation.isComplete &&
                    row.valuation.totalConvertedMarketValue !== undefined ? (
                      <MaskedAssetValue>
                        {formatMoney(
                          row.valuation.totalConvertedMarketValue,
                          row.workspace.baseCurrency
                        )}
                      </MaskedAssetValue>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={isSelected ? 'default' : 'secondary'}
                    >
                      {isSelected ? '正在查看' : row.kind === 'latest' ? '当前' : '只读'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isSelected && row.kind === 'latest'}
                          aria-label={`${row.kind === 'latest' ? '当前数据' : `快照 #${shortSnapshotHash(row.id)}`}操作`}
                        >
                          <Ellipsis data-icon="icon-only" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-20">
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            disabled={isSelected}
                            onSelect={() =>
                              row.kind === 'latest'
                                ? onViewLatest()
                                : onViewSnapshot(row.id)
                            }
                          >
                            <Eye className="size-4" />
                            {isSelected ? '当前数据' : '查看'}
                          </DropdownMenuItem>
                          {row.kind === 'snapshot' && (
                            <DropdownMenuItem
                              onSelect={() =>
                                setComparison({
                                  fromId: row.id,
                                  toId: LATEST_COMPARISON_POINT
                                })
                              }
                            >
                              <GitCompareArrows className="size-4" />
                              与当前数据对比
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuGroup>
                        {row.kind === 'snapshot' && !readOnly && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => onDeleteSnapshot(row.snapshot)}
                              >
                                <Trash2 className="size-4" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
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
        <TablePagination itemCount={rows.length} {...pagination} />
      </section>

    </PortfolioPage>
  )
}
