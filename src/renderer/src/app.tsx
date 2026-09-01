import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeftRight,
  ChartSpline,
  ChevronDown,
  ChevronUp,
  Download,
  Ellipsis,
  Eye,
  EyeOff,
  Folder,
  History,
  Layers2,
  Layers3,
  Pencil,
  Plus,
  Trash2,
  Upload
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
  ProductAccountDialog,
  ProductAccountSwitcherDialog,
  ProductAccountSettingsDialog
} from '@/components/portfolio/dialogs'
import {
  AppLoadingSkeleton,
  EmptyProductAccount,
  PortfolioLoadError,
  SnapshotViewingAlert,
  reportPortfolioError
} from '@/components/portfolio/feedback'
import {
  Overview,
  type OverviewMode
} from '@/components/portfolio/overview'
import {
  createShareImageDataUrl,
  type ShareImageScope
} from '@/components/portfolio/share-image-dialog'
import { TimeMachine } from '@/components/portfolio/time-machine'
import {
  ASSET_VALUE_MASK_STORAGE_KEY,
  AccountTypeIcon,
  AssetValueMaskContext,
  accountSyncInterval,
  loadAssetValueMask,
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
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import {
  useExchangeRates,
  type ExchangeRateState
} from '@/lib/exchange-rates'
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
  type PortfolioSnapshot,
  type ProductAccount,
  type ProductAccountInput,
  type ProductAccountSettingsInput,
  usePortfolio
} from '@/lib/portfolio'
import { toast } from 'sonner'

type ProductDialogState = { open: boolean }
type AssetDialogState = { open: boolean; account?: AssetAccount; groupId?: string }
type PositionDialogState = { open: boolean; accountId?: string; position?: Position }
type AccountGroupDialogState = { open: boolean; group?: AccountGroup }
type PositionGroupDialogState = { open: boolean; group?: PositionGroup }
type DeleteTarget =
  | { kind: 'product'; account: ProductAccount }
  | { kind: 'asset'; account: AssetAccount }
  | { kind: 'account-group'; group: AccountGroup }
  | { kind: 'position-group'; group: PositionGroup }
  | { kind: 'position'; account: AssetAccount; position: Position }
  | { kind: 'snapshot'; snapshot: PortfolioSnapshot }
  | null

type PendingImport = {
  account: ProductAccount
  snapshots: PortfolioSnapshot[]
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
  accountGroups: ProductAccount['accountGroups']
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
      label: '-',
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
        const accessibilityLabel = group?.name ?? '未分组账户'
        return (
          <div key={id} className="min-w-0 pl-2">
            <div
              className={cn(
                'group flex min-w-0 items-center rounded-md pr-1 transition-colors hover:bg-muted/70',
                groupSelected && SELECTED_NAVIGATION_CLASS_NAME
              )}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 hover:bg-transparent"
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
                      size="icon"
                      className={cn(
                        'size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100',
                        groupSelected && 'opacity-100'
                      )}
                      aria-label={`${group.name}操作`}
                    >
                      <Ellipsis className="size-3.5" />
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
                        'group flex min-w-0 items-center rounded-md pr-1 transition-colors hover:bg-muted/70',
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
                              size="icon"
                              className={cn(
                                'size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100',
                                selected && 'opacity-100'
                              )}
                              aria-label={`${account.name}操作`}
                            >
                              <Ellipsis className="size-3.5" />
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
  const latestProductAccount = portfolio.activeProductAccount
  const liveExchangeRates = useExchangeRates(
    latestProductAccount?.exchangeRateProvider,
    latestProductAccount?.exchangeRateRefreshIntervalMinutes,
    Boolean(latestProductAccount) && !selectedSnapshot
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
  const [overviewMode, setOverviewMode] = useState<OverviewMode>('accounts')
  const [showTimeMachine, setShowTimeMachine] = useState(false)
  const [productDialog, setProductDialog] = useState<ProductDialogState>({ open: false })
  const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false)
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false)
  const [accountSettingsSection, setAccountSettingsSection] = useState<'basic' | 'currency'>(
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
  const [imageExporting, setImageExporting] = useState(false)
  const [choosingImport, setChoosingImport] = useState(false)
  const [creatingSnapshot, setCreatingSnapshot] = useState(false)
  const [removingGroupPositionIds, setRemovingGroupPositionIds] = useState<Set<string>>(
    () => new Set()
  )
  const [removingGroupAccountIds, setRemovingGroupAccountIds] = useState<Set<string>>(
    () => new Set()
  )
  const [assetValuesMasked, setAssetValuesMasked] = useState(loadAssetValueMask)
  const syncingAccountIds = useRef(new Set<string>())
  const imageExportingRef = useRef(false)
  const choosingImportRef = useRef(false)
  const creatingSnapshotRef = useRef(false)
  const removingGroupPositionIdsRef = useRef(new Set<string>())
  const removingGroupAccountIdsRef = useRef(new Set<string>())

  useEffect(() => {
    if (!portfolio.refreshError) return
    toast.error('资产数据刷新失败', {
      description: `已保留当前页面数据。${portfolio.refreshError}`,
      id: 'portfolio-refresh-error'
    })
  }, [portfolio.refreshError])

  useEffect(() => {
    if (exchangeRates.status !== 'error' || !exchangeRates.error) return
    toast.error(exchangeRates.snapshot ? '汇率刷新失败' : '汇率加载失败', {
      description: exchangeRates.error,
      id: 'exchange-rate-error'
    })
  }, [exchangeRates.error, exchangeRates.snapshot, exchangeRates.status])

  const activeProductAccount = selectedSnapshot?.account ?? latestProductAccount
  const selectedAssetAccount =
    activeProductAccount?.assetAccounts.find(
      (account) => account.id === selectedAssetAccountId
    ) ?? null
  const selectedAccountGroup =
    activeProductAccount?.accountGroups.find(
      (group) => group.id === selectedAccountGroupId
    ) ?? null
  const selectedPositionGroup =
    activeProductAccount?.positionGroups.find(
      (group) => group.id === selectedPositionGroupId
    ) ?? null

  useEffect(() => {
    setSelectedSnapshotId(null)
    setSelectedAssetAccountId(null)
    setSelectedAccountGroupId(null)
    setSelectedPositionGroupId(null)
  }, [latestProductAccount?.id])

  async function syncAssetAccount(assetAccountId: string): Promise<void> {
    if (
      !latestProductAccount ||
      selectedSnapshot ||
      syncingAccountIds.current.has(assetAccountId)
    ) return
    const assetAccount = latestProductAccount.assetAccounts.find(
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
        latestProductAccount.id,
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
      : latestProductAccount?.assetAccounts.flatMap((account) =>
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
  }, [latestProductAccount?.id, selectedSnapshotId, autoSyncKey])

  async function exportAccount(): Promise<void> {
    try {
      if (!window.desktop.backup?.exportData) {
        throw new Error('数据组件尚未加载，请重启 Chromie')
      }
      const result = await window.desktop.backup.exportData(await portfolio.exportAccount())
      setExportDialogOpen(false)
      if (!result.canceled) toast.success('账户备份已导出')
    } catch (error) {
      reportPortfolioError(error, '导出账户失败')
      throw error
    }
  }

  async function exportImage(scope: ShareImageScope): Promise<void> {
    if (imageExportingRef.current) return
    imageExportingRef.current = true
    try {
      setImageExporting(true)
      if (!activeProductAccount) throw new Error('没有找到可导出的账户')
      if (!window.desktop.shareImage?.save) {
        throw new Error('图片导出组件尚未加载，请重启 Chromie')
      }
      const dataUrl = await createShareImageDataUrl({
        account: activeProductAccount,
        scope,
        exchangeRates,
        masked: assetValuesMasked,
        snapshotAt: selectedSnapshot?.createdAt
      })
      const exportName = scope.kind === 'asset-account'
        ? scope.account.name
        : scope.kind === 'position-group'
          ? scope.group.name
          : activeProductAccount.name
      const result = await window.desktop.shareImage.save(dataUrl, exportName)
      if (!result.canceled) toast.success('图片已导出')
    } catch (error) {
      reportPortfolioError(error, '导出图片失败')
    } finally {
      imageExportingRef.current = false
      setImageExporting(false)
    }
  }

  async function chooseImportAccount(): Promise<void> {
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
        toast.error('无法导入账户', {
          description: '备份文件无效或版本不受支持'
        })
        return
      }
      const { account, snapshots } = backup
      setPendingImport({
        account,
        snapshots,
        assetAccountCount: account.assetAccounts.length,
        groupCount: account.positionGroups.length,
        positionCount: account.assetAccounts.reduce(
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

  async function confirmImportAccount(): Promise<void> {
    if (!pendingImport) return
    try {
      setSelectedAssetAccountId(null)
      setSelectedAccountGroupId(null)
      setSelectedPositionGroupId(null)
      await portfolio.importAccount(pendingImport.account, pendingImport.snapshots)
      setPendingImport(null)
      toast.success('账户已导入')
    } catch (error) {
      reportPortfolioError(error, '导入账户失败')
    }
  }

  if (portfolio.loading) {
    return <AppLoadingSkeleton />
  }

  if (portfolio.error) {
    return <PortfolioLoadError message={portfolio.error} />
  }

  if (!activeProductAccount) {
    return (
      <>
        <EmptyProductAccount
          onCreate={() => setProductDialog({ open: true })}
          onImport={() => void chooseImportAccount()}
          importing={choosingImport}
        />
        <ProductAccountDialog
          open={productDialog.open}
          onOpenChange={(open) => setProductDialog({ open })}
          onSubmit={async (input) => {
            await portfolio.createProductAccount(input)
            toast.success('账户已创建')
          }}
        />
        <ImportBackupDialog
          open={pendingImport !== null}
          onOpenChange={(open) => {
            if (!open) setPendingImport(null)
          }}
          accountName={pendingImport?.account.name ?? ''}
          assetAccountCount={pendingImport?.assetAccountCount ?? 0}
          groupCount={pendingImport?.groupCount ?? 0}
          positionCount={pendingImport?.positionCount ?? 0}
          snapshotCount={pendingImport?.snapshotCount ?? 0}
          onConfirm={confirmImportAccount}
        />
      </>
    )
  }

  async function submitProductAccount(input: ProductAccountInput): Promise<void> {
    await portfolio.createProductAccount(input)
    toast.success('账户已创建')
  }

  async function createCurrentSnapshot(): Promise<void> {
    if (!latestProductAccount || selectedSnapshot || creatingSnapshotRef.current) return
    creatingSnapshotRef.current = true
    setCreatingSnapshot(true)
    try {
      await portfolio.createSnapshot(latestProductAccount.id, liveExchangeRates.snapshot)
      toast.success('快照已创建')
    } catch (error) {
      reportPortfolioError(error, '创建快照失败')
    } finally {
      creatingSnapshotRef.current = false
      setCreatingSnapshot(false)
    }
  }

  async function removePositionFromGroup(
    groupId: string,
    positionId: string
  ): Promise<void> {
    if (!activeProductAccount || removingGroupPositionIdsRef.current.has(positionId)) return
    removingGroupPositionIdsRef.current.add(positionId)
    setRemovingGroupPositionIds(new Set(removingGroupPositionIdsRef.current))
    try {
      await portfolio.removePositionFromGroup(activeProductAccount.id, groupId, positionId)
      toast.success('已移出持仓分组')
    } catch (error) {
      reportPortfolioError(error, '移出持仓失败')
    } finally {
      removingGroupPositionIdsRef.current.delete(positionId)
      setRemovingGroupPositionIds(new Set(removingGroupPositionIdsRef.current))
    }
  }

  async function removeAccountFromGroup(
    groupId: string,
    assetAccountId: string
  ): Promise<void> {
    if (!activeProductAccount || removingGroupAccountIdsRef.current.has(assetAccountId)) return
    removingGroupAccountIdsRef.current.add(assetAccountId)
    setRemovingGroupAccountIds(new Set(removingGroupAccountIdsRef.current))
    try {
      await portfolio.removeAccountFromGroup(
        activeProductAccount.id,
        groupId,
        assetAccountId
      )
      toast.success('已移出资产分组')
    } catch (error) {
      reportPortfolioError(error, '移出资产分组失败')
    } finally {
      removingGroupAccountIdsRef.current.delete(assetAccountId)
      setRemovingGroupAccountIds(new Set(removingGroupAccountIdsRef.current))
    }
  }

  async function submitProductAccountSettings(
    input: ProductAccountSettingsInput
  ): Promise<void> {
    if (!activeProductAccount) return
    await portfolio.updateProductAccount(activeProductAccount.id, input)
    toast.success('账户设置已保存')
  }

  async function submitAssetAccount(input: AssetAccountInput): Promise<void> {
    if (!activeProductAccount) return
    if (assetDialog.account) {
      await portfolio.updateAssetAccount(activeProductAccount.id, assetDialog.account.id, input)
      toast.success('资产账户已更新')
      return
    }
    const id = await portfolio.createAssetAccount(activeProductAccount.id, input)
    if (assetDialog.groupId) {
      const group = activeProductAccount.accountGroups.find(
        (item) => item.id === assetDialog.groupId
      )
      if (!group) throw new Error('没有找到对应的资产分组')
      const membershipError = await portfolio.setAccountGroupAccounts(
        activeProductAccount.id,
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
    if (!activeProductAccount) return
    if (accountGroupDialog.group) {
      await portfolio.updateAccountGroup(
        activeProductAccount.id,
        accountGroupDialog.group.id,
        input
      )
      toast.success('资产分组已更新')
      return
    }
    const id = await portfolio.createAccountGroup(activeProductAccount.id, input)
    setSelectedAssetAccountId(null)
    setSelectedPositionGroupId(null)
    setSelectedAccountGroupId(id)
    toast.success('资产分组已创建')
  }

  async function submitGroupAccounts(assetAccountIds: string[]): Promise<string | null> {
    if (!activeProductAccount || !selectedAccountGroup) {
      return '没有找到对应的资产分组'
    }
    const result = await portfolio.setAccountGroupAccounts(
      activeProductAccount.id,
      selectedAccountGroup.id,
      assetAccountIds
    )
    if (!result) toast.success('分组账户已保存')
    return result
  }

  async function submitPositionGroup(input: PositionGroupInput): Promise<void> {
    if (!activeProductAccount) return
    if (positionGroupDialog.group) {
      await portfolio.updatePositionGroup(
        activeProductAccount.id,
        positionGroupDialog.group.id,
        input
      )
      toast.success('持仓分组已更新')
      return
    }
    const id = await portfolio.createPositionGroup(activeProductAccount.id, input)
    setSelectedAssetAccountId(null)
    setSelectedAccountGroupId(null)
    setSelectedPositionGroupId(id)
    toast.success('持仓分组已创建')
  }

  async function submitGroupPositions(positionIds: string[]): Promise<string | null> {
    if (!activeProductAccount || !selectedPositionGroup) {
      return '没有找到对应的持仓分组'
    }
    const result = await portfolio.setPositionGroupPositions(
      activeProductAccount.id,
      selectedPositionGroup.id,
      positionIds
    )
    if (!result) toast.success('分组持仓已保存')
    return result
  }

  async function submitPosition(input: PositionInput): Promise<string | null> {
    if (!activeProductAccount || !positionDialog.accountId) {
      return '没有找到对应的资产账户'
    }
    const result = await portfolio.savePosition(
      activeProductAccount.id,
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
      deleteTarget.kind === 'product'
        ? '账户已注销'
        : deleteTarget.kind === 'snapshot'
          ? '快照已删除'
          : deleteTarget.kind === 'asset'
            ? '资产账户已删除'
            : deleteTarget.kind === 'account-group'
              ? '资产分组已删除'
              : deleteTarget.kind === 'position-group'
              ? '持仓分组已删除'
              : '持仓已删除'
    try {
      if (deleteTarget.kind === 'snapshot') {
        await portfolio.deleteSnapshot(deleteTarget.snapshot.id)
        if (deleteTarget.snapshot.id === selectedSnapshotId) {
          setSelectedSnapshotId(null)
        }
      } else if (!latestProductAccount) {
        return
      } else if (deleteTarget.kind === 'product') {
        await portfolio.deleteProductAccount(deleteTarget.account.id)
      } else if (deleteTarget.kind === 'asset') {
        await portfolio.deleteAssetAccount(latestProductAccount.id, deleteTarget.account.id)
        setSelectedAssetAccountId(null)
      } else if (deleteTarget.kind === 'account-group') {
        await portfolio.deleteAccountGroup(latestProductAccount.id, deleteTarget.group.id)
        setSelectedAccountGroupId(null)
      } else if (deleteTarget.kind === 'position-group') {
        await portfolio.deletePositionGroup(latestProductAccount.id, deleteTarget.group.id)
        setSelectedPositionGroupId(null)
      } else {
        await portfolio.deletePosition(
          latestProductAccount.id,
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

  function toggleAssetValueMask(): void {
    setAssetValuesMasked((current) => {
      const next = !current
      try {
        window.localStorage.setItem(ASSET_VALUE_MASK_STORAGE_KEY, String(next))
      } catch {
        // The privacy toggle still works for the current session if storage is unavailable.
      }
      return next
    })
  }

  const deleteDialogCopy = (() => {
    if (!deleteTarget) return { title: '', description: '' }
    if (deleteTarget.kind === 'snapshot') {
      return {
        title: `删除版本 #${shortSnapshotHash(deleteTarget.snapshot.id)}？`,
        description: '只会删除这个历史版本，最新版资产不会受到影响。此操作无法撤销'
      }
    }
    if (deleteTarget.kind === 'product') {
      return {
        title: `注销账户“${deleteTarget.account.name}”？`,
        description: `将同时删除 ${deleteTarget.account.accountGroups.length} 个资产分组、${deleteTarget.account.assetAccounts.length} 个资产账户、${deleteTarget.account.positionGroups.length} 个持仓分组和全部持仓。此操作无法撤销`
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
        title: `删除资产分组“${deleteTarget.group.name}”？`,
        description: '只会删除资产分组，不会影响其中的资产账户及持仓。此操作无法撤销'
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

  const productAccountSwitcher = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto w-full justify-start gap-3 px-2 py-2"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-sm bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
            {activeProductAccount.name.trim().slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">
            {activeProductAccount.name}
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
          {!selectedSnapshot && (
            <DropdownMenuItem
              onSelect={() => {
                setAccountSettingsSection('basic')
                setAccountSettingsOpen(true)
              }}
            >
              <Pencil />
              账户设置
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setExportDialogOpen(true)}>
            <Upload />
            导出账户
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={choosingImport}
            aria-busy={choosingImport}
            onSelect={() => void chooseImportAccount()}
          >
            {choosingImport ? <Spinner /> : <Download />}
            {choosingImport ? '读取中…' : '导入账户'}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => setProductDialog({ open: true })}>
            <Plus />
            新建账户
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAccountSwitcherOpen(true)}>
            <ArrowLeftRight />
            切换账户
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="flex h-screen min-h-[600px] overflow-hidden bg-background">
      <div className="window-drag fixed inset-x-0 top-0 z-40 h-12" />
      <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar pt-12 text-sidebar-foreground">
        <div className="px-4 pb-4 pt-2">
          <div className="flex items-center gap-2 px-2">
            <span className="grid size-8 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
              <Layers3 data-icon="inline-start" className="size-4" />
            </span>
            <span className="text-[15px] font-semibold tracking-[-0.02em]">Chromie</span>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto size-8"
              aria-label={assetValuesMasked ? '显示资产数据' : '遮蔽资产数据'}
              aria-pressed={assetValuesMasked}
              title={assetValuesMasked ? '显示资产数据' : '遮蔽资产数据'}
              onClick={toggleAssetValueMask}
            >
              {assetValuesMasked ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </Button>
          </div>
        </div>

        <Separator />

        <ScrollArea className="min-h-0 flex-1">
          <nav className="px-3 py-4">
          <div className="mb-5 grid gap-1">
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
              <ChartSpline className="size-4" />
              资产透视
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
              <History className="size-4" />
              时间机器
              {portfolio.activeSnapshots.length > 0 && (
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {portfolio.activeSnapshots.length}
                </span>
              )}
            </Button>
          </div>

          <div className="mb-2 flex items-center justify-between pl-3 pr-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              资产分组
            </p>
            {!selectedSnapshot && (
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label="新建资产分组"
                onClick={() => setAccountGroupDialog({ open: true })}
              >
                <Plus className="size-3.5" />
              </Button>
            )}
          </div>
          <div className="grid min-w-0 gap-1">
            <AssetAccountNavigation
              key={activeProductAccount.id}
              accounts={activeProductAccount.assetAccounts}
              accountGroups={activeProductAccount.accountGroups}
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
              onEditGroup={(group) => setAccountGroupDialog({ open: true, group })}
              onDeleteGroup={(group) =>
                setDeleteTarget({ kind: 'account-group', group })
              }
            />
            {!activeProductAccount.assetAccounts.length && (
              <p className="px-3 py-2 text-xs leading-5 text-muted-foreground">还没有资产账户</p>
            )}
          </div>

          <div className="mb-2 mt-6 flex items-center justify-between pl-3 pr-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              持仓分组
            </p>
            {!selectedSnapshot && (
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label="新建持仓分组"
                onClick={() => setPositionGroupDialog({ open: true })}
              >
                <Plus className="size-3.5" />
              </Button>
            )}
          </div>
          <div className="grid min-w-0 gap-1">
            {activeProductAccount.positionGroups.map((group) => {
              const selected = selectedPositionGroupId === group.id
              return (
                <div
                  key={group.id}
                  className={cn(
                    'group flex min-w-0 items-center rounded-md pr-1 transition-colors hover:bg-muted/70',
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
                    <Folder className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-left">{group.name}</span>
                  </Button>
                  {!selectedSnapshot && <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100',
                          selected && 'opacity-100'
                        )}
                        aria-label={`${group.name}操作`}
                      >
                        <Ellipsis className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-20">
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          onSelect={() => setPositionGroupDialog({ open: true, group })}
                        >
                          <Pencil className="size-4" />
                          编辑
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setDeleteTarget({ kind: 'position-group', group })}
                        >
                          <Trash2 className="size-4" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>}
                </div>
              )
            })}
            {!activeProductAccount.positionGroups.length && (
              <p className="px-3 py-2 text-xs leading-5 text-muted-foreground">还没有持仓分组</p>
            )}
          </div>
          </nav>
        </ScrollArea>

        <div className="border-t px-3 py-3">
          {productAccountSwitcher}
        </div>
      </aside>

      <AssetValueMaskContext.Provider value={assetValuesMasked}>
        <ScrollArea className="min-w-0 flex-1">
          <main className="pt-12">
        {selectedSnapshot && !showTimeMachine && (
          <SnapshotViewingAlert
            snapshot={selectedSnapshot}
            onReturnLatest={() => setSelectedSnapshotId(null)}
          />
        )}
        {showTimeMachine ? (
          <TimeMachine
            account={latestProductAccount ?? activeProductAccount}
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
            assetAccounts={activeProductAccount.assetAccounts}
            readOnly={Boolean(selectedSnapshot)}
            anchorCurrency={activeProductAccount.anchorCurrency}
            exchangeRates={exchangeRates}
            onManageAccounts={() => setGroupAccountsDialogOpen(true)}
            onRemoveAccount={(assetAccountId) =>
              removeAccountFromGroup(selectedAccountGroup.id, assetAccountId)
            }
            removingAccountIds={removingGroupAccountIds}
          />
        ) : selectedPositionGroup ? (
          <PositionGroupDetail
            group={selectedPositionGroup}
            assetAccounts={activeProductAccount.assetAccounts}
            accountGroups={activeProductAccount.accountGroups}
            readOnly={Boolean(selectedSnapshot)}
            anchorCurrency={activeProductAccount.anchorCurrency}
            exchangeRates={exchangeRates}
            imageExporting={imageExporting}
            onExportImage={() =>
              exportImage({ kind: 'position-group', group: selectedPositionGroup })
            }
            onManagePositions={() => setGroupPositionsDialogOpen(true)}
            onRemovePosition={(positionId) =>
              removePositionFromGroup(selectedPositionGroup.id, positionId)
            }
            removingPositionIds={removingGroupPositionIds}
          />
        ) : selectedAssetAccount ? (
          <AssetAccountDetail
            account={selectedAssetAccount}
            readOnly={Boolean(selectedSnapshot)}
            anchorCurrency={activeProductAccount.anchorCurrency}
            exchangeRates={exchangeRates}
            imageExporting={imageExporting}
            onExportImage={() =>
              exportImage({ kind: 'asset-account', account: selectedAssetAccount })
            }
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
            account={activeProductAccount}
            mode={overviewMode}
            onModeChange={setOverviewMode}
            exchangeRates={exchangeRates}
            imageExporting={imageExporting}
            onExportImage={() =>
              exportImage({ kind: 'overview', mode: overviewMode })
            }
            onOpenAssetAccount={(id) => {
              setSelectedAccountGroupId(null)
              setSelectedPositionGroupId(null)
              setSelectedAssetAccountId(id)
            }}
            onOpenPositionGroup={(id) => {
              setSelectedAssetAccountId(null)
              setSelectedAccountGroupId(null)
              setSelectedPositionGroupId(id)
            }}
          />
        )}
          </main>
        </ScrollArea>
      </AssetValueMaskContext.Provider>

      <ProductAccountDialog
        open={productDialog.open}
        onOpenChange={(open) => setProductDialog((current) => ({ ...current, open }))}
        onSubmit={submitProductAccount}
      />
      <ProductAccountSwitcherDialog
        open={accountSwitcherOpen}
        onOpenChange={setAccountSwitcherOpen}
        accounts={portfolio.productAccounts}
        activeAccountId={latestProductAccount?.id ?? activeProductAccount.id}
        onSelect={async (accountId) => {
          setSelectedSnapshotId(null)
          await portfolio.setActiveProductAccount(accountId)
        }}
      />
      <ProductAccountSettingsDialog
        open={accountSettingsOpen}
        onOpenChange={setAccountSettingsOpen}
        account={activeProductAccount}
        exchangeRates={liveExchangeRateView}
        initialSection={accountSettingsSection}
        onSubmit={submitProductAccountSettings}
        onRequestDelete={() =>
          setDeleteTarget({ kind: 'product', account: activeProductAccount })
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
          assetAccounts={activeProductAccount.assetAccounts}
          positionGroups={activeProductAccount.positionGroups}
          onSubmit={submitGroupPositions}
        />
      )}
      {selectedAccountGroup && (
        <GroupAccountsDialog
          open={groupAccountsDialogOpen}
          onOpenChange={setGroupAccountsDialogOpen}
          group={selectedAccountGroup}
          assetAccounts={activeProductAccount.assetAccounts}
          accountGroups={activeProductAccount.accountGroups}
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
        actionLabel={deleteTarget?.kind === 'product' ? '确认注销' : '确认删除'}
        confirmationPhrase={deleteTarget?.kind === 'product' ? 'DELETE' : undefined}
        onConfirm={confirmDelete}
      />
      <ImportBackupDialog
        open={pendingImport !== null}
        onOpenChange={(open) => {
          if (!open) setPendingImport(null)
        }}
        accountName={pendingImport?.account.name ?? ''}
        assetAccountCount={pendingImport?.assetAccountCount ?? 0}
        groupCount={pendingImport?.groupCount ?? 0}
        positionCount={pendingImport?.positionCount ?? 0}
        snapshotCount={pendingImport?.snapshotCount ?? 0}
        onConfirm={confirmImportAccount}
      />
      <ExportBackupDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onConfirm={exportAccount}
      />
    </div>
  )
}
