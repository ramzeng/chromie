import { Plus, WalletCards } from 'lucide-react'

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
import { ValueSummaryCard } from '@/components/portfolio/value-summary-card'
import {
  AccountTypeIcon,
  MaskedAssetValue,
  formatAmount,
  type ExchangeRateView
} from '@/components/portfolio/view-helpers'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty'
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
  type AssetAccount,
  type Workspace
} from '@/lib/portfolio'
import { valuePositions } from '@/lib/valuation'

function AssetAccountTable({
  accounts,
  accountGroups,
  baseCurrency,
  exchangeRates,
  onOpen
}: {
  accounts: AssetAccount[]
  accountGroups: Workspace['accountGroups']
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
      accountGroupName: accountGroups.find((accountGroup) =>
        accountGroup.assetAccountIds.includes(account.id)
      )?.name ?? '未分组',
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
              <TableHead className="min-w-32">账户分组</TableHead>
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
            {rows.map(({ account, accountGroupName, marketValues, valuation }) => (
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
                <TableCell className="truncate text-muted-foreground">
                  {accountGroupName}
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
  readOnly,
  onCreateAssetAccount,
  onOpenAssetAccount
}: {
  workspace: Workspace
  exchangeRates: ExchangeRateView
  readOnly: boolean
  onCreateAssetAccount: () => void
  onOpenAssetAccount: (id: string) => void
}) {
  const positions = workspace.assetAccounts.flatMap(
    (assetAccount) => assetAccount.positions
  )
  const positionsById = new Map(
    positions.map((position) => [position.id, position])
  )
  const positionGroupItems = workspace.positionGroups.map((group) => ({
    id: group.id,
    label: group.name,
    positions: group.positionIds.flatMap((positionId) => {
      const position = positionsById.get(positionId)
      return position ? [position] : []
    })
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
        {workspace.assetAccounts.length > 0 ? (
          <div className="flex flex-col gap-6">
            <AssetDistributionCharts
              positions={positions}
              breakdownItems={positionGroupItems}
              breakdownTitle="持仓分组市值分布"
              breakdownDimensionLabel="持仓分组"
              baseCurrency={workspace.baseCurrency}
              rates={exchangeRates.snapshot?.rates}
            />
            <AssetAccountTable
              accounts={workspace.assetAccounts}
              accountGroups={workspace.accountGroups}
              baseCurrency={workspace.baseCurrency}
              exchangeRates={exchangeRates}
              onOpen={onOpenAssetAccount}
            />
          </div>
        ) : (
          <Empty className="min-h-64 border bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <WalletCards data-icon="inline-start" />
              </EmptyMedia>
              <EmptyTitle>暂无资产账户</EmptyTitle>
              <EmptyDescription>
                支持富途牛牛、中银国际、欧易、支付宝、招商银行、中国银行和通用账户
              </EmptyDescription>
            </EmptyHeader>
            {!readOnly && (
              <EmptyContent>
                <Button onClick={onCreateAssetAccount}>
                  <Plus data-icon="inline-start" />
                  添加资产账户
                </Button>
              </EmptyContent>
            )}
          </Empty>
        )}
      </section>
    </PortfolioPage>
  )
}
