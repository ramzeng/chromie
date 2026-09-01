import {
  Download,
  Ellipsis,
  Folder,
  Layers2,
  ListPlus,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  WalletCards,
  Wrench
} from 'lucide-react'

import { ValueSummaryCard } from '@/components/portfolio/overview'
import {
  AccountTypeIcon,
  MaskedAssetValue,
  compareOptionalValuesDescending,
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
  assetAccountTypeLabels,
  formatMoney,
  formatNumber,
  marketMeta,
  type AccountGroup,
  type AssetAccount,
  type Position,
  type PositionGroup,
  type ProductAccount
} from '@/lib/portfolio'
import { valuePositions } from '@/lib/valuation'

export type AccountSyncState = {
  status: 'syncing'
}

function PositionTable({
  positions,
  readOnly,
  anchorCurrency,
  exchangeRates,
  onEditPosition,
  onDeletePosition
}: {
  positions: Position[]
  readOnly: boolean
  anchorCurrency: string
  exchangeRates: ExchangeRateView
  onEditPosition: (position: Position) => void
  onDeletePosition: (position: Position) => void
}) {
  const valuation = valuePositions(
    positions,
    anchorCurrency,
    exchangeRates.snapshot?.rates
  )
  const canCalculatePercentage =
    valuation.isComplete &&
    valuation.totalAnchoredMarketValue !== undefined &&
    valuation.totalAnchoredMarketValue !== 0
  const sortedPositions = [...positions].sort((left, right) =>
    compareOptionalValuesDescending(
      valuation.byPositionId.get(left.id)?.anchoredMarketValue,
      valuation.byPositionId.get(right.id)?.anchoredMarketValue
    )
  )

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold tracking-[-0.02em]">持仓分布</h2>
      <div className="overflow-hidden rounded-lg border border-border/70 bg-card">
        <Table className="min-w-[900px] table-fixed">
          <TableHeader className="bg-muted/15">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[25%]">名称代码</TableHead>
              <TableHead className="w-[12%] text-right">数量</TableHead>
              <TableHead className="w-[14%] text-right">当前价格</TableHead>
              <TableHead className="w-[19%] text-right">市值</TableHead>
              <TableHead className="w-[19%] text-right">锚定市值</TableHead>
              <TableHead className="w-[7%] text-right">占比</TableHead>
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
                      <p className="truncate font-semibold">
                        {marketMeta[position.market].shortLabel}.{position.symbol}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{position.name}</p>
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
                      {positionValuation?.anchoredMarketValue === undefined
                        ? '-'
                        : <MaskedAssetValue>
                            {formatMoney(positionValuation.anchoredMarketValue, anchorCurrency)}
                          </MaskedAssetValue>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {!canCalculatePercentage ||
                      positionValuation?.anchoredMarketValue === undefined
                        ? '-'
                        : `${formatAmount(
                            positionValuation.anchoredMarketValue /
                              valuation.totalAnchoredMarketValue! *
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
                              <Ellipsis className="size-4" />
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
                <TableCell colSpan={readOnly ? 6 : 7} className="p-0">
                  <Empty className="min-h-32 gap-2 border-0 p-3 md:p-3">
                    <EmptyHeader className="gap-1">
                      <EmptyTitle className="text-sm">暂无持仓</EmptyTitle>
                      <EmptyDescription>添加持仓后将在这里展示</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

export function AssetAccountDetail({
  account,
  readOnly,
  anchorCurrency,
  exchangeRates,
  imageExporting,
  onExportImage,
  onAddPosition,
  onSync,
  syncState,
  onEditPosition,
  onDeletePosition
}: {
  account: AssetAccount
  readOnly: boolean
  anchorCurrency: string
  exchangeRates: ExchangeRateView
  imageExporting: boolean
  onExportImage: () => Promise<void>
  onAddPosition: () => void
  onSync: () => Promise<void>
  syncState?: AccountSyncState
  onEditPosition: (position: Position) => void
  onDeletePosition: (position: Position) => void
}) {
  return (
    <div className="mx-auto w-[calc(50%+36rem)] max-w-full px-4 pb-8 pt-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-[1_1_20rem] items-center gap-4">
          <span
            className="grid size-12 shrink-0 place-items-center"
          >
            <AccountTypeIcon
              type={account.type}
              className={account.type === 'Futu' ? 'size-12' : 'size-11'}
            />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-semibold tracking-[-0.04em]">
              {account.name}
            </h1>
            <dl className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
              <div className="flex items-center gap-1.5">
                <Wrench
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
                <dt className="shrink-0 text-muted-foreground">维护模式</dt>
                <dd className="ml-0.5 font-medium text-foreground">
                  {account.sync ? '自动' : '手动'}
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
          <Button
            variant="outline"
            onClick={() => void onExportImage()}
            disabled={imageExporting}
            aria-busy={imageExporting}
          >
            {imageExporting ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Download data-icon="inline-start" />
            )}
            {imageExporting ? '导出中…' : '导出图片'}
          </Button>
        </div>
      </header>

      <div className="mt-6 grid gap-6">
        <ValueSummaryCard
          positions={account.positions}
          anchorCurrency={anchorCurrency}
          exchangeRates={exchangeRates}
        />
        {account.positions.length ? (
          <PositionTable
            positions={account.positions}
            readOnly={readOnly || Boolean(account.sync)}
            anchorCurrency={anchorCurrency}
            exchangeRates={exchangeRates}
            onEditPosition={onEditPosition}
            onDeletePosition={onDeletePosition}
          />
        ) : (
          <Empty className="min-h-64 border bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <WalletCards data-icon="inline-start" />
              </EmptyMedia>
              <EmptyTitle>{account.sync ? '同步资产账户' : '为资产账户添加持仓'}</EmptyTitle>
              <EmptyDescription>
                {account.sync ? '同步后，可以查看币种、市值和持仓分布' : '添加持仓后，可以查看币种、市值和持仓分布'}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {!readOnly && (
                <Button
                  variant={account.sync ? 'outline' : 'default'}
                  onClick={() => {
                    if (account.sync) void onSync()
                    else onAddPosition()
                  }}
                  disabled={syncState?.status === 'syncing'}
                  aria-busy={account.sync && syncState?.status === 'syncing'}
                >
                  {account.sync ? (
                    syncState?.status === 'syncing' ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <RefreshCw data-icon="inline-start" />
                    )
                  ) : (
                    <Plus data-icon="inline-start" />
                  )}
                  {account.sync ? '同步' : '添加持仓'}
                </Button>
              )}
            </EmptyContent>
          </Empty>
        )}
      </div>
    </div>
  )
}

function AccountGroupAccountTable({
  accounts,
  readOnly,
  anchorCurrency,
  exchangeRates,
  onRemove,
  removingAccountIds
}: {
  accounts: AssetAccount[]
  readOnly: boolean
  anchorCurrency: string
  exchangeRates: ExchangeRateView
  onRemove: (assetAccountId: string) => Promise<void>
  removingAccountIds: ReadonlySet<string>
}) {
  const valuedAccounts = accounts
    .map((account) => ({
      account,
      valuation: valuePositions(
        account.positions,
        anchorCurrency,
        exchangeRates.snapshot?.rates
      )
    }))
    .sort((left, right) =>
      compareOptionalValuesDescending(
        left.valuation.totalAnchoredMarketValue,
        right.valuation.totalAnchoredMarketValue
      )
    )

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold tracking-[-0.02em]">资产账户分布</h2>
      <div className="overflow-hidden rounded-lg border border-border/70 bg-card">
        <Table className="min-w-[1080px] table-fixed">
          <TableHeader className="bg-muted/15">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[30%]">资产账户</TableHead>
              <TableHead className="w-[18%]">账户类型</TableHead>
              <TableHead className="w-[18%]">维护模式</TableHead>
              <TableHead className="w-[12%] text-right">持仓</TableHead>
              <TableHead className="w-[20%] text-right">锚定市值</TableHead>
              {!readOnly && <TableHead className="w-16" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {valuedAccounts.map(({ account, valuation }) => {
              const removing = removingAccountIds.has(account.id)
              return (
                <TableRow key={account.id}>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-2">
                      <AccountTypeIcon type={account.type} className="size-4" />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {account.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {assetAccountTypeLabels[account.type]}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {account.sync ? '自动' : '手动'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {account.positions.length}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {valuation.totalAnchoredMarketValue === undefined
                      ? '-'
                      : (
                          <MaskedAssetValue>
                            {formatMoney(valuation.totalAnchoredMarketValue, anchorCurrency)}
                          </MaskedAssetValue>
                        )}
                  </TableCell>
                  {!readOnly && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={removing}
                        aria-busy={removing}
                        aria-label={
                          removing
                            ? `正在将 ${account.name} 移出资产分组`
                            : `将 ${account.name} 移出资产分组`
                        }
                        onClick={() => void onRemove(account.id)}
                      >
                        {removing ? <Spinner data-icon="icon-only" /> : <Trash2 />}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

export function AccountGroupDetail({
  group,
  assetAccounts,
  readOnly,
  anchorCurrency,
  exchangeRates,
  onManageAccounts,
  onRemoveAccount,
  removingAccountIds
}: {
  group: AccountGroup
  assetAccounts: AssetAccount[]
  readOnly: boolean
  anchorCurrency: string
  exchangeRates: ExchangeRateView
  onManageAccounts: () => void
  onRemoveAccount: (assetAccountId: string) => Promise<void>
  removingAccountIds: ReadonlySet<string>
}) {
  const accounts = group.assetAccountIds.flatMap((assetAccountId) => {
    const account = assetAccounts.find((item) => item.id === assetAccountId)
    return account ? [account] : []
  })
  const positions = accounts.flatMap((account) => account.positions)

  return (
    <div className="mx-auto w-[calc(50%+36rem)] max-w-full px-4 pb-8 pt-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-[1_1_20rem] items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
            <Layers2 className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-semibold tracking-[-0.04em]">
              {group.name}
            </h1>
          </div>
        </div>
        {!readOnly && (
          <Button onClick={onManageAccounts}>
            <ListPlus data-icon="inline-start" />
            管理账户
          </Button>
        )}
      </header>

      <div className="mt-6">
        <ValueSummaryCard
          positions={positions}
          anchorCurrency={anchorCurrency}
          exchangeRates={exchangeRates}
        />
      </div>

      {accounts.length ? (
        <div className="mt-6 grid gap-6">
          <AccountGroupAccountTable
            accounts={accounts}
            readOnly={readOnly}
            anchorCurrency={anchorCurrency}
            exchangeRates={exchangeRates}
            onRemove={onRemoveAccount}
            removingAccountIds={removingAccountIds}
          />
        </div>
      ) : (
        <Empty className="mt-6 min-h-64 border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Layers2 data-icon="inline-start" />
            </EmptyMedia>
            <EmptyTitle>为资产分组添加资产账户</EmptyTitle>
            <EmptyDescription>
              可选择多个资产账户统一查看，账户和持仓仍在原位置独立维护
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {!readOnly && (
              <Button onClick={onManageAccounts}>
                <ListPlus data-icon="inline-start" />
                选择账户
              </Button>
            )}
          </EmptyContent>
        </Empty>
      )}
    </div>
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
  readOnly,
  anchorCurrency,
  exchangeRates,
  onRemove,
  removingPositionIds
}: {
  items: GroupPositionItem[]
  accountGroups: ProductAccount['accountGroups']
  readOnly: boolean
  anchorCurrency: string
  exchangeRates: ExchangeRateView
  onRemove: (positionId: string) => Promise<void>
  removingPositionIds: ReadonlySet<string>
}) {
  const positions = items.map((item) => item.position)
  const valuation = valuePositions(
    positions,
    anchorCurrency,
    exchangeRates.snapshot?.rates
  )
  const canCalculatePercentage =
    valuation.isComplete &&
    valuation.totalAnchoredMarketValue !== undefined &&
    valuation.totalAnchoredMarketValue !== 0
  const sortedItems = [...items].sort((left, right) =>
    compareOptionalValuesDescending(
      valuation.byPositionId.get(left.position.id)?.anchoredMarketValue,
      valuation.byPositionId.get(right.position.id)?.anchoredMarketValue
    )
  )

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold tracking-[-0.02em]">持仓分布</h2>
      <div className="overflow-hidden rounded-lg border border-border/70 bg-card">
        <Table className="min-w-[1080px] table-fixed">
          <TableHeader className="bg-muted/15">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[13%]">资产账户</TableHead>
              <TableHead className="w-[10%]">资产分组</TableHead>
              <TableHead className="w-[18%]">名称代码</TableHead>
              <TableHead className="w-[8%] text-right">数量</TableHead>
              <TableHead className="w-[11%] text-right">当前价格</TableHead>
              <TableHead className="w-[15%] text-right">市值</TableHead>
              <TableHead className="w-[15%] text-right">锚定市值</TableHead>
              <TableHead className="w-[6%] text-right">占比</TableHead>
              {!readOnly && <TableHead className="w-16" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length ? (
              sortedItems.map(({ positionId, account, position }) => {
                const positionValuation = valuation.byPositionId.get(position.id)
                const removing = removingPositionIds.has(positionId)
                return (
                  <TableRow key={positionId}>
                    <TableCell className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <AccountTypeIcon type={account.type} className="size-4" />
                        <span className="min-w-0 flex-1 truncate text-sm">{account.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground">
                      {accountGroups.find((accountGroup) =>
                        accountGroup.assetAccountIds.includes(account.id)
                      )?.name ?? '-'}
                    </TableCell>
                    <TableCell className="min-w-0">
                      <p className="truncate font-semibold">
                        {marketMeta[position.market].shortLabel}.{position.symbol}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{position.name}</p>
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
                      {positionValuation?.anchoredMarketValue === undefined
                        ? '-'
                        : <MaskedAssetValue>
                            {formatMoney(positionValuation.anchoredMarketValue, anchorCurrency)}
                          </MaskedAssetValue>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {!canCalculatePercentage ||
                      positionValuation?.anchoredMarketValue === undefined
                        ? '-'
                        : `${formatAmount(
                            positionValuation.anchoredMarketValue /
                              valuation.totalAnchoredMarketValue! *
                              100
                          )}%`}
                    </TableCell>
                    {!readOnly && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={removing}
                          aria-busy={removing}
                          aria-label={
                            removing
                              ? `正在将 ${position.symbol} 移出持仓分组`
                              : `将 ${position.symbol} 移出持仓分组`
                          }
                          onClick={() => void onRemove(positionId)}
                        >
                          {removing ? <Spinner data-icon="icon-only" /> : <Trash2 />}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={readOnly ? 8 : 9} className="p-0">
                  <Empty className="min-h-32 gap-2 border-0 p-3 md:p-3">
                    <EmptyHeader className="gap-1">
                      <EmptyTitle className="text-sm">暂无持仓</EmptyTitle>
                      <EmptyDescription>选择持仓后将在这里展示</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

export function PositionGroupDetail({
  group,
  assetAccounts,
  accountGroups,
  readOnly,
  anchorCurrency,
  exchangeRates,
  imageExporting,
  onExportImage,
  onManagePositions,
  onRemovePosition,
  removingPositionIds
}: {
  group: PositionGroup
  assetAccounts: AssetAccount[]
  accountGroups: ProductAccount['accountGroups']
  readOnly: boolean
  anchorCurrency: string
  exchangeRates: ExchangeRateView
  imageExporting: boolean
  onExportImage: () => Promise<void>
  onManagePositions: () => void
  onRemovePosition: (positionId: string) => Promise<void>
  removingPositionIds: ReadonlySet<string>
}) {
  const items = group.positionIds.flatMap((positionId) => {
    const account = assetAccounts.find((item) =>
      item.positions.some((position) => position.id === positionId)
    )
    const position = account?.positions.find((item) => item.id === positionId)
    return account && position ? [{ positionId, account, position }] : []
  })

  return (
    <div className="mx-auto w-[calc(50%+36rem)] max-w-full px-4 pb-8 pt-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-[1_1_20rem] items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
            <Folder className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-semibold tracking-[-0.04em]">{group.name}</h1>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {!readOnly && (
            <Button onClick={onManagePositions}>
              <ListPlus data-icon="inline-start" />
              管理持仓
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => void onExportImage()}
            disabled={imageExporting}
            aria-busy={imageExporting}
          >
            {imageExporting ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Download data-icon="inline-start" />
            )}
            {imageExporting ? '导出中…' : '导出图片'}
          </Button>
        </div>
      </header>

      <div className="mt-6">
        <ValueSummaryCard
          positions={items.map((item) => item.position)}
          anchorCurrency={anchorCurrency}
          exchangeRates={exchangeRates}
        />
      </div>

      {items.length ? (
        <div className="mt-6 grid gap-6">
          <GroupPositionTable
            items={items}
            accountGroups={accountGroups}
            readOnly={readOnly}
            anchorCurrency={anchorCurrency}
            exchangeRates={exchangeRates}
            onRemove={onRemovePosition}
            removingPositionIds={removingPositionIds}
          />
        </div>
      ) : (
        <Empty className="mt-6 min-h-64 border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Folder data-icon="inline-start" />
            </EmptyMedia>
            <EmptyTitle>为持仓分组添加持仓</EmptyTitle>
            <EmptyDescription>可混合选择不同资产账户中的持仓，数据会跟随原账户更新</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {!readOnly && (
              <Button onClick={onManagePositions}>
                <ListPlus data-icon="inline-start" />
                选择持仓
              </Button>
            )}
          </EmptyContent>
        </Empty>
      )}
    </div>
  )
}
