import { useEffect, useState } from 'react'

import type { ExchangeRateSnapshot } from '../../../shared/exchange-rates'
import type { AssetAccountIntegrationView } from '../../../shared/integrations'
import {
  EMPTY_PORTFOLIO_DATA,
  type WorkspaceBackup,
  type AccountGroupInput,
  type AppData,
  type AssetAccountInput,
  type PortfolioCommand,
  type WorkspaceSnapshot,
  type PositionGroupInput,
  type PositionInput,
  type Workspace,
  type WorkspaceInput,
  type WorkspaceSettingsInput
} from '../../../shared/portfolio'

function cleanIpcError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error)
  return rawMessage.replace(/^Error invoking remote method '[^']+': Error: /, '')
}

export function usePortfolio() {
  const [data, setData] = useState<AppData>(() => structuredClone(EMPTY_PORTFOLIO_DATA))
  const [integrations, setIntegrations] = useState<AssetAccountIntegrationView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshError, setRefreshError] = useState('')

  useEffect(() => {
    let active = true

    async function load(): Promise<void> {
      try {
        if (!window.desktop.portfolio) {
          throw new Error('资产数据组件尚未加载，请重启 Chromie')
        }
        const response = await window.desktop.portfolio.load()
        if (!active) return
        setData(response.data)
        setIntegrations(response.integrations)
      } catch (loadError) {
        if (active) setError(cleanIpcError(loadError))
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const portfolio = window.desktop.portfolio
    if (!portfolio?.onChanged) return
    let active = true
    const unsubscribe = portfolio.onChanged(() => {
      void portfolio.load().then((response) => {
        if (!active) return
        setData(response.data)
        setIntegrations(response.integrations)
        setError('')
        setRefreshError('')
      }).catch((loadError) => {
        if (active) setRefreshError(cleanIpcError(loadError))
      })
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  async function execute(command: PortfolioCommand): Promise<string | null | undefined> {
    if (!window.desktop.portfolio) {
      throw new Error('资产数据组件尚未加载，请重启 Chromie')
    }
    const response = await window.desktop.portfolio.execute(command)
    setData(response.data)
    setIntegrations(response.integrations)
    setError('')
    setRefreshError('')
    return response.result
  }

  const activeWorkspace =
    data.workspaces.find((workspace) => workspace.id === data.activeWorkspaceId) ?? null
  const activeSnapshots = activeWorkspace
    ? data.snapshots.filter(
        (snapshot) => snapshot.workspaceId === activeWorkspace.id
      )
    : []

  return {
    loading,
    error,
    refreshError,
    workspaces: data.workspaces,
    activeWorkspace,
    activeSnapshots,
    getAssetAccountIntegration: (assetAccountId: string) =>
      integrations.find(
        (integration) => integration.assetAccountId === assetAccountId
      ),
    setActiveWorkspace: (id: string) =>
      execute({ type: 'set-active-workspace', id }).then(() => undefined),
    createSnapshot: (
      workspaceId: string,
      exchangeRates?: ExchangeRateSnapshot | null
    ) =>
      execute({ type: 'create-snapshot', workspaceId, exchangeRates }).then(
        (result) => result ?? null
      ),
    deleteSnapshot: (snapshotId: string) =>
      execute({ type: 'delete-snapshot', snapshotId }).then(() => undefined),
    createWorkspace: (input: WorkspaceInput) =>
      execute({ type: 'create-workspace', input }).then((result) => {
        if (typeof result !== 'string') throw new Error('创建工作区失败')
        return result
      }),
    updateWorkspace: (id: string, input: WorkspaceSettingsInput) =>
      execute({ type: 'update-workspace', id, input }).then(() => undefined),
    deleteWorkspace: (id: string) =>
      execute({ type: 'delete-workspace', id }).then(() => undefined),
    createAccountGroup: (workspaceId: string, input: AccountGroupInput) =>
      execute({ type: 'create-account-group', workspaceId, input }).then(
        (result) => {
          if (typeof result !== 'string') throw new Error('创建账户分组失败')
          return result
        }
      ),
    updateAccountGroup: (
      workspaceId: string,
      groupId: string,
      input: AccountGroupInput
    ) =>
      execute({ type: 'update-account-group', workspaceId, groupId, input }).then(
        () => undefined
      ),
    deleteAccountGroup: (workspaceId: string, groupId: string) =>
      execute({ type: 'delete-account-group', workspaceId, groupId }).then(
        () => undefined
      ),
    setAccountGroupAccounts: (
      workspaceId: string,
      groupId: string,
      assetAccountIds: string[]
    ) =>
      execute({
        type: 'set-account-group-accounts',
        workspaceId,
        groupId,
        assetAccountIds
      }).then((result) => result ?? null),
    removeAccountFromGroup: (
      workspaceId: string,
      groupId: string,
      assetAccountId: string
    ) =>
      execute({
        type: 'remove-account-from-group',
        workspaceId,
        groupId,
        assetAccountId
      }).then(() => undefined),
    createPositionGroup: (workspaceId: string, input: PositionGroupInput) =>
      execute({ type: 'create-position-group', workspaceId, input }).then(
        (result) => {
          if (typeof result !== 'string') throw new Error('创建持仓分组失败')
          return result
        }
      ),
    updatePositionGroup: (
      workspaceId: string,
      groupId: string,
      input: PositionGroupInput
    ) =>
      execute({ type: 'update-position-group', workspaceId, groupId, input }).then(
        () => undefined
      ),
    deletePositionGroup: (workspaceId: string, groupId: string) =>
      execute({ type: 'delete-position-group', workspaceId, groupId }).then(
        () => undefined
      ),
    setPositionGroupPositions: (
      workspaceId: string,
      groupId: string,
      positionIds: string[]
    ) =>
      execute({
        type: 'set-position-group-positions',
        workspaceId,
        groupId,
        positionIds
      }).then((result) => result ?? null),
    removePositionFromGroup: (
      workspaceId: string,
      groupId: string,
      positionId: string
    ) =>
      execute({
        type: 'remove-position-from-group',
        workspaceId,
        groupId,
        positionId
      }).then(() => undefined),
    createAssetAccount: (workspaceId: string, input: AssetAccountInput) =>
      execute({ type: 'create-asset-account', workspaceId, input }).then(
        (result) => {
          if (typeof result !== 'string') throw new Error('创建资产账户失败')
          return result
        }
      ),
    updateAssetAccount: (
      workspaceId: string,
      assetAccountId: string,
      input: AssetAccountInput
    ) =>
      execute({
        type: 'update-asset-account',
        workspaceId,
        assetAccountId,
        input
      }).then(() => undefined),
    deleteAssetAccount: (workspaceId: string, assetAccountId: string) =>
      execute({ type: 'delete-asset-account', workspaceId, assetAccountId }).then(
        () => undefined
      ),
    savePosition: (
      workspaceId: string,
      assetAccountId: string,
      input: PositionInput,
      positionId?: string
    ) =>
      execute({
        type: 'save-position',
        workspaceId,
        assetAccountId,
        input,
        positionId
      }).then((result) => result ?? null),
    deletePosition: (
      workspaceId: string,
      assetAccountId: string,
      positionId: string
    ) =>
      execute({
        type: 'delete-position',
        workspaceId,
        assetAccountId,
        positionId
      }).then(() => undefined),
    replacePositions: (
      workspaceId: string,
      assetAccountId: string,
      positions: PositionInput[],
      lastSyncedAt?: string
    ) =>
      execute({
        type: 'replace-positions',
        workspaceId,
        assetAccountId,
        positions,
        lastSyncedAt
      }).then(() => undefined),
    syncAssetAccount: async (
      workspaceId: string,
      assetAccountId: string
    ) => {
      if (!window.desktop.portfolio?.syncAssetAccount) {
        throw new Error('资产同步组件尚未加载，请重启 Chromie')
      }
      return window.desktop.portfolio.syncAssetAccount(
        workspaceId,
        assetAccountId
      )
    },
    importWorkspace: (workspace: Workspace, snapshots: WorkspaceSnapshot[] = []) =>
      execute({ type: 'import-workspace', workspace, snapshots }).then((result) => {
        if (typeof result !== 'string') throw new Error('导入工作区失败')
        return result
      }),
    inspectBackup: async (content: string): Promise<WorkspaceBackup | null> => {
      if (!window.desktop.portfolio) {
        throw new Error('资产数据组件尚未加载，请重启 Chromie')
      }
      return window.desktop.portfolio.inspectBackup(content)
    },
    exportWorkspace: async (): Promise<string> => {
      if (!window.desktop.portfolio) {
        throw new Error('资产数据组件尚未加载，请重启 Chromie')
      }
      return window.desktop.portfolio.exportActiveWorkspace()
    }
  }
}
