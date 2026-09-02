import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeftRight,
  ChartSpline,
  ChevronDown,
  ChevronUp,
  Ellipsis,
  Folder,
  History,
  Layers2,
  Pencil,
  Plus,
  Settings,
  Trash2
} from 'lucide-react'

import {
  AccountGroupDetail,
  AssetAccountDetail,
  PositionGroupDetail,
  type AccountSyncState
} from '@/components/portfolio/account-detail'
import {
  AccountGroupDialog,
  AssetAccountDialog,
  DeleteConfirmDialog,
  ExportBackupDialog,
  GroupAccountsDialog,
  ImportBackupDialog,
  GroupPositionsDialog,
  PositionDialog,
  PositionGroupDialog,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import {
  useExchangeRates,
  type ExchangeRateState
} from '@/lib/exchange-rates'
import { CHROMIE_LOGO_URL } from '@/lib/brand'
import { cn } from '@/lib/utils'
import {
  type AccountGroup,
  type AccountGroupInput,
  type AssetAccount,
  type AssetAccountInput,
  type Position,
  type PositionGroup,
  type PositionGroupInput,
  type PositionInput,
  type WorkspaceSnapshot,
  type Workspace,
  type WorkspaceInput,
  type WorkspaceSettingsInput,
  usePortfolio
} from '@/lib/portfolio'
import { toast } from 'sonner'

type WorkspaceDialogState = { open: boolean }
type AssetDialogState = { open: boolean; account?: AssetAccount; groupId?: string }
type PositionDialogState = { open: boolean; accountId?: string; position?: Position }
type AccountGroupDialogState = { open: boolean; group?: AccountGroup }
type PositionGroupDialogState = { open: boolean; group?: PositionGroup }
type DeleteTarget =
  | { kind: 'workspace'; workspace: Workspace }
  | { kind: 'asset'; account: AssetAccount }
  | { kind: 'account-group'; group: AccountGroup }
  | { kind: 'position-group'; group: PositionGroup }
  | { kind: 'position'; account: AssetAccount; position: Position }
  | { kind: 'snapshot'; snapshot: WorkspaceSnapshot }
  | null

type PendingImport = {
  workspace: Workspace
  snapshots: WorkspaceSnapshot[]
  assetAccountCount: number
  groupCount: number
  positionCount: number
  snapshotCount: number
} | null

const SELECTED_NAVIGATION_CLASS_NAME = 'bg-sidebar-accent text-sidebar-accent-foreground'

function AssetAccountNavigation({
  accounts,
  accountGroups,
  readOnly,
  selectedAccountId,
  selectedAccountGroupId,
  onSelect,
  onSelectGroup,
  onEdit,
  onDelete,
  onCreateAccount,
  onEditGroup,
  onDeleteGroup
}: {
  accounts: AssetAccount[]
  accountGroups: Workspace['accountGroups']
  readOnly: boolean
  selectedAccountId: string | null
  selectedAccountGroupId: string | null
  onSelect: (account: AssetAccount) => void
  onSelectGroup: (group: AccountGroup) => void
  onEdit: (account: AssetAccount) => void
  onDelete: (account: AssetAccount) => void
  onCreateAccount: (group: AccountGroup) => void
  onEditGroup: (group: AccountGroup) => void
  onDeleteGroup: (group: AccountGroup) => void
}) {
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(
    () => new Set()
  )
  const groupedAssetAccountIds = new Set(
    accountGroups.flatMap((group) => group.assetAccountIds)
  )
  const groups = [
    ...accountGroups.map((group) => ({
      group,
      id: group.id,
      label: group.name,
      accounts: group.assetAccountIds.flatMap((assetAccountId) => {
        const account = accounts.find((item) => item.id === assetAccountId)
        return account ? [account] : []
      })
    })),
    {
      group: null,
      id: 'unassigned',
      label: '未分组',
      accounts: accounts.filter((account) => !groupedAssetAccountIds.has(account.id))
    }
  ].filter(({ group, accounts: groupAccounts }) => group || groupAccounts.length > 0)

  function toggleGroup(groupId: string): void {
    setCollapsedGroupIds((current) => {
      const next = new Set(current)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  return (
    <div className="grid min-w-0 gap-3">
      {groups.map(({ group, id, label, accounts: groupAccounts }) => {
        const groupSelected = group?.id === selectedAccountGroupId
        const collapsed = collapsedGroupIds.has(id)
        const accessibilityLabel = group?.name ?? '未分组资产账户'
        return (
          <div key={id} className="min-w-0 pl-2">
            <div
              className={cn(
                'group flex min-w-0 items-center rounded-sm pr-1 transition-colors hover:bg-muted/70',
                groupSelected && SELECTED_NAVIGATION_CLASS_NAME
              )}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="shrink-0 hover:bg-transparent"
                aria-expanded={!collapsed}
                aria-label={`${collapsed ? '展开' : '收起'}${accessibilityLabel}`}
                onClick={() => toggleGroup(id)}
              >
                <ChevronDown
                  data-icon="inline-start"
                  className={cn('transition-transform', collapsed && '-rotate-90')}
                />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  'h-7 min-w-0 flex-1 justify-start px-1 text-left text-xs text-muted-foreground hover:bg-transparent',
                  groupSelected && 'font-medium text-foreground'
                )}
                disabled={!group}
                onClick={() => group && onSelectGroup(group)}
              >
                <Layers2 data-icon="inline-start" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{label}</span>
              </Button>
              {!readOnly && group && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className={cn(
                        'shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100',
                        groupSelected && 'opacity-100'
                      )}
                      aria-label={`${group.name}操作`}
                    >
                      <Ellipsis data-icon="icon-only" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-20">
                    <DropdownMenuGroup>
                      <DropdownMenuItem onSelect={() => onEditGroup(group)}>
                        <Pencil className="size-4" />
                        编辑
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => onDeleteGroup(group)}
                      >
                        <Trash2 className="size-4" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            {!collapsed && (
              <div className="mt-1 grid min-w-0 gap-1 pl-5">
                {groupAccounts.map((account) => {
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
                        <span className="min-w-0 flex-1 truncate text-left">
                          {account.name}
                        </span>
                      </Button>
                      {!readOnly && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-xs"
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
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => onDelete(account)}
                              >
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
                {!readOnly && group && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-full justify-start px-3 text-muted-foreground"
                    onClick={() => onCreateAccount(group)}
                  >
                    <Plus data-icon="inline-start" />
                    新建资产账户
                  </Button>
                )}
              </div>
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
  const [selectedAssetAccountId, setSelectedAssetAccountId] = useState<string | null>(null)
  const [selectedAccountGroupId, setSelectedAccountGroupId] = useState<string | null>(null)
  const [selectedPositionGroupId, setSelectedPositionGroupId] = useState<string | null>(null)
  const [showTimeMachine, setShowTimeMachine] = useState(false)
  const [workspaceDialog, setWorkspaceDialog] = useState<WorkspaceDialogState>({ open: false })
  const [workspaceSwitcherOpen, setWorkspaceSwitcherOpen] = useState(false)
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false)
  const [workspaceSettingsSection, setWorkspaceSettingsSection] = useState<'basic' | 'currency'>(
    'basic'
  )
  const [assetDialog, setAssetDialog] = useState<AssetDialogState>({ open: false })
  const [positionDialog, setPositionDialog] = useState<PositionDialogState>({ open: false })
  const [accountGroupDialog, setAccountGroupDialog] = useState<AccountGroupDialogState>({
    open: false
  })
  const [positionGroupDialog, setPositionGroupDialog] = useState<PositionGroupDialogState>({
    open: false
  })
  const [groupAccountsDialogOpen, setGroupAccountsDialogOpen] = useState(false)
  const [groupPositionsDialogOpen, setGroupPositionsDialogOpen] = useState(false)
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
  const selectedAssetAccount =
    activeWorkspace?.assetAccounts.find(
      (account) => account.id === selectedAssetAccountId
    ) ?? null
  const selectedAccountGroup =
    activeWorkspace?.accountGroups.find(
      (group) => group.id === selectedAccountGroupId
    ) ?? null
  const selectedPositionGroup =
    activeWorkspace?.positionGroups.find(
      (group) => group.id === selectedPositionGroupId
    ) ?? null

  useEffect(() => {
    setSelectedSnapshotId(null)
    setSelectedAssetAccountId(null)
    setSelectedAccountGroupId(null)
    setSelectedPositionGroupId(null)
  }, [latestWorkspace?.id])

  async function syncAssetAccount(assetAccountId: string): Promise<void> {
    if (
      !latestWorkspace ||
      selectedSnapshot ||
      syncingAccountIds.current.has(assetAccountId)
    ) return
    const assetAccount = latestWorkspace.assetAccounts.find(
      (account) => account.id === assetAccountId
    )
    if (!assetAccount?.sync) return

    syncingAccountIds.current.add(assetAccountId)
    setSyncStates((current) => ({
      ...current,
      [assetAccountId]: {
        status: 'syncing'
      }
    }))
    try {
      await portfolio.syncAssetAccount(
        latestWorkspace.id,
        assetAccountId
      )
    } catch (error) {
      reportPortfolioError(error, `${assetAccount.name} 同步失败`)
    } finally {
      syncingAccountIds.current.delete(assetAccountId)
      setSyncStates((current) => {
        const next = { ...current }
        delete next[assetAccountId]
        return next
      })
    }
  }

  const autoSyncAccounts =
    selectedSnapshot
      ? []
      : latestWorkspace?.assetAccounts.flatMap((account) =>
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
      void syncAssetAccount(account.id)
      return window.setInterval(
        () => void syncAssetAccount(account.id),
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
        assetAccountCount: workspace.assetAccounts.length,
        groupCount: workspace.positionGroups.length,
        positionCount: workspace.assetAccounts.reduce(
          (total, assetAccount) => total + assetAccount.positions.length,
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
      setSelectedAssetAccountId(null)
      setSelectedAccountGroupId(null)
      setSelectedPositionGroupId(null)
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
          assetAccountCount={pendingImport?.assetAccountCount ?? 0}
          groupCount={pendingImport?.groupCount ?? 0}
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

  async function submitAssetAccount(input: AssetAccountInput): Promise<void> {
    if (!activeWorkspace) return
    if (assetDialog.account) {
      await portfolio.updateAssetAccount(activeWorkspace.id, assetDialog.account.id, input)
      toast.success('资产账户已更新')
      return
    }
    const id = await portfolio.createAssetAccount(activeWorkspace.id, input)
    if (assetDialog.groupId) {
      const group = activeWorkspace.accountGroups.find(
        (item) => item.id === assetDialog.groupId
      )
      if (!group) throw new Error('没有找到对应的账户分组')
      const membershipError = await portfolio.setAccountGroupAccounts(
        activeWorkspace.id,
        group.id,
        [...group.assetAccountIds, id]
      )
      if (membershipError) throw new Error(membershipError)
    }
    setSelectedAccountGroupId(null)
    setSelectedPositionGroupId(null)
    setSelectedAssetAccountId(id)
    toast.success('资产账户已添加')
  }

  async function submitAccountGroup(input: AccountGroupInput): Promise<void> {
    if (!activeWorkspace) return
    if (accountGroupDialog.group) {
      await portfolio.updateAccountGroup(
        activeWorkspace.id,
        accountGroupDialog.group.id,
        input
      )
      toast.success('账户分组已更新')
      return
    }
    const id = await portfolio.createAccountGroup(activeWorkspace.id, input)
    setSelectedAssetAccountId(null)
    setSelectedPositionGroupId(null)
    setSelectedAccountGroupId(id)
    toast.success('账户分组已创建')
  }

  async function submitGroupAccounts(assetAccountIds: string[]): Promise<string | null> {
    if (!activeWorkspace || !selectedAccountGroup) {
      return '没有找到对应的账户分组'
    }
    const result = await portfolio.setAccountGroupAccounts(
      activeWorkspace.id,
      selectedAccountGroup.id,
      assetAccountIds
    )
    if (!result) toast.success('账户分组已更新')
    return result
  }

  async function submitPositionGroup(input: PositionGroupInput): Promise<void> {
    if (!activeWorkspace) return
    if (positionGroupDialog.group) {
      await portfolio.updatePositionGroup(
        activeWorkspace.id,
        positionGroupDialog.group.id,
        input
      )
      toast.success('持仓分组已更新')
      return
    }
    const id = await portfolio.createPositionGroup(activeWorkspace.id, input)
    setSelectedAssetAccountId(null)
    setSelectedAccountGroupId(null)
    setSelectedPositionGroupId(id)
    toast.success('持仓分组已创建')
  }

  async function submitGroupPositions(positionIds: string[]): Promise<string | null> {
    if (!activeWorkspace || !selectedPositionGroup) {
      return '没有找到对应的持仓分组'
    }
    const result = await portfolio.setPositionGroupPositions(
      activeWorkspace.id,
      selectedPositionGroup.id,
      positionIds
    )
    if (!result) toast.success('持仓分组已更新')
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
          : deleteTarget.kind === 'asset'
            ? '资产账户已删除'
            : deleteTarget.kind === 'account-group'
              ? '账户分组已删除'
              : deleteTarget.kind === 'position-group'
              ? '持仓分组已删除'
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
      } else if (deleteTarget.kind === 'asset') {
        await portfolio.deleteAssetAccount(latestWorkspace.id, deleteTarget.account.id)
        setSelectedAssetAccountId(null)
      } else if (deleteTarget.kind === 'account-group') {
        await portfolio.deleteAccountGroup(latestWorkspace.id, deleteTarget.group.id)
        setSelectedAccountGroupId(null)
      } else if (deleteTarget.kind === 'position-group') {
        await portfolio.deletePositionGroup(latestWorkspace.id, deleteTarget.group.id)
        setSelectedPositionGroupId(null)
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
        description: `将同时删除 ${deleteTarget.workspace.accountGroups.length} 个账户分组、${deleteTarget.workspace.assetAccounts.length} 个资产账户、${deleteTarget.workspace.positionGroups.length} 个持仓分组和全部持仓。此操作无法撤销`
      }
    }
    if (deleteTarget.kind === 'asset') {
      return {
        title: `删除“${deleteTarget.account.name}”？`,
        description: `将同时删除 ${deleteTarget.account.positions.length} 项持仓。此操作无法撤销`
      }
    }
    if (deleteTarget.kind === 'account-group') {
      return {
        title: `删除账户分组“${deleteTarget.group.name}”？`,
        description: '只会删除账户分组，不会影响其中的资产账户及持仓。此操作无法撤销'
      }
    }
    if (deleteTarget.kind === 'position-group') {
      return {
        title: `删除持仓分组“${deleteTarget.group.name}”？`,
        description: '只会删除持仓分组，不会影响原资产账户及其中的持仓。此操作无法撤销'
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
                  !selectedAssetAccountId &&
                    !selectedAccountGroupId &&
                    !selectedPositionGroupId &&
                    !showTimeMachine &&
                    cn(SELECTED_NAVIGATION_CLASS_NAME, 'font-medium')
                )}
                onClick={() => {
                  setShowTimeMachine(false)
                  setSelectedAssetAccountId(null)
                  setSelectedAccountGroupId(null)
                  setSelectedPositionGroupId(null)
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
                  setSelectedAssetAccountId(null)
                  setSelectedAccountGroupId(null)
                  setSelectedPositionGroupId(null)
                }}
              >
                <History />
                时间机器
              </Button>
            </div>

            <>
                <div className="mb-2 flex items-center gap-1">
                  <p className="flex h-7 min-w-0 flex-1 items-center px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    账户分组
                  </p>
                  {!selectedSnapshot && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="新建账户分组"
                      title="新建账户分组"
                      onClick={() => setAccountGroupDialog({ open: true })}
                    >
                      <Plus />
                    </Button>
                  )}
                </div>
                <div className="grid min-w-0 gap-1">
                    <AssetAccountNavigation
                      key={activeWorkspace.id}
                      accounts={activeWorkspace.assetAccounts}
                      accountGroups={activeWorkspace.accountGroups}
                      readOnly={Boolean(selectedSnapshot)}
                      selectedAccountId={selectedAssetAccountId}
                      selectedAccountGroupId={selectedAccountGroupId}
                      onSelect={(account) => {
                        setShowTimeMachine(false)
                        setSelectedAccountGroupId(null)
                        setSelectedPositionGroupId(null)
                        setSelectedAssetAccountId(account.id)
                      }}
                      onSelectGroup={(group) => {
                        setShowTimeMachine(false)
                        setSelectedAssetAccountId(null)
                        setSelectedPositionGroupId(null)
                        setSelectedAccountGroupId(group.id)
                      }}
                      onEdit={(account) => setAssetDialog({ open: true, account })}
                      onDelete={(account) => setDeleteTarget({ kind: 'asset', account })}
                      onCreateAccount={(group) =>
                        setAssetDialog({ open: true, groupId: group.id })
                      }
                      onEditGroup={(group) =>
                        setAccountGroupDialog({ open: true, group })
                      }
                      onDeleteGroup={(group) =>
                        setDeleteTarget({ kind: 'account-group', group })
                      }
                    />
                    {!activeWorkspace.assetAccounts.length && (
                      <p className="px-3 py-2 text-xs leading-5 text-muted-foreground">
                        还没有资产账户
                      </p>
                    )}
                </div>

                <div className="mb-2 mt-5 flex items-center gap-1">
                  <p className="flex h-7 min-w-0 flex-1 items-center px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    持仓分组
                  </p>
                  {!selectedSnapshot && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="新建持仓分组"
                      title="新建持仓分组"
                      onClick={() => setPositionGroupDialog({ open: true })}
                    >
                      <Plus />
                    </Button>
                  )}
                </div>
                <div className="grid min-w-0 gap-1">
                    {activeWorkspace.positionGroups.map((group) => {
                      const selected = selectedPositionGroupId === group.id
                      return (
                        <div
                          key={group.id}
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
                            onClick={() => {
                              setShowTimeMachine(false)
                              setSelectedAssetAccountId(null)
                              setSelectedAccountGroupId(null)
                              setSelectedPositionGroupId(group.id)
                            }}
                          >
                            <Folder data-icon="inline-start" />
                            <span className="min-w-0 flex-1 truncate text-left">
                              {group.name}
                            </span>
                          </Button>
                          {!selectedSnapshot && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  className={cn(
                                    'shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100',
                                    selected && 'opacity-100'
                                  )}
                                  aria-label={`${group.name}操作`}
                                >
                                  <Ellipsis />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="min-w-20">
                                <DropdownMenuGroup>
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      setPositionGroupDialog({ open: true, group })
                                    }
                                  >
                                    <Pencil />
                                    编辑
                                  </DropdownMenuItem>
                                </DropdownMenuGroup>
                                <DropdownMenuSeparator />
                                <DropdownMenuGroup>
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onSelect={() =>
                                      setDeleteTarget({ kind: 'position-group', group })
                                    }
                                  >
                                    <Trash2 />
                                    删除
                                  </DropdownMenuItem>
                                </DropdownMenuGroup>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      )
                    })}
                    {!activeWorkspace.positionGroups.length && (
                      <p className="px-3 py-2 text-xs leading-5 text-muted-foreground">
                        还没有持仓分组
                      </p>
                    )}
                </div>
            </>
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
        ) : selectedAccountGroup ? (
          <AccountGroupDetail
            group={selectedAccountGroup}
            assetAccounts={activeWorkspace.assetAccounts}
            readOnly={Boolean(selectedSnapshot)}
            baseCurrency={activeWorkspace.baseCurrency}
            exchangeRates={exchangeRates}
            onManageAccounts={() => setGroupAccountsDialogOpen(true)}
          />
        ) : selectedPositionGroup ? (
          <PositionGroupDetail
            group={selectedPositionGroup}
            assetAccounts={activeWorkspace.assetAccounts}
            accountGroups={activeWorkspace.accountGroups}
            readOnly={Boolean(selectedSnapshot)}
            baseCurrency={activeWorkspace.baseCurrency}
            exchangeRates={exchangeRates}
            onManagePositions={() => setGroupPositionsDialogOpen(true)}
          />
        ) : selectedAssetAccount ? (
          <AssetAccountDetail
            account={selectedAssetAccount}
            readOnly={Boolean(selectedSnapshot)}
            baseCurrency={activeWorkspace.baseCurrency}
            exchangeRates={exchangeRates}
            onAddPosition={() =>
              setPositionDialog({ open: true, accountId: selectedAssetAccount.id })
            }
            onSync={() => syncAssetAccount(selectedAssetAccount.id)}
            syncState={syncStates[selectedAssetAccount.id]}
            onEditPosition={(position) =>
              setPositionDialog({
                open: true,
                accountId: selectedAssetAccount.id,
                position
              })
            }
            onDeletePosition={(position) =>
              setDeleteTarget({ kind: 'position', account: selectedAssetAccount, position })
            }
          />
        ) : (
          <Overview
            workspace={activeWorkspace}
            exchangeRates={exchangeRates}
            readOnly={Boolean(selectedSnapshot)}
            onCreateAssetAccount={() => setAssetDialog({ open: true })}
            onOpenAssetAccount={(id) => {
              setSelectedAccountGroupId(null)
              setSelectedPositionGroupId(null)
              setSelectedAssetAccountId(id)
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
      <AssetAccountDialog
        open={assetDialog.open}
        onOpenChange={(open) =>
          setAssetDialog((current) => (open ? { ...current, open } : { open: false }))
        }
        account={assetDialog.account}
        integration={
          assetDialog.account
            ? portfolio.getAssetAccountIntegration(assetDialog.account.id)
            : undefined
        }
        onSubmit={submitAssetAccount}
      />
      <AccountGroupDialog
        open={accountGroupDialog.open}
        onOpenChange={(open) =>
          setAccountGroupDialog((current) => ({ ...current, open }))
        }
        group={accountGroupDialog.group}
        onSubmit={submitAccountGroup}
      />
      <PositionDialog
        open={positionDialog.open}
        onOpenChange={(open) => setPositionDialog((current) => ({ ...current, open }))}
        position={positionDialog.position}
        onSubmit={submitPosition}
      />
      <PositionGroupDialog
        open={positionGroupDialog.open}
        onOpenChange={(open) =>
          setPositionGroupDialog((current) => ({ ...current, open }))
        }
        group={positionGroupDialog.group}
        onSubmit={submitPositionGroup}
      />
      {selectedPositionGroup && (
        <GroupPositionsDialog
          open={groupPositionsDialogOpen}
          onOpenChange={setGroupPositionsDialogOpen}
          group={selectedPositionGroup}
          assetAccounts={activeWorkspace.assetAccounts}
          accountGroups={activeWorkspace.accountGroups}
          positionGroups={activeWorkspace.positionGroups}
          onSubmit={submitGroupPositions}
        />
      )}
      {selectedAccountGroup && (
        <GroupAccountsDialog
          open={groupAccountsDialogOpen}
          onOpenChange={setGroupAccountsDialogOpen}
          group={selectedAccountGroup}
          assetAccounts={activeWorkspace.assetAccounts}
          accountGroups={activeWorkspace.accountGroups}
          onSubmit={submitGroupAccounts}
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
        assetAccountCount={pendingImport?.assetAccountCount ?? 0}
        groupCount={pendingImport?.groupCount ?? 0}
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
