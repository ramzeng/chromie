import { Ellipsis, Pencil, Plus, RefreshCw, Tags, Trash2 } from 'lucide-react'

import {
  AssetDistributionCharts,
  createPositionAllocationItems
} from '@/components/portfolio/asset-allocation-chart'
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
import { ValueSummaryCard } from '@/components/portfolio/value-summary-card'
import { TagBadge, UntaggedBadge } from '@/components/portfolio/tag-badge'
import {
  AccountTypeIcon,
  MaskedAssetValue,
  formatAmount,
  formatLastSyncedAt,
  type ExchangeRateView
} from '@/components/portfolio/view-helpers'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import {
  formatMoney,
  formatNumber,
  marketMeta,
  type Account,
  type Position,
  type Tag
} from '@/lib/portfolio'
import { valuePositions } from '@/lib/valuation'

export type AccountSyncState = { status: 'syncing' }

function TagBadges({ tagIds, tags }: { tagIds: string[]; tags: Tag[] }) {
  const selectedTags = tagIds.flatMap((tagId) => {
    const tag = tags.find((item) => item.id === tagId)
    return tag ? [tag] : []
  })

  if (!selectedTags.length) return <span className="text-muted-foreground">-</span>

  return (
    <div className="flex flex-wrap gap-1">
      {selectedTags.map((tag) => (
        <TagBadge key={tag.id} tag={tag} />
      ))}
    </div>
  )
}

function PositionTable({
  positions,
  tags,
  readOnly,
  allowPositionMutation,
  baseCurrency,
  exchangeRates,
  onManageTags,
  onEditPosition,
  onDeletePosition
}: {
  positions: Position[]
  tags: Tag[]
  readOnly: boolean
  allowPositionMutation: boolean
  baseCurrency: string
  exchangeRates: ExchangeRateView
  onManageTags: (position: Position) => void
  onEditPosition: (position: Position) => void
  onDeletePosition: (position: Position) => void
}) {
  const [sort, onSort] = useTableSort<'percentage'>('percentage', 'desc')
  const valuation = valuePositions(positions, baseCurrency, exchangeRates.snapshot?.rates)
  const canCalculatePercentage =
    valuation.isComplete &&
    valuation.totalConvertedMarketValue !== undefined &&
    valuation.totalConvertedMarketValue !== 0
  const sortedPositions = [...positions].sort((left, right) =>
    compareOptionalNumbers(
      valuation.byPositionId.get(left.id)?.convertedMarketValue,
      valuation.byPositionId.get(right.id)?.convertedMarketValue,
      sort.direction
    )
  )
  const paginationResetKey = [
    sort.key,
    sort.direction,
    ...positions.map((position) => position.id)
  ].join(':')
  const pagination = useTablePagination(
    sortedPositions.length,
    paginationResetKey
  )
  const visiblePositions = sortedPositions.slice(
    pagination.startIndex,
    pagination.endIndex
  )

  if (positions.length === 0) {
    return <TableEmptyState>暂无持仓</TableEmptyState>
  }

  return (
    <div className="overflow-hidden rounded-sm border border-border/70 bg-card">
      <Table className="min-w-[900px] [&_.tabular-nums]:whitespace-nowrap">
        <TableHeader className="bg-muted/15">
          <TableRow className="hover:bg-transparent">
            <TableHead className="min-w-28">资产代码</TableHead>
            <TableHead className="min-w-36">资产名称</TableHead>
            <TableHead className="min-w-32">标签</TableHead>
            <TableHead className="whitespace-nowrap text-right">资产数量</TableHead>
            <TableHead className="whitespace-nowrap text-right">当前价格</TableHead>
            <TableHead className="whitespace-nowrap text-right">当前市值</TableHead>
            <TableHead className="whitespace-nowrap text-right">折算市值</TableHead>
            <SortableTableHead
              sortKey="percentage"
              sort={sort}
              onSort={onSort}
              defaultDirection="desc"
              align="right"
              className="whitespace-nowrap"
            >
              市值占比
            </SortableTableHead>
            {!readOnly && <TableHead className="w-16" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visiblePositions.map((position) => {
            const positionValuation = valuation.byPositionId.get(position.id)
            return (
              <TableRow key={position.id}>
                <TableCell className="min-w-0">
                  <span className="block truncate font-semibold">
                    {marketMeta[position.market].shortLabel}.{position.symbol}
                  </span>
                </TableCell>
                <TableCell className="truncate text-muted-foreground">{position.name}</TableCell>
                <TableCell><TagBadges tagIds={position.tagIds} tags={tags} /></TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  <MaskedAssetValue>{formatNumber(position.quantity)}</MaskedAssetValue>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {position.price === undefined ? '-' : (
                    <MaskedAssetValue>{formatAmount(position.price)}</MaskedAssetValue>
                  )}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {positionValuation?.marketValue === undefined ? '-' : (
                    <MaskedAssetValue>
                      {formatMoney(positionValuation.marketValue, position.currency)}
                    </MaskedAssetValue>
                  )}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {positionValuation?.convertedMarketValue === undefined ? '-' : (
                    <MaskedAssetValue>
                      {formatMoney(positionValuation.convertedMarketValue, baseCurrency)}
                    </MaskedAssetValue>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {!canCalculatePercentage || positionValuation?.convertedMarketValue === undefined
                    ? '-'
                    : `${formatAmount(
                        positionValuation.convertedMarketValue /
                          valuation.totalConvertedMarketValue! * 100
                      )}%`}
                </TableCell>
                {!readOnly && (
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`${position.symbol} 操作`}>
                          <Ellipsis data-icon="icon-only" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-20">
                        <DropdownMenuGroup>
                          <DropdownMenuItem onSelect={() => onManageTags(position)}>
                            <Tags className="size-4" />
                            标签
                          </DropdownMenuItem>
                          {allowPositionMutation && (
                            <DropdownMenuItem onSelect={() => onEditPosition(position)}>
                              <Pencil className="size-4" />
                              编辑
                            </DropdownMenuItem>
                          )}
                          {allowPositionMutation && (
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => onDeletePosition(position)}
                            >
                              <Trash2 className="size-4" />
                              删除
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <TablePagination itemCount={sortedPositions.length} {...pagination} />
    </div>
  )
}

export function AccountDetail({
  account,
  tags,
  readOnly,
  baseCurrency,
  exchangeRates,
  onAddPosition,
  onEditAccount,
  onSync,
  syncState,
  onManagePositionTags,
  onEditPosition,
  onDeletePosition
}: {
  account: Account
  tags: Tag[]
  readOnly: boolean
  baseCurrency: string
  exchangeRates: ExchangeRateView
  onAddPosition: () => void
  onEditAccount: () => void
  onSync: () => Promise<void>
  syncState?: AccountSyncState
  onManagePositionTags: (position: Position) => void
  onEditPosition: (position: Position) => void
  onDeletePosition: (position: Position) => void
}) {
  const syncing = syncState?.status === 'syncing'
  const syncHint = syncing
    ? '正在同步账户数据'
    : account.sync?.lastSyncedAt
      ? `同步账户数据 · 上次同步于 ${formatLastSyncedAt(account.sync.lastSyncedAt)}`
      : '同步账户数据'

  return (
    <PortfolioPage>
      <PortfolioPageHeader>
        <div className="flex min-w-0 flex-[1_1_20rem] items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center">
            <AccountTypeIcon
              type={account.type}
              className={account.type === 'Futu' ? 'size-12' : 'size-11'}
            />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-[-0.035em]">
              {account.name}
            </h1>
            <div className="mt-1.5 min-h-6">
              {account.tagIds.length > 0 ? (
                <TagBadges tagIds={account.tagIds} tags={tags} />
              ) : (
                <UntaggedBadge />
              )}
            </div>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
          {!readOnly && account.sync && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    onClick={() => void onSync()}
                    disabled={syncing}
                    aria-busy={syncing}
                    aria-label={syncHint}
                  >
                    {syncing ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <RefreshCw data-icon="inline-start" />
                    )}
                    同步
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{syncHint}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {!readOnly && !account.sync && (
            <Button variant="secondary" onClick={onAddPosition}>
              <Plus data-icon="inline-start" />
              添加持仓
            </Button>
          )}
          {!readOnly && (
            <Button onClick={onEditAccount}>
              <Pencil data-icon="inline-start" />
              编辑
            </Button>
          )}
        </div>
      </PortfolioPageHeader>

      <div className="mt-5">
        <ValueSummaryCard
          positions={account.positions}
          baseCurrency={baseCurrency}
          exchangeRates={exchangeRates}
        />
        {account.positions.length > 0 && (
          <div className="mt-6">
            <AssetDistributionCharts
              positions={account.positions}
              breakdownItems={createPositionAllocationItems(account.positions)}
              breakdownTitle="持仓市值分布"
              breakdownDimensionLabel="持仓"
              baseCurrency={baseCurrency}
              rates={exchangeRates.snapshot?.rates}
            />
          </div>
        )}
        <div className="mt-6">
          <PositionTable
            positions={account.positions}
            tags={tags}
            readOnly={readOnly}
            allowPositionMutation={!readOnly && !account.sync}
            baseCurrency={baseCurrency}
            exchangeRates={exchangeRates}
            onManageTags={onManagePositionTags}
            onEditPosition={onEditPosition}
            onDeletePosition={onDeletePosition}
          />
        </div>
      </div>
    </PortfolioPage>
  )
}
