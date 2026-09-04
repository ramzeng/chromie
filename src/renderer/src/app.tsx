import { useEffect, useRef, useState } from 'react'

import { AppContent } from '@/components/portfolio/app-content'
import { AppSidebar } from '@/components/portfolio/app-sidebar'
import {
  AccountDialog,
  DeleteConfirmDialog,
  ExportBackupDialog,
  ImportBackupDialog,
  PositionDialog,
  TagDialog,
  TagAssignmentDialog,
  WorkspaceDialog,
  WorkspaceSwitcherDialog,
  WorkspaceSettingsDialog
} from '@/components/portfolio/dialogs'
import {
  AppLoadingScreen,
  EmptyWorkspace,
  PortfolioLoadError,
  reportPortfolioError
} from '@/components/portfolio/feedback'
import { shortSnapshotHash, type ExchangeRateView } from '@/components/portfolio/view-helpers'
import { useAccountSync } from '@/hooks/use-account-sync'
import type { BackupImportPreview } from '../../shared/backup'
import { createExampleWorkspaceData } from '../../shared/example-workspace'
import { useExchangeRates, type ExchangeRateState } from '@/lib/exchange-rates'
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
type TagDialogState = { open: boolean; tag?: Tag }
type TagAssignmentTarget = { accountId: string; position: Position } | null
type DeleteTarget =
  | { kind: 'workspace'; workspace: Workspace }
  | { kind: 'account'; account: Account }
  | { kind: 'tag'; tag: Tag }
  | { kind: 'position'; account: Account; position: Position }
  | { kind: 'snapshot'; snapshot: WorkspaceSnapshot }
  | null

type PendingImport = BackupImportPreview | null

const EXAMPLE_WORKSPACE_DATA = createExampleWorkspaceData()

export function App(): React.JSX.Element {
  const portfolio = usePortfolio()
  const [viewingExampleWorkspace, setViewingExampleWorkspace] = useState(false)
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null)
  const persistedWorkspace = portfolio.activeWorkspace
  const activeSnapshots = viewingExampleWorkspace
    ? EXAMPLE_WORKSPACE_DATA.snapshots
    : portfolio.activeSnapshots
  const selectedSnapshot =
    activeSnapshots.find((snapshot) => snapshot.id === selectedSnapshotId) ?? null
  const latestWorkspace = viewingExampleWorkspace
    ? EXAMPLE_WORKSPACE_DATA.workspace
    : persistedWorkspace
  const liveExchangeRates = useExchangeRates(
    persistedWorkspace?.exchangeRateProvider,
    persistedWorkspace?.exchangeRateRefreshIntervalMinutes,
    Boolean(persistedWorkspace) && !selectedSnapshot && !viewingExampleWorkspace
  )
  async function refreshLiveExchangeRates(): Promise<void> {
    await liveExchangeRates.refresh()
  }
  const liveExchangeRateView: ExchangeRateState = {
    ...liveExchangeRates,
    refresh: refreshLiveExchangeRates
  }
  const currentExchangeRates: ExchangeRateView = viewingExampleWorkspace
    ? {
        snapshot: EXAMPLE_WORKSPACE_DATA.exchangeRates,
        status: 'ready',
        error: ''
      }
    : liveExchangeRateView
  const exchangeRates: ExchangeRateView = selectedSnapshot
    ? {
        snapshot: selectedSnapshot.exchangeRates ?? null,
        status: selectedSnapshot.exchangeRates ? 'ready' : 'error',
        error: selectedSnapshot.exchangeRates ? '' : '快照中没有汇率数据'
      }
    : currentExchangeRates
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null)
  const [showTimeMachine, setShowTimeMachine] = useState(false)
  const [workspaceDialog, setWorkspaceDialog] = useState<WorkspaceDialogState>({ open: false })
  const [workspaceSwitcherOpen, setWorkspaceSwitcherOpen] = useState(false)
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false)
  const [workspaceSettingsSection, setWorkspaceSettingsSection] = useState<
    'basic' | 'currency' | 'quotes' | 'proxy'
  >('basic')
  const [accountDialog, setAccountDialog] = useState<AccountDialogState>({ open: false })
  const [positionDialog, setPositionDialog] = useState<PositionDialogState>({ open: false })
  const [tagDialog, setTagDialog] = useState<TagDialogState>({ open: false })
  const [tagAssignmentTarget, setTagAssignmentTarget] = useState<TagAssignmentTarget>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)
  const [pendingImport, setPendingImport] = useState<PendingImport>(null)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [choosingImport, setChoosingImport] = useState(false)
  const [creatingSnapshot, setCreatingSnapshot] = useState(false)
  const choosingImportRef = useRef(false)
  const creatingSnapshotRef = useRef(false)

  useEffect(() => {
    if (!portfolio.refreshError) return
    toast.error(`资产数据刷新失败，已保留当前页面数据：${portfolio.refreshError}`, {
      id: 'portfolio-refresh-error'
    })
  }, [portfolio.refreshError])

  useEffect(() => {
    if (exchangeRates.status !== 'error' || !exchangeRates.error) return
    const title = exchangeRates.snapshot ? '汇率更新失败' : '汇率加载失败'
    toast.error(`${title}：${exchangeRates.error}`, {
      id: 'exchange-rate-error'
    })
  }, [exchangeRates.error, exchangeRates.snapshot, exchangeRates.status])

  const activeWorkspace = selectedSnapshot?.workspace ?? latestWorkspace
  const readOnly = viewingExampleWorkspace || Boolean(selectedSnapshot)
  const selectedAccount =
    activeWorkspace?.accounts.find((account) => account.id === selectedAccountId) ?? null
  const selectedTag = activeWorkspace?.tags.find((tag) => tag.id === selectedTagId) ?? null
  useEffect(() => {
    if (persistedWorkspace) setViewingExampleWorkspace(false)
  }, [persistedWorkspace?.id])

  useEffect(() => {
    setSelectedSnapshotId(null)
    setSelectedAccountId(null)
    setSelectedTagId(null)
    setTagDialog({ open: false })
  }, [latestWorkspace?.id])

  const { syncStates, syncAccount } = useAccountSync({
    workspace: latestWorkspace,
    readOnly,
    syncPortfolioAccount: portfolio.syncAccount
  })

  async function exportWorkspace(): Promise<void> {
    try {
      if (!window.desktop.backup?.exportData) {
        throw new Error('数据组件尚未加载，请重启 Chromie')
      }
      const result = await window.desktop.backup.exportData()
      setExportDialogOpen(false)
      if (!result.canceled) {
        toast.success('工作区备份已导出')
      }
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
      if (result.canceled) return
      setPendingImport(result.preview)
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
      if (!window.desktop.backup?.confirmImport) {
        throw new Error('数据组件尚未加载，请重启 Chromie')
      }
      setSelectedAccountId(null)
      setSelectedTagId(null)
      await window.desktop.backup.confirmImport(pendingImport.token)
      setPendingImport(null)
      toast.success('工作区已导入')
    } catch (error) {
      reportPortfolioError(error, '导入工作区失败')
    }
  }

  function discardPendingImport(): void {
    if (!pendingImport) return
    void window.desktop.backup?.discardImport(pendingImport.token)
    setPendingImport(null)
  }

  if (portfolio.loading) {
    return <AppLoadingScreen />
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
          onExploreExample={() => setViewingExampleWorkspace(true)}
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
            if (!open) discardPendingImport()
          }}
          workspaceName={pendingImport?.workspaceName ?? ''}
          accountCount={pendingImport?.accountCount ?? 0}
          tagCount={pendingImport?.tagCount ?? 0}
          positionCount={pendingImport?.positionCount ?? 0}
          snapshotCount={pendingImport?.snapshotCount ?? 0}
          integrationCount={pendingImport?.integrationCount ?? 0}
          proxyProfileCount={pendingImport?.proxyProfileCount ?? 0}
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
    if (!latestWorkspace || readOnly || creatingSnapshotRef.current) return
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

  async function submitWorkspaceSettings(input: WorkspaceSettingsInput): Promise<void> {
    if (!activeWorkspace || readOnly) return
    await portfolio.updateWorkspace(activeWorkspace.id, input)
    toast.success('工作区设置已保存')
  }

  async function submitAccount(input: AccountInput): Promise<void> {
    if (!activeWorkspace || readOnly) return
    if (accountDialog.account) {
      await portfolio.updateAccount(activeWorkspace.id, accountDialog.account.id, input)
      toast.success('账户已更新')
      return
    }
    const id = await portfolio.createAccount(activeWorkspace.id, input)
    setSelectedTagId(null)
    setSelectedAccountId(id)
    toast.success('账户已添加')
  }

  async function createTag(input: TagInput): Promise<string> {
    if (!activeWorkspace) throw new Error('没有找到对应的工作区')
    if (readOnly) throw new Error('示例工作区为只读')
    const tagId = await portfolio.createTag(activeWorkspace.id, input)
    toast.success('标签已添加')
    return tagId
  }

  async function updateTag(tagId: string, input: TagInput): Promise<void> {
    if (!activeWorkspace || readOnly) return
    await portfolio.updateTag(activeWorkspace.id, tagId, input)
    toast.success('标签已更新')
  }

  async function submitPositionTags(tagIds: string[]): Promise<string | null> {
    if (!activeWorkspace || !tagAssignmentTarget) return '没有找到对应的持仓'
    if (readOnly) return '示例工作区为只读'
    const result = await portfolio.setPositionTags(
      activeWorkspace.id,
      tagAssignmentTarget.accountId,
      tagAssignmentTarget.position.id,
      tagIds
    )
    if (!result) {
      toast.success('持仓标签已更新')
    }
    return result
  }

  async function submitPosition(input: PositionInput): Promise<string | null> {
    if (!activeWorkspace || !positionDialog.accountId) {
      return '没有找到对应的账户'
    }
    if (readOnly) return '示例工作区为只读'
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
    if (!deleteTarget || readOnly) return
    const successMessage =
      deleteTarget.kind === 'workspace'
        ? '工作区已删除'
        : deleteTarget.kind === 'snapshot'
          ? '快照已删除'
          : deleteTarget.kind === 'account'
            ? '账户已删除'
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
        if (deleteTarget.tag.id === selectedTagId) {
          setSelectedTagId(null)
        }
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
        description: '只会删除这个历史快照，当前工作区数据不会受到影响'
      }
    }
    if (deleteTarget.kind === 'workspace') {
      return {
        title: `删除工作区“${deleteTarget.workspace.name}”？`,
        description: `将同时删除 ${deleteTarget.workspace.tags.length} 个标签、${deleteTarget.workspace.accounts.length} 个账户和全部持仓`
      }
    }
    if (deleteTarget.kind === 'account') {
      return {
        title: `删除“${deleteTarget.account.name}”？`,
        description: deleteTarget.account.positions.length
          ? `该账户中的 ${deleteTarget.account.positions.length} 项持仓也会一并删除`
          : '该账户当前没有持仓'
      }
    }
    if (deleteTarget.kind === 'tag') {
      return {
        title: `删除标签“${deleteTarget.tag.name}”？`,
        description: '将从相关账户和持仓中移除此标签，不会删除资产数据'
      }
    }
    return {
      title: `删除 ${deleteTarget.position.symbol}？`,
      description: `该持仓将从“${deleteTarget.account.name}”中移除`
    }
  })()

  return (
    <div className="flex h-screen min-h-[600px] overflow-hidden bg-sidebar">
      <div className="window-drag fixed inset-x-0 top-0 z-40 h-2" />
      <AppSidebar
        workspace={activeWorkspace}
        readOnly={readOnly}
        viewingExampleWorkspace={viewingExampleWorkspace}
        selectedSnapshotId={selectedSnapshot?.id ?? null}
        selectedAccountId={selectedAccountId}
        selectedTagId={selectedTag?.id ?? null}
        showTimeMachine={showTimeMachine}
        onExitExampleWorkspace={() => setViewingExampleWorkspace(false)}
        onOpenWorkspaceSettings={() => {
          setWorkspaceSettingsSection('basic')
          setWorkspaceSettingsOpen(true)
        }}
        onShowOverview={() => {
          setShowTimeMachine(false)
          setSelectedAccountId(null)
          setSelectedTagId(null)
        }}
        onShowTimeMachine={() => {
          setShowTimeMachine(true)
          setSelectedAccountId(null)
          setSelectedTagId(null)
        }}
        onAddAccount={() => setAccountDialog({ open: true })}
        onSelectAccount={(account) => {
          setShowTimeMachine(false)
          setSelectedTagId(null)
          setSelectedAccountId(account.id)
        }}
        onEditAccount={(account) => setAccountDialog({ open: true, account })}
        onDeleteAccount={(account) => setDeleteTarget({ kind: 'account', account })}
        onAddTag={() => setTagDialog({ open: true })}
        onSelectTag={(tag) => {
          setShowTimeMachine(false)
          setSelectedAccountId(null)
          setSelectedTagId(tag.id)
        }}
        onEditTag={(tag) => setTagDialog({ open: true, tag })}
        onDeleteTag={(tag) => setDeleteTarget({ kind: 'tag', tag })}
        onCreateWorkspace={() => setWorkspaceDialog({ open: true })}
        onSwitchWorkspace={() => setWorkspaceSwitcherOpen(true)}
      />
      <AppContent
        workspace={activeWorkspace}
        latestWorkspace={latestWorkspace}
        activeSnapshots={activeSnapshots}
        selectedSnapshot={selectedSnapshot}
        selectedSnapshotId={selectedSnapshotId}
        selectedAccount={selectedAccount}
        selectedTag={selectedTag}
        viewingExampleWorkspace={viewingExampleWorkspace}
        showTimeMachine={showTimeMachine}
        readOnly={readOnly}
        exchangeRates={exchangeRates}
        liveExchangeRates={currentExchangeRates}
        creatingSnapshot={creatingSnapshot}
        syncState={selectedAccount ? syncStates[selectedAccount.id] : undefined}
        onExitExampleWorkspace={() => setViewingExampleWorkspace(false)}
        onReturnLatest={() => setSelectedSnapshotId(null)}
        onCreateSnapshot={createCurrentSnapshot}
        onViewLatest={() => {
          setSelectedSnapshotId(null)
          setShowTimeMachine(false)
        }}
        onViewSnapshot={(snapshotId) => {
          setSelectedSnapshotId(snapshotId)
          setShowTimeMachine(false)
        }}
        onDeleteSnapshot={(snapshot) => setDeleteTarget({ kind: 'snapshot', snapshot })}
        onOpenAccount={(accountId) => {
          setSelectedTagId(null)
          setSelectedAccountId(accountId)
        }}
        onAddPosition={() => {
          if (selectedAccount) {
            setPositionDialog({ open: true, accountId: selectedAccount.id })
          }
        }}
        onEditAccount={() => {
          if (selectedAccount) {
            setAccountDialog({ open: true, account: selectedAccount })
          }
        }}
        onSyncAccount={async () => {
          if (selectedAccount) await syncAccount(selectedAccount.id)
        }}
        onSyncPortfolioAccount={portfolio.syncAccount}
        onRefreshPositionPrices={portfolio.refreshPositionPrices}
        onManagePositionTags={(position) => {
          if (selectedAccount) {
            setTagAssignmentTarget({ accountId: selectedAccount.id, position })
          }
        }}
        onEditPosition={(position) => {
          if (selectedAccount) {
            setPositionDialog({
              open: true,
              accountId: selectedAccount.id,
              position
            })
          }
        }}
        onDeletePosition={(position) => {
          if (selectedAccount) {
            setDeleteTarget({
              kind: 'position',
              account: selectedAccount,
              position
            })
          }
        }}
      />

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
        proxyProfiles={portfolio.proxyProfiles}
        onCreateProxyProfile={portfolio.createProxyProfile}
        onUpdateProxyProfile={portfolio.updateProxyProfile}
        onDeleteProxyProfile={portfolio.deleteProxyProfile}
        onTestProxy={portfolio.testProxy}
        onRequestExport={() => setExportDialogOpen(true)}
        onRequestDelete={() => setDeleteTarget({ kind: 'workspace', workspace: activeWorkspace })}
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
        proxyProfiles={portfolio.proxyProfiles}
        tags={activeWorkspace.tags}
        onCreateTag={createTag}
        onSubmit={submitAccount}
      />
      <PositionDialog
        open={positionDialog.open}
        onOpenChange={(open) => setPositionDialog((current) => ({ ...current, open }))}
        position={positionDialog.position}
        tags={activeWorkspace.tags}
        stockQuoteProvider={activeWorkspace.stockQuoteProvider}
        cryptoQuoteProvider={activeWorkspace.cryptoQuoteProvider}
        onCreateTag={createTag}
        onSubmit={submitPosition}
      />
      <TagDialog
        open={tagDialog.open}
        onOpenChange={(open) =>
          setTagDialog((current) => (open ? { ...current, open } : { open: false }))
        }
        tag={tagDialog.tag}
        onSubmit={async (input) => {
          if (tagDialog.tag) {
            await updateTag(tagDialog.tag.id, input)
            return
          }
          const tagId = await createTag(input)
          setShowTimeMachine(false)
          setSelectedAccountId(null)
          setSelectedTagId(tagId)
        }}
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
        confirmationPhrase={
          deleteTarget?.kind === 'workspace' ? deleteTarget.workspace.name : undefined
        }
        onConfirm={confirmDelete}
      />
      <ImportBackupDialog
        open={pendingImport !== null}
        onOpenChange={(open) => {
          if (!open) discardPendingImport()
        }}
        workspaceName={pendingImport?.workspaceName ?? ''}
        accountCount={pendingImport?.accountCount ?? 0}
        tagCount={pendingImport?.tagCount ?? 0}
        positionCount={pendingImport?.positionCount ?? 0}
        snapshotCount={pendingImport?.snapshotCount ?? 0}
        integrationCount={pendingImport?.integrationCount ?? 0}
        proxyProfileCount={pendingImport?.proxyProfileCount ?? 0}
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
