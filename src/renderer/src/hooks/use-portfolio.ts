import { useEffect, useState } from 'react'

import type { ExchangeRateSnapshot } from '../../../shared/exchange-rates'
import type { AssetAccountIntegration } from '../../../shared/integrations'
import {
  EMPTY_PORTFOLIO_DATA,
  type AccountBackup,
  type AppData,
  type AssetAccountInput,
  type PortfolioCommand,
  type PortfolioSnapshot,
  type PositionGroupInput,
  type PositionInput,
  type ProductAccount,
  type ProductAccountInput,
  type ProductAccountSettingsInput
} from '../../../shared/portfolio'

function cleanIpcError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error)
  return rawMessage.replace(/^Error invoking remote method '[^']+': Error: /, '')
}

export function usePortfolio() {
  const [data, setData] = useState<AppData>(() => structuredClone(EMPTY_PORTFOLIO_DATA))
  const [integrations, setIntegrations] = useState<AssetAccountIntegration[]>([])
  const [revision, setRevision] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function load(): Promise<void> {
      try {
        if (!window.desktop.portfolio) {
          throw new Error('资产数据组件尚未加载，请重启 Chromie')
        }
        const response = await window.desktop.portfolio.load()
        if (!active) return
        setRevision(response.revision)
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
        setRevision(response.revision)
        setData(response.data)
        setIntegrations(response.integrations)
        setError('')
      }).catch((loadError) => {
        if (active) setError(cleanIpcError(loadError))
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
    setRevision(response.revision)
    setData(response.data)
    setIntegrations(response.integrations)
    setError('')
    return response.result
  }

  const activeProductAccount =
    data.productAccounts.find((account) => account.id === data.activeProductAccountId) ?? null
  const activeSnapshots = activeProductAccount
    ? data.snapshots.filter(
        (snapshot) => snapshot.productAccountId === activeProductAccount.id
      )
    : []

  return {
    loading,
    error,
    revision,
    productAccounts: data.productAccounts,
    activeProductAccount,
    activeSnapshots,
    getAssetAccountIntegration: (assetAccountId: string) =>
      integrations.find(
        (integration) => integration.assetAccountId === assetAccountId
      ),
    setActiveProductAccount: (id: string) =>
      execute({ type: 'set-active-product-account', id }).then(() => undefined),
    createSnapshot: (
      productAccountId: string,
      exchangeRates?: ExchangeRateSnapshot | null
    ) =>
      execute({ type: 'create-snapshot', productAccountId, exchangeRates }).then(
        (result) => result ?? null
      ),
    deleteSnapshot: (snapshotId: string) =>
      execute({ type: 'delete-snapshot', snapshotId }).then(() => undefined),
    createProductAccount: (input: ProductAccountInput) =>
      execute({ type: 'create-product-account', input }).then((result) => {
        if (typeof result !== 'string') throw new Error('创建账户失败')
        return result
      }),
    updateProductAccount: (id: string, input: ProductAccountSettingsInput) =>
      execute({ type: 'update-product-account', id, input }).then(() => undefined),
    deleteProductAccount: (id: string) =>
      execute({ type: 'delete-product-account', id }).then(() => undefined),
    createPositionGroup: (productAccountId: string, input: PositionGroupInput) =>
      execute({ type: 'create-position-group', productAccountId, input }).then(
        (result) => {
          if (typeof result !== 'string') throw new Error('创建持仓分组失败')
          return result
        }
      ),
    updatePositionGroup: (
      productAccountId: string,
      groupId: string,
      input: PositionGroupInput
    ) =>
      execute({ type: 'update-position-group', productAccountId, groupId, input }).then(
        () => undefined
      ),
    deletePositionGroup: (productAccountId: string, groupId: string) =>
      execute({ type: 'delete-position-group', productAccountId, groupId }).then(
        () => undefined
      ),
    setPositionGroupPositions: (
      productAccountId: string,
      groupId: string,
      positionIds: string[]
    ) =>
      execute({
        type: 'set-position-group-positions',
        productAccountId,
        groupId,
        positionIds
      }).then((result) => result ?? null),
    removePositionFromGroup: (
      productAccountId: string,
      groupId: string,
      positionId: string
    ) =>
      execute({
        type: 'remove-position-from-group',
        productAccountId,
        groupId,
        positionId
      }).then(() => undefined),
    createAssetAccount: (productAccountId: string, input: AssetAccountInput) =>
      execute({ type: 'create-asset-account', productAccountId, input }).then(
        (result) => {
          if (typeof result !== 'string') throw new Error('创建资产账户失败')
          return result
        }
      ),
    updateAssetAccount: (
      productAccountId: string,
      assetAccountId: string,
      input: AssetAccountInput
    ) =>
      execute({
        type: 'update-asset-account',
        productAccountId,
        assetAccountId,
        input
      }).then(() => undefined),
    deleteAssetAccount: (productAccountId: string, assetAccountId: string) =>
      execute({ type: 'delete-asset-account', productAccountId, assetAccountId }).then(
        () => undefined
      ),
    savePosition: (
      productAccountId: string,
      assetAccountId: string,
      input: PositionInput,
      positionId?: string
    ) =>
      execute({
        type: 'save-position',
        productAccountId,
        assetAccountId,
        input,
        positionId
      }).then((result) => result ?? null),
    deletePosition: (
      productAccountId: string,
      assetAccountId: string,
      positionId: string
    ) =>
      execute({
        type: 'delete-position',
        productAccountId,
        assetAccountId,
        positionId
      }).then(() => undefined),
    replacePositions: (
      productAccountId: string,
      assetAccountId: string,
      positions: PositionInput[],
      lastSyncedAt?: string
    ) =>
      execute({
        type: 'replace-positions',
        productAccountId,
        assetAccountId,
        positions,
        lastSyncedAt
      }).then(() => undefined),
    syncAssetAccount: async (
      productAccountId: string,
      assetAccountId: string
    ) => {
      if (!window.desktop.portfolio?.syncAssetAccount) {
        throw new Error('资产同步组件尚未加载，请重启 Chromie')
      }
      return window.desktop.portfolio.syncAssetAccount(
        productAccountId,
        assetAccountId
      )
    },
    importAccount: (account: ProductAccount, snapshots: PortfolioSnapshot[] = []) =>
      execute({ type: 'import-account', account, snapshots }).then((result) => {
        if (typeof result !== 'string') throw new Error('导入账户失败')
        return result
      }),
    inspectBackup: async (content: string): Promise<AccountBackup | null> => {
      if (!window.desktop.portfolio) {
        throw new Error('资产数据组件尚未加载，请重启 Chromie')
      }
      return window.desktop.portfolio.inspectBackup(content)
    },
    exportAccount: async (): Promise<string> => {
      if (!window.desktop.portfolio) {
        throw new Error('资产数据组件尚未加载，请重启 Chromie')
      }
      return window.desktop.portfolio.exportActiveAccount()
    }
  }
}
