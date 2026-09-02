import {
  AssetDistributionCharts,
  createPositionAllocationItems
} from '@/components/portfolio/asset-allocation-chart'
import {
  createCurrencyMarketValues,
  portfolioDisplayCurrencies
} from '@/components/portfolio/portfolio-view-model'
import {
  PortfolioPage,
  PortfolioPageHeader
} from '@/components/portfolio/page-shell'
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
import {
  AccountTypeIcon,
  MaskedAssetValue,
  formatAmount,
  type ExchangeRateView
} from '@/components/portfolio/view-helpers'
import { TagBadge } from '@/components/portfolio/tag-badge'
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
  type Workspace
} from '@/lib/portfolio'
import { valuePositions } from '@/lib/valuation'

export function AccountTable({
  accounts,
  tags,
  baseCurrency,
  exchangeRates,
  onOpen
}: {
  accounts: Account[]
  tags: Workspace['tags']
  baseCurrency: string
  exchangeRates: ExchangeRateView
  onOpen: (id: string) => void
}) {
  const [sort, onSort] = useTableSort<'percentage'>(
    'percentage',
    'desc'
  )
  const rows = accounts
    .map((account) => ({
      account,
      accountTags: account.tagIds.flatMap((tagId) => {
        const tag = tags.find((item) => item.id === tagId)
        return tag ? [tag] : []
      }),
      marketValues: createCurrencyMarketValues(account.positions),
      valuation: valuePositions(
        account.positions,
        baseCurrency,
        exchangeRates.snapshot?.rates
      )
    }))
  const hasMissingRate = rows.some(({ valuation }) => !valuation.isComplete)
  const totalConvertedMarketValue = rows.reduce(
    (total, { valuation }) => total + (valuation.totalConvertedMarketValue ?? 0),
    0
  )
  const canCalculatePercentage =
    !hasMissingRate && totalConvertedMarketValue !== 0
  rows.sort((left, right) =>
    compareOptionalNumbers(
      canCalculatePercentage && left.valuation.isComplete
        ? left.valuation.totalConvertedMarketValue
        : undefined,
      canCalculatePercentage && right.valuation.isComplete
        ? right.valuation.totalConvertedMarketValue
        : undefined,
      sort.direction
    )
  )
  const paginationResetKey = [
    sort.key,
    sort.direction,
    ...accounts.map((account) => account.id)
  ].join(':')
  const pagination = useTablePagination(
    rows.length,
    paginationResetKey
  )
  const visibleRows = rows.slice(pagination.startIndex, pagination.endIndex)

  return (
    <TooltipProvider delayDuration={300}>
      <div className="overflow-hidden rounded-sm border border-border/70 bg-card">
        <Table className="min-w-[900px] [&_.tabular-nums]:whitespace-nowrap">
          <TableHeader className="bg-muted/15">
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-44">账户</TableHead>
              <TableHead className="min-w-32">标签</TableHead>
              {portfolioDisplayCurrencies.map((currency) => (
                <TableHead
                  key={currency}
                  className="whitespace-nowrap text-right"
                >
                  {currency} 市值
                </TableHead>
              ))}
              <TableHead className="whitespace-nowrap text-right">
                折算市值
              </TableHead>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map(({ account, accountTags, marketValues, valuation }) => (
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
                <TableCell>
                  <div className="flex min-w-0 items-center gap-2">
                    <AccountTypeIcon
                      type={account.type}
                      className="size-4 shrink-0"
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="min-w-0 truncate font-semibold">
                          {account.name}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{account.name}</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
                <TableCell>
                  {accountTags.length ? (
                    <div className="flex flex-wrap gap-1">
                      {accountTags.map((tag) => (
                        <TagBadge key={tag.id} tag={tag} />
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                {portfolioDisplayCurrencies.map((currency) => {
                  const marketValue = marketValues.get(currency)!
                  return (
                    <TableCell
                      key={currency}
                      className="text-right tabular-nums"
                    >
                      {marketValue.hasValue
                        ? (
                            <MaskedAssetValue>
                              {formatAmount(marketValue.value)}
                            </MaskedAssetValue>
                          )
                        : '-'}
                    </TableCell>
                  )
                })}
                <TableCell className="text-right font-semibold tabular-nums">
                  {valuation.isComplete &&
                  valuation.totalConvertedMarketValue !== undefined
                    ? (
                        <MaskedAssetValue>
                          {formatMoney(
                            valuation.totalConvertedMarketValue,
                            baseCurrency
                          )}
                        </MaskedAssetValue>
                      )
                    : '-'}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {!canCalculatePercentage ||
                  valuation.totalConvertedMarketValue === undefined
                    ? '-'
                    : `${formatAmount(
                        valuation.totalConvertedMarketValue /
                          totalConvertedMarketValue *
                          100
                      )}%`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination itemCount={rows.length} {...pagination} />
      </div>
    </TooltipProvider>
  )
}

type PortfolioPositionRow = {
  account: Account
  position: Position
}

function PositionTagBadges({
  tagIds,
  tags
}: {
  tagIds: string[]
  tags: Workspace['tags']
}) {
  const selectedTags = tagIds.flatMap((tagId) => {
    const tag = tags.find((item) => item.id === tagId)
    return tag ? [tag] : []
  })

  if (!selectedTags.length) {
    return <span className="text-muted-foreground">-</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {selectedTags.map((tag) => (
        <TagBadge key={tag.id} tag={tag} />
      ))}
    </div>
  )
}

export function PortfolioPositionTable({
  rows,
  tags,
  baseCurrency,
  exchangeRates,
  onOpenAccount
}: {
  rows: PortfolioPositionRow[]
  tags: Workspace['tags']
  baseCurrency: string
  exchangeRates: ExchangeRateView
  onOpenAccount: (accountId: string) => void
}) {
  const [sort, onSort] = useTableSort<'percentage'>('percentage', 'desc')
  const positions = rows.map(({ position }) => position)
  const valuation = valuePositions(
    positions,
    baseCurrency,
    exchangeRates.snapshot?.rates
  )
  const canCalculatePercentage =
    valuation.isComplete &&
    valuation.totalConvertedMarketValue !== undefined &&
    valuation.totalConvertedMarketValue !== 0
  const sortedRows = [...rows].sort((left, right) =>
    compareOptionalNumbers(
      valuation.byPositionId.get(left.position.id)?.convertedMarketValue,
      valuation.byPositionId.get(right.position.id)?.convertedMarketValue,
      sort.direction
    )
  )
  const paginationResetKey = [
    sort.key,
    sort.direction,
    ...rows.map(({ account, position }) => `${account.id}:${position.id}`)
  ].join(':')
  const pagination = useTablePagination(
    sortedRows.length,
    paginationResetKey
  )
  const visibleRows = sortedRows.slice(
    pagination.startIndex,
    pagination.endIndex
  )

  if (!rows.length) {
    return <TableEmptyState>暂无持仓</TableEmptyState>
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="overflow-hidden rounded-sm border border-border/70 bg-card">
        <Table className="min-w-[1080px] [&_.tabular-nums]:whitespace-nowrap">
          <TableHeader className="bg-muted/15">
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-40">账户</TableHead>
              <TableHead className="min-w-28">资产代码</TableHead>
              <TableHead className="min-w-36">资产名称</TableHead>
              <TableHead className="min-w-32">标签</TableHead>
              <TableHead className="whitespace-nowrap text-right">
                资产数量
              </TableHead>
              <TableHead className="whitespace-nowrap text-right">
                当前价格
              </TableHead>
              <TableHead className="whitespace-nowrap text-right">
                当前市值
              </TableHead>
              <TableHead className="whitespace-nowrap text-right">
                折算市值
              </TableHead>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map(({ account, position }) => {
              const positionValuation = valuation.byPositionId.get(position.id)
              return (
                <TableRow
                  key={`${account.id}:${position.id}`}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() => onOpenAccount(account.id)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    onOpenAccount(account.id)
                  }}
                >
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-2">
                      <AccountTypeIcon
                        type={account.type}
                        className="size-4 shrink-0"
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="min-w-0 truncate font-medium">
                            {account.name}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{account.name}</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">
                    {marketMeta[position.market].shortLabel}.{position.symbol}
                  </TableCell>
                  <TableCell className="truncate text-muted-foreground">
                    {position.name}
                  </TableCell>
                  <TableCell>
                    <PositionTagBadges
                      tagIds={position.tagIds}
                      tags={tags}
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    <MaskedAssetValue>
                      {formatNumber(position.quantity)}
                    </MaskedAssetValue>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {position.price === undefined ? '-' : (
                      <MaskedAssetValue>
                        {formatAmount(position.price)}
                      </MaskedAssetValue>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {positionValuation?.marketValue === undefined ? '-' : (
                      <MaskedAssetValue>
                        {formatMoney(
                          positionValuation.marketValue,
                          position.currency
                        )}
                      </MaskedAssetValue>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {positionValuation?.convertedMarketValue === undefined
                      ? '-'
                      : (
                          <MaskedAssetValue>
                            {formatMoney(
                              positionValuation.convertedMarketValue,
                              baseCurrency
                            )}
                          </MaskedAssetValue>
                        )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {!canCalculatePercentage ||
                    positionValuation?.convertedMarketValue === undefined
                      ? '-'
                      : `${formatAmount(
                          positionValuation.convertedMarketValue /
                            valuation.totalConvertedMarketValue! *
                            100
                        )}%`}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <TablePagination itemCount={sortedRows.length} {...pagination} />
      </div>
    </TooltipProvider>
  )
}

export function Overview({
  workspace,
  exchangeRates,
  onOpenAccount
}: {
  workspace: Workspace
  exchangeRates: ExchangeRateView
  onOpenAccount: (id: string) => void
}) {
  const positions = workspace.accounts.flatMap(
    (account) => account.positions
  )
  const positionRows = workspace.accounts.flatMap((account) =>
    account.positions.map((position) => ({ account, position }))
  )
  return (
    <PortfolioPage>
      <PortfolioPageHeader>
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="truncate text-2xl font-semibold tracking-[-0.035em]">
            资产概览
          </h1>
        </div>
      </PortfolioPageHeader>

      <section className="mt-5">
        <ValueSummaryCard
          positions={positions}
          baseCurrency={workspace.baseCurrency}
          exchangeRates={exchangeRates}
        />
      </section>

      <section className="mt-6">
        <div className="flex flex-col gap-6">
          {positions.length > 0 && (
            <AssetDistributionCharts
              positions={positions}
              breakdownItems={createPositionAllocationItems(
                positions,
                workspace.accounts
              )}
              breakdownTitle="持仓市值分布"
              breakdownDimensionLabel="持仓"
              baseCurrency={workspace.baseCurrency}
              rates={exchangeRates.snapshot?.rates}
            />
          )}
          <PortfolioPositionTable
            rows={positionRows}
            tags={workspace.tags}
            baseCurrency={workspace.baseCurrency}
            exchangeRates={exchangeRates}
            onOpenAccount={onOpenAccount}
          />
        </div>
      </section>
    </PortfolioPage>
  )
}
