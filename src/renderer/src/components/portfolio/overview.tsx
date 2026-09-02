import {
  AssetDistributionCharts
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
  type Account,
  type Workspace
} from '@/lib/portfolio'
import { valuePositions } from '@/lib/valuation'

function AccountTable({
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

  return (
    <TooltipProvider delayDuration={300}>
      <div className="overflow-hidden rounded-sm border border-border/70 bg-card">
        <Table className="min-w-[900px] [&_.tabular-nums]:whitespace-nowrap">
          <TableHeader className="bg-muted/15">
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-32">标签</TableHead>
              <TableHead className="min-w-44">资产账户</TableHead>
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
            {rows.map(({ account, accountTags, marketValues, valuation }) => (
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
  const tagItems = workspace.tags.map((tag) => ({
    id: tag.id,
    label: tag.name,
    positions: workspace.accounts.flatMap((account) =>
      account.positions.filter((position) => position.tagIds.includes(tag.id))
    )
  }))
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
        {workspace.accounts.length > 0 ? (
          <div className="flex flex-col gap-6">
            <AssetDistributionCharts
              positions={positions}
              breakdownItems={tagItems}
              breakdownTitle="标签市值分布"
              breakdownDimensionLabel="标签"
              baseCurrency={workspace.baseCurrency}
              rates={exchangeRates.snapshot?.rates}
            />
            <AccountTable
              accounts={workspace.accounts}
              tags={workspace.tags}
              baseCurrency={workspace.baseCurrency}
              exchangeRates={exchangeRates}
              onOpen={onOpenAccount}
            />
          </div>
        ) : (
          <TableEmptyState>暂无资产账户</TableEmptyState>
        )}
      </section>
    </PortfolioPage>
  )
}
