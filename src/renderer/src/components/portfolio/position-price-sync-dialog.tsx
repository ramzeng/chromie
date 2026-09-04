import { useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

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
  const allSelected =
    accounts.length > 0 &&
    accounts.every((account) => selectedAccountIds.has(account.id))
  const someSelected = accounts.some((account) =>
    selectedAccountIds.has(account.id)
  )

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
      const results = await syncPositionPricesForAccounts({
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
      const successCount = results.reduce(
        (total, result) => total + result.successCount,
        0
      )
      const failureCount = results.reduce(
        (total, result) => total + result.failureCount,
        0
      )
      const failedAccountCount = results.filter((result) => result.error).length
      if (failureCount === 0 && failedAccountCount === 0) {
        toast.success(`价格同步完成，共成功 ${successCount} 项`)
      } else {
        toast.info(
          `价格同步完成：成功 ${successCount} 项，失败 ${failureCount} 项${
            failedAccountCount ? `，${failedAccountCount} 个账户异常` : ''
          }`
        )
      }
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
      <DialogContent className="max-w-2xl">
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
                        <TableHead className="min-w-52">账户</TableHead>
                        <TableHead className="w-24 whitespace-nowrap text-right">
                          持仓数
                        </TableHead>
                        <TableHead className="w-24 whitespace-nowrap text-right">
                          成功数
                        </TableHead>
                        <TableHead className="w-24 whitespace-nowrap text-right">
                          失败数
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
                                <span className="min-w-0 truncate font-medium">
                                  {account.name}
                                </span>
                                {state?.status === 'syncing' && (
                                  <Spinner aria-label={`${account.name} 正在同步`} />
                                )}
                                {result?.error && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge
                                        variant="destructive"
                                        className="shrink-0"
                                        tabIndex={0}
                                      >
                                        失败
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-80">
                                      {result.error}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {account.positions.length}
                            </TableCell>
                            <TableCell
                              className="text-right tabular-nums"
                              aria-live="polite"
                            >
                              {result ? result.successCount : '-'}
                            </TableCell>
                            <TableCell
                              className="text-right tabular-nums"
                              aria-live="polite"
                            >
                              {result ? result.failureCount : '-'}
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
            已选择 {selectedAccountIds.size} / {accounts.length} 个账户
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
              disabled={running || selectedAccountIds.size === 0}
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
