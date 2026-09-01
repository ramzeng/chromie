import {
  Ellipsis,
  Eye,
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
  selectedSnapshotId: string | null
  liveExchangeRates: ExchangeRateView
  creating: boolean
  onCreate: () => Promise<void>
  onViewLatest: () => void
  onViewSnapshot: (snapshotId: string) => void
  onDeleteSnapshot: (snapshot: WorkspaceSnapshot) => void
}) {
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
  ]

  return (
    <div className="mx-auto w-[calc(50%+36rem)] max-w-full px-4 pb-8 pt-4">
      <header className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em]">时间机器</h1>
        </div>
        <Button
          onClick={() => void onCreate()}
          disabled={selectedSnapshotId !== null || creating}
          aria-busy={creating}
          title={selectedSnapshotId ? '请先切换到当前数据' : undefined}
        >
          {creating ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Plus data-icon="inline-start" />
          )}
          {creating ? '创建中…' : '创建快照'}
        </Button>
      </header>

      <section className="mt-6 overflow-hidden rounded-lg border border-border/70 bg-card">
        <Table className="min-w-[900px] table-fixed">
          <TableHeader className="bg-muted/15">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[14%]">数据</TableHead>
              <TableHead className="w-[14%]">工作区名称</TableHead>
              <TableHead className="w-[20%]">时间点</TableHead>
              <TableHead className="w-[10%] text-right">资产账户数</TableHead>
              <TableHead className="w-[8%] text-right">持仓数</TableHead>
              <TableHead className="w-[19%] text-right">折算市值</TableHead>
              <TableHead className="w-[9%]">状态</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const positions = row.workspace.assetAccounts.flatMap(
                (assetAccount) => assetAccount.positions
              )
              const valuation = valuePositions(
                positions,
                row.workspace.baseCurrency,
                row.rates
              )
              const isSelected = row.kind === 'latest'
                ? selectedSnapshotId === null
                : selectedSnapshotId === row.id
              return (
                <TableRow key={row.id} data-state={isSelected ? 'selected' : undefined}>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={cn(
                          'grid size-8 shrink-0 place-items-center rounded-md',
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
                    {row.workspace.assetAccounts.length}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{positions.length}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {valuation.isComplete &&
                    valuation.totalConvertedMarketValue !== undefined ? (
                      <MaskedAssetValue>
                        {formatMoney(
                          valuation.totalConvertedMarketValue,
                          row.workspace.baseCurrency
                        )}
                      </MaskedAssetValue>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={isSelected ? 'default' : 'secondary'}>
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
                          <Ellipsis className="size-4" />
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
                        </DropdownMenuGroup>
                        {row.kind === 'snapshot' && (
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
      </section>

    </div>
  )
}
