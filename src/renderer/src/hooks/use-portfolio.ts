import { useEffect, useState } from 'react'

import type { ExchangeRateSnapshot } from '../../../shared/exchange-rates'
import type { AccountIntegrationView } from '../../../shared/integrations'
import {
  EMPTY_PORTFOLIO_DATA,
  type WorkspaceBackup,
  type AppData,
  type AccountInput,
  type PortfolioCommand,
  type WorkspaceSnapshot,
  type PositionInput,
  type TagInput,
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
  const [integrations, setIntegrations] = useState<AccountIntegrationView[]>([])
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
    getAccountIntegration: (accountId: string) =>
      integrations.find(
        (integration) => integration.accountId === accountId
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
    createTag: (workspaceId: string, input: TagInput) =>
      execute({ type: 'create-tag', workspaceId, input }).then(
        (result) => {
          if (typeof result !== 'string') throw new Error('添加标签失败')
          return result
        }
      ),
    updateTag: (
      workspaceId: string,
      tagId: string,
      input: TagInput
    ) =>
      execute({ type: 'update-tag', workspaceId, tagId, input }).then(
        () => undefined
      ),
    deleteTag: (workspaceId: string, tagId: string) =>
      execute({ type: 'delete-tag', workspaceId, tagId }).then(
        () => undefined
      ),
    setAccountTags: (
      workspaceId: string,
      accountId: string,
      tagIds: string[]
    ) =>
      execute({
        type: 'set-account-tags',
        workspaceId,
        accountId,
        tagIds
      }).then((result) => result ?? null),
    setPositionTags: (
      workspaceId: string,
      accountId: string,
      positionId: string,
      tagIds: string[]
    ) =>
      execute({
        type: 'set-position-tags',
        workspaceId,
        accountId,
        positionId,
        tagIds
      }).then((result) => result ?? null),
    createAccount: (workspaceId: string, input: AccountInput) =>
      execute({ type: 'create-account', workspaceId, input }).then(
        (result) => {
          if (typeof result !== 'string') throw new Error('创建资产账户失败')
          return result
        }
      ),
    updateAccount: (
      workspaceId: string,
      accountId: string,
      input: AccountInput
    ) =>
      execute({
        type: 'update-account',
        workspaceId,
        accountId,
        input
      }).then(() => undefined),
    deleteAccount: (workspaceId: string, accountId: string) =>
      execute({ type: 'delete-account', workspaceId, accountId }).then(
        () => undefined
      ),
    savePosition: (
      workspaceId: string,
      accountId: string,
      input: PositionInput,
      positionId?: string
    ) =>
      execute({
        type: 'save-position',
        workspaceId,
        accountId,
        input,
        positionId
      }).then((result) => result ?? null),
    deletePosition: (
      workspaceId: string,
      accountId: string,
      positionId: string
    ) =>
      execute({
        type: 'delete-position',
        workspaceId,
        accountId,
        positionId
      }).then(() => undefined),
    replacePositions: (
      workspaceId: string,
      accountId: string,
      positions: PositionInput[],
      lastSyncedAt?: string
    ) =>
      execute({
        type: 'replace-positions',
        workspaceId,
        accountId,
        positions,
        lastSyncedAt
      }).then(() => undefined),
    syncAccount: async (
      workspaceId: string,
      accountId: string
    ) => {
      if (!window.desktop.portfolio?.syncAccount) {
        throw new Error('资产同步组件尚未加载，请重启 Chromie')
      }
      return window.desktop.portfolio.syncAccount(
        workspaceId,
        accountId
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
