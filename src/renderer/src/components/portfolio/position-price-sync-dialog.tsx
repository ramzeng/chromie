import { useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'

import { AccountTypeIcon } from '@/components/portfolio/view-helpers'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle
} from '@/components/ui/empty'
import { FieldLegend, FieldSet } from '@/components/ui/field'
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
import type {
  PortfolioPriceRefreshResponse,
  PortfolioSyncResponse,
  Workspace
} from '@/lib/portfolio'
import {
  syncPositionPricesForAccounts,
  type AccountPositionPriceSyncResult
} from '@/lib/position-price-sync'

type PriceSyncRowState =
  | { status: 'pending' | 'syncing' }
  | { status: 'completed'; result: AccountPositionPriceSyncResult }

function formatFailureDetails(result: AccountPositionPriceSyncResult): string {
  if (result.error) return result.error

  const details = result.failureDetails
  if (!details) return `${result.failureCount} 项未能更新`

  const message = [
    details.notFoundCount > 0
      ? `未找到行情 ${details.notFoundCount} 项`
      : '',
    details.unavailableCount > 0
      ? `数据源暂不可用 ${details.unavailableCount} 项`
      : '',
    details.conflictCount > 0
      ? `持仓已变更、已跳过 ${details.conflictCount} 项`
      : ''
  ]
    .filter(Boolean)
    .join('，')

  return message || `${result.failureCount} 项未能更新`
}

function PriceSyncStatus({
  accountName,
  state
}: {
  accountName: string
  state?: PriceSyncRowState
}) {
  if (state?.status === 'syncing') {
    return <Badge variant="secondary">处理</Badge>
  }

  if (state?.status !== 'completed') {
    return <Badge variant="outline">等待</Badge>
  }

  const { result } = state
  if (!result.error && result.failureCount === 0) {
    return <Badge variant="secondary">成功</Badge>
  }

  const failureDetails = formatFailureDetails(result)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="destructive"
          tabIndex={0}
          aria-label={`${accountName}同步失败：${failureDetails}`}
        >
          失败
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="w-fit min-w-0 max-w-72 break-words text-pretty">
        {failureDetails}
      </TooltipContent>
    </Tooltip>
  )
}

export function PositionPriceSyncDialog({
  workspace,
  syncAccount,
  refreshPositionPrices
}: {
  workspace: Workspace
  syncAccount: (
    workspaceId: string,
    accountId: string
  ) => Promise<PortfolioSyncResponse>
  refreshPositionPrices: (
    workspaceId: string,
    accountId: string
  ) => Promise<PortfolioPriceRefreshResponse>
}) {
  const [open, setOpen] = useState(false)
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(
    new Set()
  )
  const [rowStates, setRowStates] = useState<Record<string, PriceSyncRowState>>(
    {}
  )
  const [running, setRunning] = useState(false)
  const [hasCompleted, setHasCompleted] = useState(false)
  const runningRef = useRef(false)
  const accounts = workspace.accounts
  const selectedAccountCount = accounts.reduce(
    (total, account) =>
      total + (selectedAccountIds.has(account.id) ? 1 : 0),
    0
  )
  const allSelected =
    accounts.length > 0 && selectedAccountCount === accounts.length
  const someSelected = selectedAccountCount > 0

  function handleOpenChange(nextOpen: boolean): void {
    if (runningRef.current) return
    if (nextOpen) {
      setSelectedAccountIds(new Set(accounts.map((account) => account.id)))
      setRowStates({})
      setHasCompleted(false)
    }
    setOpen(nextOpen)
  }

  function toggleAccount(accountId: string, checked: boolean): void {
    setSelectedAccountIds((current) => {
      const next = new Set(current)
      if (checked) next.add(accountId)
      else next.delete(accountId)
      return next
    })
  }

  async function handleStart(): Promise<void> {
    if (runningRef.current) return
    const selectedAccounts = accounts.filter((account) =>
      selectedAccountIds.has(account.id)
    )
    if (!selectedAccounts.length) return

    runningRef.current = true
    setRunning(true)
    setHasCompleted(false)
    setRowStates(
      Object.fromEntries(
        selectedAccounts.map((account) => [
          account.id,
          { status: 'pending' as const }
        ])
      )
    )

    try {
      await syncPositionPricesForAccounts({
        workspaceId: workspace.id,
        accounts: selectedAccounts,
        operations: { syncAccount, refreshPositionPrices },
        onAccountStarted: (accountId) => {
          setRowStates((current) => ({
            ...current,
            [accountId]: { status: 'syncing' }
          }))
        },
        onAccountCompleted: (result) => {
          setRowStates((current) => ({
            ...current,
            [result.accountId]: { status: 'completed', result }
          }))
        }
      })
      setHasCompleted(true)
    } finally {
      runningRef.current = false
      setRunning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button">
          <RefreshCw data-icon="inline-start" />
          同步价格
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-2xl"
        showCloseButton={!running}
        onEscapeKeyDown={(event) => {
          if (runningRef.current) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (runningRef.current) event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>同步持仓价格</DialogTitle>
          <DialogDescription>
            自动同步账户会更新账户数据，其他账户会根据资产代码获取最新价格
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {accounts.length > 0 ? (
            <TooltipProvider delayDuration={300}>
              <FieldSet disabled={running} className="gap-0">
                <FieldLegend className="sr-only">选择要同步的账户</FieldLegend>
                <div className="overflow-hidden rounded-sm border border-border/70">
                  <Table className="min-w-[560px]">
                    <TableHeader className="bg-muted/15">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-12">
                          <Checkbox
                            checked={
                              allSelected
                                ? true
                                : someSelected
                                  ? 'indeterminate'
                                  : false
                            }
                            aria-label={allSelected ? '取消选择所有账户' : '选择所有账户'}
                            onCheckedChange={(checked) => {
                              setSelectedAccountIds(
                                checked === true
                                  ? new Set(accounts.map((account) => account.id))
                                  : new Set()
                              )
                            }}
                          />
                        </TableHead>
                        <TableHead className="min-w-40">账户</TableHead>
                        <TableHead className="w-20 whitespace-nowrap text-right">
                          持仓数
                        </TableHead>
                        <TableHead className="w-20 whitespace-nowrap text-right">
                          成功数
                        </TableHead>
                        <TableHead className="w-20 whitespace-nowrap text-right">
                          失败数
                        </TableHead>
                        <TableHead className="w-24 whitespace-nowrap text-right">
                          同步状态
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accounts.map((account) => {
                        const selected = selectedAccountIds.has(account.id)
                        const state = rowStates[account.id]
                        const result =
                          state?.status === 'completed' ? state.result : undefined
                        return (
                          <TableRow
                            key={account.id}
                            data-state={selected ? 'selected' : undefined}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selected}
                                aria-label={`选择账户 ${account.name}`}
                                onCheckedChange={(checked) =>
                                  toggleAccount(account.id, checked === true)
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex min-w-0 items-center gap-2">
                                <AccountTypeIcon
                                  type={account.type}
                                  className="size-4 shrink-0"
                                />
                                <span className="min-w-0 flex-1 truncate font-medium">
                                  {account.name}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {account.positions.length}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {result ? result.successCount : '-'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {result ? result.failureCount : '-'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right">
                              <PriceSyncStatus
                                accountName={account.name}
                                state={state}
                              />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </FieldSet>
            </TooltipProvider>
          ) : (
            <Empty className="min-h-52 border-0 p-6">
              <EmptyHeader>
                <EmptyTitle className="text-sm">暂无账户</EmptyTitle>
                <EmptyDescription>添加账户后即可同步持仓价格</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </DialogBody>
        <DialogFooter className="items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">
            已选择 {selectedAccountCount} / {accounts.length} 个账户
          </span>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              type="button"
              variant="outline"
              className="flex-1 sm:flex-none"
              disabled={running}
              onClick={() => handleOpenChange(false)}
            >
              {hasCompleted ? '关闭' : '取消'}
            </Button>
            <Button
              type="button"
              className="flex-1 sm:flex-none"
              disabled={running || selectedAccountCount === 0}
              aria-busy={running}
              onClick={() => void handleStart()}
            >
              {running && <Spinner data-icon="inline-start" />}
              {running ? '同步中…' : hasCompleted ? '再次同步' : '开始'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
