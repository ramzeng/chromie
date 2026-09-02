import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeftRight,
  ChartSpline,
  ChevronUp,
  Ellipsis,
  History,
  Pencil,
  Plus,
  Settings,
  Tags,
  Trash2
} from 'lucide-react'

import {
  AccountDetail,
  type AccountSyncState
} from '@/components/portfolio/account-detail'
import {
  AccountDialog,
  DeleteConfirmDialog,
  ExportBackupDialog,
  ImportBackupDialog,
  PositionDialog,
  TagAssignmentDialog,
  WorkspaceDialog,
  WorkspaceSwitcherDialog,
  WorkspaceSettingsDialog
} from '@/components/portfolio/dialogs'
import {
  AppLoadingSkeleton,
  EmptyWorkspace,
  PortfolioLoadError,
  reportPortfolioError
} from '@/components/portfolio/feedback'
import { Overview } from '@/components/portfolio/overview'
import { TagManagement } from '@/components/portfolio/tag-management'
import { TimeMachine } from '@/components/portfolio/time-machine'
import { HistoricalVersionBanner } from '@/components/portfolio/page-shell'
import {
  AccountTypeIcon,
  accountSyncInterval,
  shortSnapshotHash,
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
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  useExchangeRates,
  type ExchangeRateState
} from '@/lib/exchange-rates'
import { CHROMIE_LOGO_URL } from '@/lib/brand'
import { cn } from '@/lib/utils'
import {
  type Account,
  type AccountInput,
  type Position,
  type PositionInput,
  type Tag,
  type TagInput,
  type WorkspaceSnapshot,
  type Workspace,
  type WorkspaceInput,
  type WorkspaceSettingsInput,
  usePortfolio
} from '@/lib/portfolio'
import { toast } from 'sonner'

type WorkspaceDialogState = { open: boolean }
type AccountDialogState = { open: boolean; account?: Account }
type PositionDialogState = { open: boolean; accountId?: string; position?: Position }
type TagAssignmentTarget = { accountId: string; position: Position } | null
type DeleteTarget =
  | { kind: 'workspace'; workspace: Workspace }
  | { kind: 'account'; account: Account }
  | { kind: 'tag'; tag: Tag }
  | { kind: 'position'; account: Account; position: Position }
  | { kind: 'snapshot'; snapshot: WorkspaceSnapshot }
  | null

type PendingImport = {
  workspace: Workspace
  snapshots: WorkspaceSnapshot[]
  accountCount: number
  tagCount: number
  positionCount: number
  snapshotCount: number
} | null

const SELECTED_NAVIGATION_CLASS_NAME = 'bg-sidebar-accent text-sidebar-accent-foreground'

function AccountNavigation({
  accounts,
  readOnly,
  selectedAccountId,
  onSelect,
  onEdit,
  onDelete
}: {
  accounts: Account[]
  readOnly: boolean
  selectedAccountId: string | null
  onSelect: (account: Account) => void
  onEdit: (account: Account) => void
  onDelete: (account: Account) => void
}) {
  return (
    <div className="grid min-w-0 gap-1">
      {accounts.map((account) => {
        const selected = selectedAccountId === account.id
        return (
          <div
            key={account.id}
            className={cn(
              'group flex min-w-0 items-center rounded-sm pr-1 transition-colors hover:bg-muted/70',
              selected && SELECTED_NAVIGATION_CLASS_NAME
            )}
          >
            <Button
              variant="ghost"
              className={cn(
                'h-auto min-w-0 flex-1 justify-start gap-3 px-3 py-2.5 font-normal hover:bg-transparent',
                selected && 'font-medium'
              )}
              onClick={() => onSelect(account)}
            >
              <AccountTypeIcon type={account.type} className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-left">{account.name}</span>
            </Button>
            {!readOnly && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100',
                      selected && 'opacity-100'
                    )}
                    aria-label={`${account.name}操作`}
                  >
                    <Ellipsis data-icon="icon-only" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-20">
                  <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={() => onEdit(account)}>
                      <Pencil className="size-4" />
                      编辑
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => onDelete(account)}>
                      <Trash2 className="size-4" />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function App(): React.JSX.Element {
  const portfolio = usePortfolio()
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null)
  const selectedSnapshot =
    portfolio.activeSnapshots.find((snapshot) => snapshot.id === selectedSnapshotId) ?? null
  const latestWorkspace = portfolio.activeWorkspace
  const liveExchangeRates = useExchangeRates(
    latestWorkspace?.exchangeRateProvider,
    latestWorkspace?.exchangeRateRefreshIntervalMinutes,
    Boolean(latestWorkspace) && !selectedSnapshot
  )
  async function refreshLiveExchangeRates(): Promise<void> {
    await liveExchangeRates.refresh()
  }
  const liveExchangeRateView: ExchangeRateState = {
    ...liveExchangeRates,
    refresh: refreshLiveExchangeRates
  }
  const exchangeRates: ExchangeRateView = selectedSnapshot
    ? {
        snapshot: selectedSnapshot.exchangeRates ?? null,
        status: selectedSnapshot.exchangeRates ? 'ready' : 'error',
        error: selectedSnapshot.exchangeRates ? '' : '快照中没有汇率数据'
      }
    : liveExchangeRateView
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [showTimeMachine, setShowTimeMachine] = useState(false)
  const [showTagManagement, setShowTagManagement] = useState(false)
  const [workspaceDialog, setWorkspaceDialog] = useState<WorkspaceDialogState>({ open: false })
  const [workspaceSwitcherOpen, setWorkspaceSwitcherOpen] = useState(false)
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false)
  const [workspaceSettingsSection, setWorkspaceSettingsSection] = useState<'basic' | 'currency'>(
    'basic'
  )
  const [accountDialog, setAccountDialog] = useState<AccountDialogState>({ open: false })
  const [positionDialog, setPositionDialog] = useState<PositionDialogState>({ open: false })
  const [tagAssignmentTarget, setTagAssignmentTarget] =
    useState<TagAssignmentTarget>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)
  const [syncStates, setSyncStates] = useState<Record<string, AccountSyncState>>({})
  const [pendingImport, setPendingImport] = useState<PendingImport>(null)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [choosingImport, setChoosingImport] = useState(false)
  const [creatingSnapshot, setCreatingSnapshot] = useState(false)
  const syncingAccountIds = useRef(new Set<string>())
  const choosingImportRef = useRef(false)
  const creatingSnapshotRef = useRef(false)

  useEffect(() => {
    if (!portfolio.refreshError) return
    toast.error('资产数据刷新失败', {
      description: `已保留当前页面数据。${portfolio.refreshError}`,
      id: 'portfolio-refresh-error'
    })
  }, [portfolio.refreshError])

  useEffect(() => {
    if (exchangeRates.status !== 'error' || !exchangeRates.error) return
    toast.error(exchangeRates.snapshot ? '汇率更新失败' : '汇率加载失败', {
      description: exchangeRates.error,
      id: 'exchange-rate-error'
    })
  }, [exchangeRates.error, exchangeRates.snapshot, exchangeRates.status])

  const activeWorkspace = selectedSnapshot?.workspace ?? latestWorkspace
  const selectedAccount =
    activeWorkspace?.accounts.find(
      (account) => account.id === selectedAccountId
    ) ?? null
  useEffect(() => {
    setSelectedSnapshotId(null)
    setSelectedAccountId(null)
    setShowTagManagement(false)
  }, [latestWorkspace?.id])

  async function syncAccount(accountId: string): Promise<void> {
    if (
      !latestWorkspace ||
      selectedSnapshot ||
      syncingAccountIds.current.has(accountId)
    ) return
    const account = latestWorkspace.accounts.find(
      (account) => account.id === accountId
    )
    if (!account?.sync) return

    syncingAccountIds.current.add(accountId)
    setSyncStates((current) => ({
      ...current,
      [accountId]: {
        status: 'syncing'
      }
    }))
    try {
      await portfolio.syncAccount(
        latestWorkspace.id,
        accountId
      )
    } catch (error) {
      reportPortfolioError(error, `${account.name} 同步失败`)
    } finally {
      syncingAccountIds.current.delete(accountId)
      setSyncStates((current) => {
        const next = { ...current }
        delete next[accountId]
        return next
      })
    }
  }

  const autoSyncAccounts =
    selectedSnapshot
      ? []
      : latestWorkspace?.accounts.flatMap((account) =>
          account.sync
            ? [
                {
                  id: account.id,
                  type: account.type,
                  interval: accountSyncInterval(account)
                }
              ]
            : []
        ) ?? []
  const autoSyncKey = JSON.stringify(autoSyncAccounts)

  useEffect(() => {
    if (!autoSyncAccounts.length) return
    const timers = autoSyncAccounts.map((account) => {
      void syncAccount(account.id)
      return window.setInterval(
        () => void syncAccount(account.id),
        account.interval * 1000
      )
    })
    return () => timers.forEach((timer) => window.clearInterval(timer))
    // Restart timers when an auto-sync account or its connection settings change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestWorkspace?.id, selectedSnapshotId, autoSyncKey])

  async function exportWorkspace(): Promise<void> {
    try {
      if (!window.desktop.backup?.exportData) {
        throw new Error('数据组件尚未加载，请重启 Chromie')
      }
      const result = await window.desktop.backup.exportData(await portfolio.exportWorkspace())
      setExportDialogOpen(false)
      if (!result.canceled) toast.success('工作区备份已导出')
    } catch (error) {
      reportPortfolioError(error, '导出工作区失败')
      throw error
    }
  }

  async function chooseImportWorkspace(): Promise<void> {
    if (choosingImportRef.current) return
    choosingImportRef.current = true
    setChoosingImport(true)
    try {
      if (!window.desktop.backup?.importData) {
        throw new Error('数据组件尚未加载，请重启 Chromie')
      }
      const result = await window.desktop.backup.importData()
      if (result.canceled || !result.content) return
      const backup = await portfolio.inspectBackup(result.content)
      if (!backup) {
        toast.error('无法导入工作区', {
          description: '备份文件无效或版本不受支持'
        })
        return
      }
      const { workspace, snapshots } = backup
      setPendingImport({
        workspace,
        snapshots,
        accountCount: workspace.accounts.length,
        tagCount: workspace.tags.length,
        positionCount: workspace.accounts.reduce(
          (total, account) => total + account.positions.length,
          0
        ),
        snapshotCount: snapshots.length
      })
    } catch (error) {
      reportPortfolioError(error, '读取备份失败')
    } finally {
      choosingImportRef.current = false
      setChoosingImport(false)
    }
  }

  async function confirmImportWorkspace(): Promise<void> {
    if (!pendingImport) return
    try {
      setSelectedAccountId(null)
      await portfolio.importWorkspace(pendingImport.workspace, pendingImport.snapshots)
      setPendingImport(null)
      toast.success('工作区已导入')
    } catch (error) {
      reportPortfolioError(error, '导入工作区失败')
    }
  }

  if (portfolio.loading) {
    return <AppLoadingSkeleton />
  }

  if (portfolio.error) {
    return <PortfolioLoadError message={portfolio.error} />
  }

  if (!activeWorkspace) {
    return (
      <>
        <EmptyWorkspace
          onCreate={() => setWorkspaceDialog({ open: true })}
          onImport={() => void chooseImportWorkspace()}
          importing={choosingImport}
        />
        <WorkspaceDialog
          open={workspaceDialog.open}
          onOpenChange={(open) => setWorkspaceDialog({ open })}
          onSubmit={async (input) => {
            await portfolio.createWorkspace(input)
            toast.success('工作区已创建')
          }}
        />
        <ImportBackupDialog
          open={pendingImport !== null}
          onOpenChange={(open) => {
            if (!open) setPendingImport(null)
          }}
          workspaceName={pendingImport?.workspace.name ?? ''}
          accountCount={pendingImport?.accountCount ?? 0}
          tagCount={pendingImport?.tagCount ?? 0}
          positionCount={pendingImport?.positionCount ?? 0}
          snapshotCount={pendingImport?.snapshotCount ?? 0}
          onConfirm={confirmImportWorkspace}
        />
      </>
    )
  }

  async function submitWorkspace(input: WorkspaceInput): Promise<void> {
    await portfolio.createWorkspace(input)
    toast.success('工作区已创建')
  }

  async function createCurrentSnapshot(): Promise<void> {
    if (!latestWorkspace || selectedSnapshot || creatingSnapshotRef.current) return
    creatingSnapshotRef.current = true
    setCreatingSnapshot(true)
    try {
      await portfolio.createSnapshot(latestWorkspace.id, liveExchangeRates.snapshot)
      toast.success('快照已创建')
    } catch (error) {
      reportPortfolioError(error, '创建快照失败')
    } finally {
      creatingSnapshotRef.current = false
      setCreatingSnapshot(false)
    }
  }

  async function submitWorkspaceSettings(
    input: WorkspaceSettingsInput
  ): Promise<void> {
    if (!activeWorkspace) return
    await portfolio.updateWorkspace(activeWorkspace.id, input)
    toast.success('工作区设置已保存')
  }

  async function submitAccount(input: AccountInput): Promise<void> {
    if (!activeWorkspace) return
    if (accountDialog.account) {
      await portfolio.updateAccount(activeWorkspace.id, accountDialog.account.id, input)
      toast.success('资产账户已更新')
      return
    }
    const id = await portfolio.createAccount(activeWorkspace.id, input)
    setSelectedAccountId(id)
    toast.success('资产账户已添加')
  }

  async function createTag(input: TagInput): Promise<string> {
    if (!activeWorkspace) throw new Error('没有找到对应的工作区')
    const tagId = await portfolio.createTag(activeWorkspace.id, input)
    toast.success('标签已添加')
    return tagId
  }

  async function updateTag(tagId: string, input: TagInput): Promise<void> {
    if (!activeWorkspace) return
    await portfolio.updateTag(activeWorkspace.id, tagId, input)
    toast.success('标签已更新')
  }

  async function submitPositionTags(tagIds: string[]): Promise<string | null> {
    if (!activeWorkspace || !tagAssignmentTarget) return '没有找到对应的持仓'
    const result = await portfolio.setPositionTags(
      activeWorkspace.id,
      tagAssignmentTarget.accountId,
      tagAssignmentTarget.position.id,
      tagIds
    )
    if (!result) toast.success('持仓标签已更新')
    return result
  }

  async function submitPosition(input: PositionInput): Promise<string | null> {
    if (!activeWorkspace || !positionDialog.accountId) {
      return '没有找到对应的资产账户'
    }
    const result = await portfolio.savePosition(
      activeWorkspace.id,
      positionDialog.accountId,
      input,
      positionDialog.position?.id
    )
    if (!result) {
      toast.success(positionDialog.position ? '持仓已更新' : '持仓已添加')
    }
    return result
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget) return
    const successMessage =
      deleteTarget.kind === 'workspace'
        ? '工作区已删除'
        : deleteTarget.kind === 'snapshot'
          ? '快照已删除'
          : deleteTarget.kind === 'account'
            ? '资产账户已删除'
            : deleteTarget.kind === 'tag'
              ? '标签已删除'
              : '持仓已删除'
    try {
      if (deleteTarget.kind === 'snapshot') {
        await portfolio.deleteSnapshot(deleteTarget.snapshot.id)
        if (deleteTarget.snapshot.id === selectedSnapshotId) {
          setSelectedSnapshotId(null)
        }
      } else if (!latestWorkspace) {
        return
      } else if (deleteTarget.kind === 'workspace') {
        await portfolio.deleteWorkspace(deleteTarget.workspace.id)
      } else if (deleteTarget.kind === 'account') {
        await portfolio.deleteAccount(latestWorkspace.id, deleteTarget.account.id)
        setSelectedAccountId(null)
      } else if (deleteTarget.kind === 'tag') {
        await portfolio.deleteTag(latestWorkspace.id, deleteTarget.tag.id)
      } else {
        await portfolio.deletePosition(
          latestWorkspace.id,
          deleteTarget.account.id,
          deleteTarget.position.id
        )
      }
      setDeleteTarget(null)
      toast.success(successMessage)
    } catch (error) {
      reportPortfolioError(error, '删除失败')
    }
  }

  const deleteDialogCopy = (() => {
    if (!deleteTarget) return { title: '', description: '' }
    if (deleteTarget.kind === 'snapshot') {
      return {
        title: `删除快照 #${shortSnapshotHash(deleteTarget.snapshot.id)}？`,
        description: '只会删除这个历史快照，当前数据不会受到影响。此操作无法撤销'
      }
    }
    if (deleteTarget.kind === 'workspace') {
      return {
        title: `删除工作区“${deleteTarget.workspace.name}”？`,
        description: `将同时删除 ${deleteTarget.workspace.tags.length} 个标签、${deleteTarget.workspace.accounts.length} 个资产账户和全部持仓。此操作无法撤销`
      }
    }
    if (deleteTarget.kind === 'account') {
      return {
        title: `删除“${deleteTarget.account.name}”？`,
        description: `将同时删除 ${deleteTarget.account.positions.length} 项持仓。此操作无法撤销`
      }
    }
    if (deleteTarget.kind === 'tag') {
      return {
        title: `删除标签“${deleteTarget.tag.name}”？`,
        description: '将从相关资产账户和持仓中移除此标签，不会删除资产数据。此操作无法撤销'
      }
    }
    return {
      title: `删除 ${deleteTarget.position.symbol}？`,
      description: `将从“${deleteTarget.account.name}”移除。此操作无法撤销`
    }
  })()

  const workspaceSwitcher = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto w-full justify-start gap-3 px-2 py-2"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-sm bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
            {activeWorkspace.name.trim().slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">
            {activeWorkspace.name}
          </span>
          <ChevronUp data-icon="inline-end" className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[var(--radix-dropdown-menu-trigger-width)]"
        side="top"
        align="start"
      >
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => setWorkspaceDialog({ open: true })}>
            <Plus />
            新建工作区
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setWorkspaceSwitcherOpen(true)}>
            <ArrowLeftRight />
            切换工作区
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="flex h-screen min-h-[600px] overflow-hidden bg-sidebar">
      <div className="window-drag fixed inset-x-0 top-0 z-40 h-2" />
      <aside
        data-slot="app-sidebar"
        className="flex w-64 shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground"
      >
        <div className="flex h-full w-64 min-w-64 flex-col overflow-hidden">
          <div className="window-drag shrink-0 pt-8">
            <div className="flex h-10 items-center gap-2 px-4">
              <span className="grid size-6 shrink-0 place-items-center">
                <img
                  className="size-6 object-contain invert"
                  src={CHROMIE_LOGO_URL}
                  alt=""
                  aria-hidden="true"
                />
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[-0.02em]">
                Chromie
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="-mr-1 shrink-0"
                disabled={Boolean(selectedSnapshot)}
                aria-label="工作区设置"
                title={selectedSnapshot ? '历史版本中无法修改工作区设置' : '工作区设置'}
                onClick={() => {
                  setWorkspaceSettingsSection('basic')
                  setWorkspaceSettingsOpen(true)
                }}
              >
                <Settings data-icon="icon-only" />
              </Button>
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <nav className="px-3 pb-4 pt-2">
              <div className="mb-4 grid gap-1">
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start px-3 font-normal',
                    !selectedAccountId &&
                      !showTimeMachine &&
                      !showTagManagement &&
                      cn(SELECTED_NAVIGATION_CLASS_NAME, 'font-medium')
                  )}
                  onClick={() => {
                    setShowTimeMachine(false)
                    setShowTagManagement(false)
                    setSelectedAccountId(null)
                  }}
                >
                  <ChartSpline />
                  资产概览
                </Button>
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start px-3 font-normal',
                    showTimeMachine && cn(SELECTED_NAVIGATION_CLASS_NAME, 'font-medium')
                  )}
                  onClick={() => {
                    setShowTimeMachine(true)
                    setShowTagManagement(false)
                    setSelectedAccountId(null)
                  }}
                >
                  <History />
                  时间机器
                </Button>
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start px-3 font-normal',
                    showTagManagement && cn(SELECTED_NAVIGATION_CLASS_NAME, 'font-medium')
                  )}
                  onClick={() => {
                    setShowTimeMachine(false)
                    setShowTagManagement(true)
                    setSelectedAccountId(null)
                  }}
                >
                  <Tags />
                  标签
                </Button>
              </div>

              <div className="mb-2 flex items-center gap-1">
                <p className="flex h-7 min-w-0 flex-1 items-center px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  资产账户
                </p>
                {!selectedSnapshot && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="添加资产账户"
                    title="添加资产账户"
                    onClick={() => setAccountDialog({ open: true })}
                  >
                    <Plus data-icon="icon-only" />
                  </Button>
                )}
              </div>
              <AccountNavigation
                key={activeWorkspace.id}
                accounts={activeWorkspace.accounts}
                readOnly={Boolean(selectedSnapshot)}
                selectedAccountId={selectedAccountId}
                onSelect={(account) => {
                  setShowTimeMachine(false)
                  setShowTagManagement(false)
                  setSelectedAccountId(account.id)
                }}
                onEdit={(account) => setAccountDialog({ open: true, account })}
                onDelete={(account) => setDeleteTarget({ kind: 'account', account })}
              />
              {selectedSnapshot && !activeWorkspace.accounts.length && (
                <p className="px-3 py-2 text-xs leading-5 text-muted-foreground">
                  暂无资产账户
                </p>
              )}
            </nav>
          </ScrollArea>

          <div className="px-3 py-3">
            {workspaceSwitcher}
          </div>
        </div>
      </aside>

      <div
        data-slot="app-content"
        className="flex min-w-0 flex-1 flex-col overflow-hidden border-l border-border bg-background"
      >
        <ScrollArea className="min-h-0 min-w-0 flex-1">
          <main
            className={cn(
              'min-h-full transition-colors',
              selectedSnapshot && 'bg-muted/10'
            )}
            aria-label={selectedSnapshot ? '历史快照，只读' : undefined}
          >
        {selectedSnapshot && !showTimeMachine && (
          <HistoricalVersionBanner
            snapshotId={selectedSnapshot.id}
            createdAt={selectedSnapshot.createdAt}
            onReturnLatest={() => setSelectedSnapshotId(null)}
          />
        )}
        {showTimeMachine ? (
          <TimeMachine
            workspace={latestWorkspace ?? activeWorkspace}
            snapshots={portfolio.activeSnapshots}
            selectedSnapshotId={selectedSnapshotId}
            liveExchangeRates={liveExchangeRates}
            creating={creatingSnapshot}
            onCreate={createCurrentSnapshot}
            onViewLatest={() => {
              setSelectedSnapshotId(null)
              setShowTimeMachine(false)
            }}
            onViewSnapshot={(snapshotId) => {
              setSelectedSnapshotId(snapshotId)
              setShowTimeMachine(false)
            }}
            onDeleteSnapshot={(snapshot) =>
              setDeleteTarget({ kind: 'snapshot', snapshot })
            }
          />
        ) : showTagManagement ? (
          <TagManagement
            workspace={activeWorkspace}
            readOnly={Boolean(selectedSnapshot)}
            onCreate={async (input) => {
              await createTag(input)
            }}
            onUpdate={updateTag}
            onDelete={(tag) => setDeleteTarget({ kind: 'tag', tag })}
          />
        ) : selectedAccount ? (
          <AccountDetail
            account={selectedAccount}
            tags={activeWorkspace.tags}
            readOnly={Boolean(selectedSnapshot)}
            baseCurrency={activeWorkspace.baseCurrency}
            exchangeRates={exchangeRates}
            onAddPosition={() =>
              setPositionDialog({ open: true, accountId: selectedAccount.id })
            }
            onEditAccount={() =>
              setAccountDialog({ open: true, account: selectedAccount })
            }
            onSync={() => syncAccount(selectedAccount.id)}
            syncState={syncStates[selectedAccount.id]}
            onManagePositionTags={(position) =>
              setTagAssignmentTarget({ accountId: selectedAccount.id, position })
            }
            onEditPosition={(position) =>
              setPositionDialog({
                open: true,
                accountId: selectedAccount.id,
                position
              })
            }
            onDeletePosition={(position) =>
              setDeleteTarget({ kind: 'position', account: selectedAccount, position })
            }
          />
        ) : (
          <Overview
            workspace={activeWorkspace}
            exchangeRates={exchangeRates}
            onOpenAccount={(accountId) => {
              setShowTagManagement(false)
              setSelectedAccountId(accountId)
            }}
          />
        )}
          </main>
        </ScrollArea>
      </div>

      <WorkspaceDialog
        open={workspaceDialog.open}
        onOpenChange={(open) => setWorkspaceDialog((current) => ({ ...current, open }))}
        onSubmit={submitWorkspace}
      />
      <WorkspaceSwitcherDialog
        open={workspaceSwitcherOpen}
        onOpenChange={setWorkspaceSwitcherOpen}
        workspaces={portfolio.workspaces}
        activeWorkspaceId={latestWorkspace?.id ?? activeWorkspace.id}
        onSelect={async (workspaceId) => {
          setSelectedSnapshotId(null)
          await portfolio.setActiveWorkspace(workspaceId)
        }}
        onImport={() => void chooseImportWorkspace()}
        importing={choosingImport}
      />
      <WorkspaceSettingsDialog
        open={workspaceSettingsOpen}
        onOpenChange={setWorkspaceSettingsOpen}
        workspace={activeWorkspace}
        initialSection={workspaceSettingsSection}
        onSubmit={submitWorkspaceSettings}
        onRequestExport={() => setExportDialogOpen(true)}
        onRequestDelete={() =>
          setDeleteTarget({ kind: 'workspace', workspace: activeWorkspace })
        }
      />
      <AccountDialog
        open={accountDialog.open}
        onOpenChange={(open) =>
          setAccountDialog((current) => (open ? { ...current, open } : { open: false }))
        }
        account={accountDialog.account}
        integration={
          accountDialog.account
            ? portfolio.getAccountIntegration(accountDialog.account.id)
            : undefined
        }
        tags={activeWorkspace.tags}
        onCreateTag={createTag}
        onSubmit={submitAccount}
      />
      <PositionDialog
        open={positionDialog.open}
        onOpenChange={(open) => setPositionDialog((current) => ({ ...current, open }))}
        position={positionDialog.position}
        tags={activeWorkspace.tags}
        onCreateTag={createTag}
        onSubmit={submitPosition}
      />
      {tagAssignmentTarget && (
        <TagAssignmentDialog
          open
          onOpenChange={(open) => {
            if (!open) setTagAssignmentTarget(null)
          }}
          title={`管理 ${tagAssignmentTarget.position.symbol} 的标签`}
          tags={activeWorkspace.tags}
          selectedTagIds={tagAssignmentTarget.position.tagIds}
          onCreateTag={createTag}
          onSubmit={submitPositionTags}
        />
      )}
      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={deleteDialogCopy.title}
        description={deleteDialogCopy.description}
        confirmationPhrase={deleteTarget?.kind === 'workspace' ? 'DELETE' : undefined}
        onConfirm={confirmDelete}
      />
      <ImportBackupDialog
        open={pendingImport !== null}
        onOpenChange={(open) => {
          if (!open) setPendingImport(null)
        }}
        workspaceName={pendingImport?.workspace.name ?? ''}
        accountCount={pendingImport?.accountCount ?? 0}
        tagCount={pendingImport?.tagCount ?? 0}
        positionCount={pendingImport?.positionCount ?? 0}
        snapshotCount={pendingImport?.snapshotCount ?? 0}
        onConfirm={confirmImportWorkspace}
      />
      <ExportBackupDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onConfirm={exportWorkspace}
      />
    </div>
  )
}
