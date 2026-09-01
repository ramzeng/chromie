import {
  Ellipsis,
  Layers2,
  ListPlus,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Wrench
} from 'lucide-react'

import {
  AssetDistributionCharts,
  createAccountAllocationItems,
  createPositionAllocationItems
} from '@/components/portfolio/asset-allocation-chart'
import {
  SortableTableHead,
  compareOptionalNumbers,
  useTableSort
} from '@/components/portfolio/sortable-table-head'
import {
  createCurrencyMarketValues,
  portfolioDisplayCurrencies
} from '@/components/portfolio/portfolio-view-model'
import {
  PortfolioPage,
  PortfolioPageHeader
} from '@/components/portfolio/page-shell'
import { ValueSummaryCard } from '@/components/portfolio/value-summary-card'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty'
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
  formatMoney,
  formatNumber,
  marketMeta,
  type AccountGroup,
  type AssetAccount,
  type Position,
  type PositionGroup,
  type Workspace
} from '@/lib/portfolio'
import { valuePositions } from '@/lib/valuation'

export type AccountSyncState = {
  status: 'syncing'
}

function PositionTable({
  positions,
  readOnly,
  baseCurrency,
  exchangeRates,
  onEditPosition,
  onDeletePosition
}: {
  positions: Position[]
  readOnly: boolean
  baseCurrency: string
  exchangeRates: ExchangeRateView
  onEditPosition: (position: Position) => void
  onDeletePosition: (position: Position) => void
}) {
  const [sort, onSort] = useTableSort<'percentage'>(
    'percentage',
    'desc'
  )
  const valuation = valuePositions(
    positions,
    baseCurrency,
    exchangeRates.snapshot?.rates
  )
  const canCalculatePercentage =
    valuation.isComplete &&
    valuation.totalConvertedMarketValue !== undefined &&
    valuation.totalConvertedMarketValue !== 0
  const sortedPositions = [...positions].sort((left, right) => {
    return compareOptionalNumbers(
      valuation.byPositionId.get(left.id)?.convertedMarketValue,
      valuation.byPositionId.get(right.id)?.convertedMarketValue,
      sort.direction
    )
  })

  return (
    <div>
      <div className="overflow-hidden rounded-sm border border-border/70 bg-card">
        <Table className="min-w-[760px] [&_.tabular-nums]:whitespace-nowrap">
          <TableHeader className="bg-muted/15">
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-28">资产代码</TableHead>
              <TableHead className="min-w-36">资产名称</TableHead>
              <TableHead className="whitespace-nowrap text-right">资产数量</TableHead>
              <TableHead className="whitespace-nowrap text-right">当前价格</TableHead>
              <TableHead className="whitespace-nowrap text-right">当前市值</TableHead>
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
              {!readOnly && <TableHead className="w-16" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.length ? (
              sortedPositions.map((position) => {
                const positionValuation = valuation.byPositionId.get(position.id)
                return (
                  <TableRow key={position.id}>
                    <TableCell className="min-w-0">
                      <span className="block truncate font-semibold">
                        {marketMeta[position.market].shortLabel}.{position.symbol}
                      </span>
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground">
                      {position.name}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      <MaskedAssetValue>{formatNumber(position.quantity)}</MaskedAssetValue>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {position.price === undefined
                        ? '-'
                        : <MaskedAssetValue>{formatAmount(position.price)}</MaskedAssetValue>}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {positionValuation?.marketValue === undefined
                        ? '-'
                        : <MaskedAssetValue>
                            {formatMoney(positionValuation.marketValue, position.currency)}
                          </MaskedAssetValue>}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {positionValuation?.convertedMarketValue === undefined
                        ? '-'
                        : <MaskedAssetValue>
                            {formatMoney(positionValuation.convertedMarketValue, baseCurrency)}
                          </MaskedAssetValue>}
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
                    {!readOnly && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`${position.symbol} 操作`}
                            >
                              <Ellipsis data-icon="icon-only" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-20">
                            <DropdownMenuGroup>
                              <DropdownMenuItem onSelect={() => onEditPosition(position)}>
                                <Pencil className="size-4" />
                                编辑
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => onDeletePosition(position)}
                              >
                                <Trash2 className="size-4" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={readOnly ? 7 : 8} className="p-0">
                  <Empty className="min-h-32 gap-2 border-0 p-3 md:p-3">
                    <EmptyHeader className="gap-1">
                      <EmptyTitle className="text-xs font-normal text-muted-foreground">
                        暂无持仓
                      </EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export function AssetAccountDetail({
  account,
  readOnly,
  baseCurrency,
  exchangeRates,
  onAddPosition,
  onSync,
  syncState,
  onEditPosition,
  onDeletePosition
}: {
  account: AssetAccount
  readOnly: boolean
  baseCurrency: string
  exchangeRates: ExchangeRateView
  onAddPosition: () => void
  onSync: () => Promise<void>
  syncState?: AccountSyncState
  onEditPosition: (position: Position) => void
  onDeletePosition: (position: Position) => void
}) {
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
            <div className="flex min-w-0 items-center gap-2.5">
              <h1 className="truncate text-2xl font-semibold tracking-[-0.035em]">
                {account.name}
              </h1>
            </div>
            <dl className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
              <div className="flex items-center gap-1.5">
                <Wrench
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
                <dt className="shrink-0 text-muted-foreground">更新方式</dt>
                <dd className="ml-0.5 font-medium text-foreground">
                  {account.sync ? '自动同步' : '手动维护'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {!readOnly && account.sync && (
            <>
              <span className="mr-1 text-xs tabular-nums text-muted-foreground">
                {account.sync.lastSyncedAt
                  ? `最近同步 ${formatLastSyncedAt(account.sync.lastSyncedAt)}`
                  : '尚未同步'}
              </span>
              <Button
                variant="outline"
                onClick={() => void onSync()}
                disabled={syncState?.status === 'syncing'}
                aria-busy={syncState?.status === 'syncing'}
              >
                {syncState?.status === 'syncing' ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <RefreshCw data-icon="inline-start" />
                )}
                同步
              </Button>
            </>
          )}
          {!readOnly && !account.sync && (
            <Button onClick={onAddPosition}>
              <Plus data-icon="inline-start" />
              添加持仓
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
            readOnly={readOnly || Boolean(account.sync)}
            baseCurrency={baseCurrency}
            exchangeRates={exchangeRates}
            onEditPosition={onEditPosition}
            onDeletePosition={onDeletePosition}
          />
        </div>
      </div>
    </PortfolioPage>
  )
}

function AccountGroupAccountTable({
  accounts,
  baseCurrency,
  exchangeRates
}: {
  accounts: AssetAccount[]
  baseCurrency: string
  exchangeRates: ExchangeRateView
}) {
  const [sort, onSort] = useTableSort<'percentage'>(
    'percentage',
    'desc'
  )
  const valuedAccounts = accounts
    .map((account) => {
      const marketValues = createCurrencyMarketValues(account.positions)
      return {
        account,
        marketValues,
        valuation: valuePositions(
          account.positions,
          baseCurrency,
          exchangeRates.snapshot?.rates
        )
      }
    })
  valuedAccounts.sort((left, right) => {
    return compareOptionalNumbers(
      left.valuation.totalConvertedMarketValue,
      right.valuation.totalConvertedMarketValue,
      sort.direction
    )
  })
  const hasMissingRate = valuedAccounts.some(
    ({ valuation }) => !valuation.isComplete
  )
  const totalConvertedMarketValue = valuedAccounts.reduce(
    (total, { valuation }) => total + (valuation.totalConvertedMarketValue ?? 0),
    0
  )
  const canCalculatePercentage = !hasMissingRate && totalConvertedMarketValue !== 0

  return (
    <div>
      <div className="overflow-hidden rounded-sm border border-border/70 bg-card">
        <Table className="min-w-[680px] [&_.tabular-nums]:whitespace-nowrap">
          <TableHeader className="bg-muted/15">
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-40">资产账户</TableHead>
              {portfolioDisplayCurrencies.map((currency) => (
                <TableHead key={currency} className="whitespace-nowrap text-right">
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
            {valuedAccounts.map(({ account, marketValues, valuation }) => (
              <TableRow key={account.id}>
                <TableCell>
                  <div className="flex min-w-0 items-center gap-2">
                    <AccountTypeIcon type={account.type} className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {account.name}
                    </span>
                  </div>
                </TableCell>
                {portfolioDisplayCurrencies.map((currency) => {
                  const marketValue = marketValues.get(currency)!
                  return (
                    <TableCell key={currency} className="text-right tabular-nums">
                      {marketValue.hasValue
                        ? <MaskedAssetValue>{formatAmount(marketValue.value)}</MaskedAssetValue>
                        : '-'}
                    </TableCell>
                  )
                })}
                <TableCell className="text-right font-semibold tabular-nums">
                  {valuation.isComplete && valuation.totalConvertedMarketValue !== undefined
                    ? <MaskedAssetValue>
                        {formatMoney(valuation.totalConvertedMarketValue, baseCurrency)}
                      </MaskedAssetValue>
                    : '-'}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {!canCalculatePercentage || valuation.totalConvertedMarketValue === undefined
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
    </div>
  )
}

export function AccountGroupDetail({
  group,
  assetAccounts,
  readOnly,
  baseCurrency,
  exchangeRates,
  onManageAccounts
}: {
  group: AccountGroup
  assetAccounts: AssetAccount[]
  readOnly: boolean
  baseCurrency: string
  exchangeRates: ExchangeRateView
  onManageAccounts: () => void
}) {
  const accounts = group.assetAccountIds.flatMap((assetAccountId) => {
    const account = assetAccounts.find((item) => item.id === assetAccountId)
    return account ? [account] : []
  })
  const positions = accounts.flatMap((account) => account.positions)

  return (
    <PortfolioPage>
      <PortfolioPageHeader>
        <div className="min-w-0 flex-[1_1_20rem]">
          <h1 className="truncate text-2xl font-semibold tracking-[-0.035em]">
            {group.name}
          </h1>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {!readOnly && (
            <Button onClick={onManageAccounts}>
              <ListPlus data-icon="inline-start" />
              管理资产账户
            </Button>
          )}
        </div>
      </PortfolioPageHeader>

      <div className="mt-5">
        <ValueSummaryCard
          positions={positions}
          baseCurrency={baseCurrency}
          exchangeRates={exchangeRates}
        />
        {accounts.length ? (
          <>
            <div className="mt-6">
              <AssetDistributionCharts
                positions={positions}
                breakdownItems={createAccountAllocationItems(accounts)}
                breakdownTitle="资产账户市值分布"
                breakdownDimensionLabel="资产账户"
                baseCurrency={baseCurrency}
                rates={exchangeRates.snapshot?.rates}
              />
            </div>
            <div className="mt-6">
              <AccountGroupAccountTable
                accounts={accounts}
                baseCurrency={baseCurrency}
                exchangeRates={exchangeRates}
              />
            </div>
          </>
        ) : (
          <Empty className="mt-5 min-h-64 border bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Layers2 data-icon="inline-start" />
              </EmptyMedia>
              <EmptyTitle>为账户分组添加资产账户</EmptyTitle>
              <EmptyDescription>
                可选择多个资产账户统一查看，资产账户和持仓仍在原位置独立维护
              </EmptyDescription>
            </EmptyHeader>
            {!readOnly && (
              <EmptyContent>
                <Button onClick={onManageAccounts}>
                  <ListPlus data-icon="inline-start" />
                  选择资产账户
                </Button>
              </EmptyContent>
            )}
          </Empty>
        )}
      </div>
    </PortfolioPage>
  )
}

type GroupPositionItem = {
  positionId: string
  account: AssetAccount
  position: Position
}

function GroupPositionTable({
  items,
  accountGroups,
  baseCurrency,
  exchangeRates
}: {
  items: GroupPositionItem[]
  accountGroups: Workspace['accountGroups']
  baseCurrency: string
  exchangeRates: ExchangeRateView
}) {
  const [sort, onSort] = useTableSort<'percentage'>('percentage', 'desc')
  const positions = items.map((item) => item.position)
  const valuation = valuePositions(
    positions,
    baseCurrency,
    exchangeRates.snapshot?.rates
  )
  const canCalculatePercentage =
    valuation.isComplete &&
    valuation.totalConvertedMarketValue !== undefined &&
    valuation.totalConvertedMarketValue !== 0
  const sortedItems = [...items].sort((left, right) => {
    return compareOptionalNumbers(
      valuation.byPositionId.get(left.position.id)?.convertedMarketValue,
      valuation.byPositionId.get(right.position.id)?.convertedMarketValue,
      sort.direction
    )
  })

  return (
    <div>
      <div className="overflow-hidden rounded-sm border border-border/70 bg-card">
        <Table className="min-w-[900px] [&_.tabular-nums]:whitespace-nowrap">
          <TableHeader className="bg-muted/15">
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-32">账户分组</TableHead>
              <TableHead className="min-w-36">资产账户</TableHead>
              <TableHead className="min-w-28">资产代码</TableHead>
              <TableHead className="min-w-28">资产名称</TableHead>
              <TableHead className="whitespace-nowrap text-right">资产数量</TableHead>
              <TableHead className="whitespace-nowrap text-right">当前价格</TableHead>
              <TableHead className="whitespace-nowrap text-right">当前市值</TableHead>
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
            {items.length ? (
              sortedItems.map(({ positionId, account, position }) => {
                const positionValuation = valuation.byPositionId.get(position.id)
                return (
                  <TableRow key={positionId}>
                    <TableCell className="truncate text-muted-foreground">
                      {accountGroups.find((accountGroup) =>
                        accountGroup.assetAccountIds.includes(account.id)
                      )?.name ?? '未分组'}
                    </TableCell>
                    <TableCell className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <AccountTypeIcon type={account.type} className="size-4" />
                        <span className="min-w-0 flex-1 truncate text-sm">{account.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-0">
                      <span className="block truncate font-semibold">
                        {marketMeta[position.market].shortLabel}.{position.symbol}
                      </span>
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground">
                      {position.name}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      <MaskedAssetValue>{formatNumber(position.quantity)}</MaskedAssetValue>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {position.price === undefined
                        ? '-'
                        : <MaskedAssetValue>{formatAmount(position.price)}</MaskedAssetValue>}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {positionValuation?.marketValue === undefined
                        ? '-'
                        : <MaskedAssetValue>
                            {formatMoney(positionValuation.marketValue, position.currency)}
                          </MaskedAssetValue>}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {positionValuation?.convertedMarketValue === undefined
                        ? '-'
                        : <MaskedAssetValue>
                            {formatMoney(positionValuation.convertedMarketValue, baseCurrency)}
                          </MaskedAssetValue>}
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
              })
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={9} className="p-0">
                  <Empty className="min-h-32 gap-2 border-0 p-3 md:p-3">
                    <EmptyHeader className="gap-1">
                      <EmptyTitle className="text-xs font-normal text-muted-foreground">
                        暂无持仓
                      </EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export function PositionGroupDetail({
  group,
  assetAccounts,
  accountGroups,
  readOnly,
  baseCurrency,
  exchangeRates,
  onManagePositions
}: {
  group: PositionGroup
  assetAccounts: AssetAccount[]
  accountGroups: Workspace['accountGroups']
  readOnly: boolean
  baseCurrency: string
  exchangeRates: ExchangeRateView
  onManagePositions: () => void
}) {
  const items = group.positionIds.flatMap((positionId) => {
    const account = assetAccounts.find((item) =>
      item.positions.some((position) => position.id === positionId)
    )
    const position = account?.positions.find((item) => item.id === positionId)
    return account && position ? [{ positionId, account, position }] : []
  })
  const positions = items.map((item) => item.position)

  return (
    <PortfolioPage>
      <PortfolioPageHeader>
        <div className="min-w-0 flex-[1_1_20rem]">
          <h1 className="truncate text-2xl font-semibold tracking-[-0.035em]">
            {group.name}
          </h1>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {!readOnly && (
            <Button onClick={onManagePositions}>
              <ListPlus data-icon="inline-start" />
              管理持仓
            </Button>
          )}
        </div>
      </PortfolioPageHeader>

      <div className="mt-5">
        <ValueSummaryCard
          positions={positions}
          baseCurrency={baseCurrency}
          exchangeRates={exchangeRates}
        />
        {items.length > 0 && (
          <div className="mt-6">
            <AssetDistributionCharts
              positions={positions}
              breakdownItems={createPositionAllocationItems(positions)}
              breakdownTitle="持仓市值分布"
              breakdownDimensionLabel="持仓"
              baseCurrency={baseCurrency}
              rates={exchangeRates.snapshot?.rates}
            />
          </div>
        )}
        <div className="mt-6">
          <GroupPositionTable
            items={items}
            accountGroups={accountGroups}
            baseCurrency={baseCurrency}
            exchangeRates={exchangeRates}
          />
        </div>
      </div>
    </PortfolioPage>
  )
}
