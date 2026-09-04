import { isDeepStrictEqual } from 'node:util'

import {
  resolveAssetQuoteProvider,
  type AssetQuoteProvider
} from '../../shared/asset-quotes'
import {
  EMPTY_INTEGRATION_DATA,
  type AccountIntegration,
  type IntegrationData,
  type ProxyProfile
} from '../../shared/integrations'
import {
  EMPTY_PORTFOLIO_DATA,
  type AppData,
  type PortfolioCommand,
  type PortfolioCommandResponse,
  type PortfolioLoadResponse,
  type Position,
  type PositionInput,
  type WorkspaceBackup
} from '../../shared/portfolio'
import { portfolioCommandSchema } from '../../shared/portfolio-command'
import type { IntegrationRepository } from '../repository/integration-repository'
import type { PortfolioRepository } from '../repository/portfolio-repository'
import {
  LegacyPortfolioStateRepository,
  type PortfolioStateRepository
} from '../repository/portfolio-state-repository'

import {
  createWorkspaceBackup,
  parseWorkspaceBackup,
  reconcileIntegrations
} from './portfolio-backup'
import {
  isCurrencyCode,
  parseStoredData,
  parseStoredIntegrationData
} from './portfolio-data'
import { createPortfolioOperations } from './portfolio-operations'

export { createWorkspaceBackup, parseWorkspaceBackup } from './portfolio-backup'
export type PositionPriceUpdate = {
  accountId: string
  positionId: string
  provider: AssetQuoteProvider
  expected: Pick<Position, 'market' | 'symbol' | 'currency' | 'price'>
  price: number
  currency: string
}

export type PositionPriceUpdateResult = {
  appliedCount: number
  conflictCount: number
}

export interface PortfolioOperations {
  load(): Promise<PortfolioLoadResponse>
  execute(command: PortfolioCommand): Promise<PortfolioCommandResponse>
  replaceSynchronizedPositions(
    workspaceId: string,
    accountId: string,
    expectedIntegration: AccountIntegration,
    positions: PositionInput[],
    syncedAt: string,
    expectedProxyProfile?: ProxyProfile
  ): Promise<void>
  applyManualPositionPriceUpdates(
    workspaceId: string,
    updates: PositionPriceUpdate[]
  ): Promise<PositionPriceUpdateResult>
  inspectBackup(content: unknown): WorkspaceBackup | null
  exportActiveWorkspace(): Promise<string>
  importBackup(content: unknown): Promise<string>
  subscribe(listener: PortfolioChangeListener): () => void
}

export type PortfolioChangeListener = () => void

export class PortfolioSyncConflictError extends Error {
  constructor(message = '同步期间账户配置已发生变化，请重新同步') {
    super(message)
    this.name = 'PortfolioSyncConflictError'
  }
}

export class PortfolioService implements PortfolioOperations {
  private data: AppData = structuredClone(EMPTY_PORTFOLIO_DATA)
  private integrationData: IntegrationData = structuredClone(EMPTY_INTEGRATION_DATA)
  private initialized = false
  private pending: Promise<void> = Promise.resolve()
  private readonly listeners = new Set<PortfolioChangeListener>()
  private readonly repository: PortfolioStateRepository

  constructor(repository: PortfolioStateRepository)
  constructor(repository: PortfolioRepository, integrationRepository: IntegrationRepository)
  constructor(
    repository: PortfolioStateRepository | PortfolioRepository,
    integrationRepository?: IntegrationRepository
  ) {
    this.repository = integrationRepository
      ? new LegacyPortfolioStateRepository(repository as PortfolioRepository, integrationRepository)
      : (repository as PortfolioStateRepository)
  }

  load(): Promise<PortfolioLoadResponse> {
    return this.runExclusive(async () => {
      await this.initialize()
      return {
        data: structuredClone(this.data),
        integrations: structuredClone(this.integrationData.integrations),
        proxyProfiles: structuredClone(this.integrationData.proxyProfiles)
      }
    })
  }

  execute(command: PortfolioCommand): Promise<PortfolioCommandResponse> {
    return this.runExclusive(async () => {
      await this.initialize()
      command = portfolioCommandSchema.parse(command) as PortfolioCommand
      let nextData = this.data
      let nextIntegrationData = this.integrationData
      const operations = createPortfolioOperations(
        this.data,
        (update) => {
          nextData = typeof update === 'function' ? update(nextData) : update
        },
        this.integrationData,
        (update) => {
          nextIntegrationData = typeof update === 'function' ? update(nextIntegrationData) : update
        }
      )
      let result: string | undefined

      switch (command.type) {
        case 'set-active-workspace':
          operations.setActiveWorkspace(command.id)
          break
        case 'create-snapshot':
          result = operations.createSnapshot(command.workspaceId, command.exchangeRates)
          break
        case 'delete-snapshot':
          operations.deleteSnapshot(command.snapshotId)
          break
        case 'create-workspace':
          result = operations.createWorkspace(command.input)
          break
        case 'update-workspace':
          operations.updateWorkspace(command.id, command.input)
          break
        case 'delete-workspace':
          operations.deleteWorkspace(command.id)
          break
        case 'create-tag':
          result = operations.createTag(command.workspaceId, command.input)
          break
        case 'update-tag':
          operations.updateTag(command.workspaceId, command.tagId, command.input)
          break
        case 'delete-tag':
          operations.deleteTag(command.workspaceId, command.tagId)
          break
        case 'set-account-tags':
          operations.setAccountTags(command.workspaceId, command.accountId, command.tagIds)
          break
        case 'set-position-tags':
          operations.setPositionTags(
            command.workspaceId,
            command.accountId,
            command.positionId,
            command.tagIds
          )
          break
        case 'create-account':
          result = operations.createAccount(command.workspaceId, command.input)
          break
        case 'update-account':
          operations.updateAccount(command.workspaceId, command.accountId, command.input)
          break
        case 'delete-account':
          operations.deleteAccount(command.workspaceId, command.accountId)
          break
        case 'create-proxy-profile':
          result = operations.createProxyProfile(command.input)
          break
        case 'update-proxy-profile':
          operations.updateProxyProfile(command.id, command.input)
          break
        case 'delete-proxy-profile':
          operations.deleteProxyProfile(command.id)
          break
        case 'save-position':
          operations.savePosition(
            command.workspaceId,
            command.accountId,
            command.input,
            command.positionId
          )
          break
        case 'delete-position':
          operations.deletePosition(command.workspaceId, command.accountId, command.positionId)
          break
        default:
          throw new Error('不支持的资产命令')
      }

      await this.persist(nextData, nextIntegrationData)
      this.data = nextData
      this.integrationData = nextIntegrationData
      this.notifyListeners()
      return {
        data: structuredClone(this.data),
        integrations: structuredClone(this.integrationData.integrations),
        proxyProfiles: structuredClone(this.integrationData.proxyProfiles),
        ...(result === undefined ? {} : { result })
      }
    })
  }

  replaceSynchronizedPositions(
    workspaceId: string,
    accountId: string,
    expectedIntegration: AccountIntegration,
    positions: PositionInput[],
    syncedAt: string,
    expectedProxyProfile?: ProxyProfile
  ): Promise<void> {
    return this.runExclusive(async () => {
      await this.initialize()
      const workspace = this.data.workspaces.find((item) => item.id === workspaceId)
      const account = workspace?.accounts.find((item) => item.id === accountId)
      const currentIntegration = this.integrationData.integrations.find(
        (item) => item.accountId === accountId
      )
      const expectedProxyProfileId =
        (expectedIntegration.provider === 'Okx' || expectedIntegration.provider === 'Binance') &&
        expectedIntegration.network.mode === 'proxy'
          ? expectedIntegration.network.proxyProfileId
          : undefined
      const currentProxyProfile = expectedProxyProfileId
        ? this.integrationData.proxyProfiles.find((profile) => profile.id === expectedProxyProfileId)
        : undefined
      if (
        !account?.sync ||
        account.type !== expectedIntegration.provider ||
        !currentIntegration ||
        !isDeepStrictEqual(currentIntegration, expectedIntegration) ||
        (expectedProxyProfileId !== undefined &&
          (!expectedProxyProfile || !isDeepStrictEqual(currentProxyProfile, expectedProxyProfile)))
      ) {
        throw new PortfolioSyncConflictError()
      }
      if (!Number.isFinite(Date.parse(syncedAt))) {
        throw new Error('同步服务返回了无效的完成时间')
      }

      let nextData = this.data
      const operations = createPortfolioOperations(
        this.data,
        (update) => {
          nextData = typeof update === 'function' ? update(nextData) : update
        },
        this.integrationData,
        () => undefined
      )
      operations.replacePositions(workspaceId, accountId, positions, syncedAt)
      await this.persist(nextData, this.integrationData)
      this.data = nextData
      this.notifyListeners()
    })
  }

  applyManualPositionPriceUpdates(
    workspaceId: string,
    updates: PositionPriceUpdate[]
  ): Promise<PositionPriceUpdateResult> {
    return this.runExclusive(async () => {
      await this.initialize()

      const normalizedUpdates = new Map<
        string,
        PositionPriceUpdate & { currency: string }
      >()
      updates.forEach((update) => {
        if (!Number.isFinite(update.price) || update.price < 0) {
          throw new Error('行情服务返回了无效的价格')
        }
        if (!isCurrencyCode(update.currency)) {
          throw new Error('行情服务返回了无效的币种')
        }
        const key = `${update.accountId}\u0000${update.positionId}`
        if (normalizedUpdates.has(key)) {
          throw new Error('持仓价格更新包含重复项目')
        }
        normalizedUpdates.set(key, {
          ...update,
          currency: update.currency.trim().toUpperCase()
        })
      })

      const workspace = this.data.workspaces.find((item) => item.id === workspaceId)
      if (!workspace) {
        return { appliedCount: 0, conflictCount: normalizedUpdates.size }
      }

      const acceptedUpdates = new Map<string, { price: number; currency: string }>()
      let conflictCount = 0
      normalizedUpdates.forEach((update, key) => {
        const account = workspace.accounts.find((item) => item.id === update.accountId)
        const position = account?.positions.find((item) => item.id === update.positionId)
        const currentProvider = position
          ? resolveAssetQuoteProvider(
              position.market,
              workspace.stockQuoteProvider,
              workspace.cryptoQuoteProvider
            )
          : undefined
        if (
          !account ||
          account.sync ||
          !position ||
          position.market !== update.expected.market ||
          position.symbol !== update.expected.symbol.trim().toUpperCase() ||
          position.currency !== update.expected.currency.trim().toUpperCase() ||
          position.price !== update.expected.price ||
          currentProvider !== update.provider
        ) {
          conflictCount += 1
          return
        }
        acceptedUpdates.set(key, {
          price: update.price,
          currency: update.currency
        })
      })

      let changed = false
      const nextData: AppData = {
        ...this.data,
        workspaces: this.data.workspaces.map((currentWorkspace) =>
          currentWorkspace.id === workspaceId
            ? {
                ...currentWorkspace,
                accounts: currentWorkspace.accounts.map((account) => ({
                  ...account,
                  positions: account.positions.map((position) => {
                    const update = acceptedUpdates.get(
                      `${account.id}\u0000${position.id}`
                    )
                    if (!update) return position
                    if (
                      position.price === update.price &&
                      position.currency === update.currency
                    ) {
                      return position
                    }
                    changed = true
                    return {
                      ...position,
                      price: update.price,
                      currency: update.currency
                    }
                  })
                }))
              }
            : currentWorkspace
        )
      }

      if (changed) {
        await this.persist(nextData, this.integrationData)
        this.data = nextData
        this.notifyListeners()
      }

      return {
        appliedCount: acceptedUpdates.size,
        conflictCount
      }
    })
  }

  inspectBackup(content: unknown): WorkspaceBackup | null {
    return typeof content === 'string' ? parseWorkspaceBackup(content) : null
  }

  async exportActiveWorkspace(): Promise<string> {
    return this.runExclusive(async () => {
      await this.initialize()
      const workspace = this.data.workspaces.find((item) => item.id === this.data.activeWorkspaceId)
      if (!workspace) throw new Error('没有可导出的工作区')
      const accountIds = new Set(workspace.accounts.map((account) => account.id))
      return createWorkspaceBackup(
        workspace,
        this.data.snapshots.filter((snapshot) => snapshot.workspaceId === workspace.id),
        this.integrationData.integrations.filter((integration) =>
          accountIds.has(integration.accountId)
        ),
        this.integrationData.proxyProfiles
      )
    })
  }

  importBackup(content: unknown): Promise<string> {
    return this.runExclusive(async () => {
      await this.initialize()
      if (typeof content !== 'string') throw new Error('备份文件无效或版本不受支持')
      const backup = parseWorkspaceBackup(content)
      if (!backup) throw new Error('备份文件无效或版本不受支持')

      let nextData = this.data
      let nextIntegrationData = this.integrationData
      const operations = createPortfolioOperations(
        this.data,
        (update) => {
          nextData = typeof update === 'function' ? update(nextData) : update
        },
        this.integrationData,
        (update) => {
          nextIntegrationData = typeof update === 'function' ? update(nextIntegrationData) : update
        }
      )
      const workspaceId = operations.importWorkspace(
        backup.workspace,
        backup.snapshots,
        backup.integrations,
        backup.proxyProfiles
      )
      await this.persist(nextData, nextIntegrationData)
      this.data = nextData
      this.integrationData = nextIntegrationData
      this.notifyListeners()
      return workspaceId
    })
  }

  subscribe(listener: PortfolioChangeListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return
    const storedState = await this.repository.load()
    const storedData =
      storedState.portfolio === null ? null : parseStoredData(storedState.portfolio)
    if (storedState.portfolio !== null && !storedData) {
      throw new Error('资产数据文件损坏或版本不受支持，原文件已保留')
    }
    const storedIntegrationData =
      storedState.integrations === null
        ? null
        : parseStoredIntegrationData(storedState.integrations)
    if (storedState.integrations !== null && !storedIntegrationData) {
      throw new Error('账户集成数据文件损坏或版本不受支持，原文件已保留')
    }
    const storedPortfolioValue =
      storedState.portfolio === null
        ? null
        : (JSON.parse(storedState.portfolio) as unknown)
    const storedIntegrationValue =
      storedState.integrations === null
        ? null
        : (JSON.parse(storedState.integrations) as unknown)
    const reconciled = reconcileIntegrations(
      structuredClone(storedData ?? EMPTY_PORTFOLIO_DATA),
      structuredClone(storedIntegrationData ?? EMPTY_INTEGRATION_DATA)
    )
    const needsMigration =
      (storedPortfolioValue !== null &&
        !isDeepStrictEqual(storedPortfolioValue, reconciled.data)) ||
      (storedIntegrationValue !== null &&
        !isDeepStrictEqual(storedIntegrationValue, reconciled.integrationData))
    if (
      (storedState.source === 'legacy' &&
        (storedState.portfolio !== null || storedState.integrations !== null)) ||
      needsMigration
    ) {
      await this.persist(reconciled.data, reconciled.integrationData)
    }
    this.data = reconciled.data
    this.integrationData = reconciled.integrationData
    this.initialized = true
  }

  private async persist(data: AppData, integrationData: IntegrationData): Promise<void> {
    await this.repository.save(JSON.stringify(data), JSON.stringify(integrationData))
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener()
      } catch {
        // A transport listener must not break a committed portfolio update.
      }
    })
  }

  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pending.then(operation, operation)
    this.pending = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }
}
