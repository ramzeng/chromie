import { isDeepStrictEqual } from 'node:util'

import {
  EMPTY_INTEGRATION_DATA,
  type AccountIntegration,
  type IntegrationData
} from '../../shared/integrations'
import {
  EMPTY_PORTFOLIO_DATA,
  type AppData,
  type PortfolioCommand,
  type PortfolioCommandResponse,
  type PortfolioLoadResponse,
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
import { parseStoredData, parseStoredIntegrationData } from './portfolio-data'
import { createPortfolioOperations } from './portfolio-operations'

export { createWorkspaceBackup, parseWorkspaceBackup } from './portfolio-backup'
export interface PortfolioOperations {
  load(): Promise<PortfolioLoadResponse>
  execute(command: PortfolioCommand): Promise<PortfolioCommandResponse>
  replaceSynchronizedPositions(
    workspaceId: string,
    accountId: string,
    expectedIntegration: AccountIntegration,
    positions: PositionInput[],
    syncedAt: string
  ): Promise<void>
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
        integrations: structuredClone(this.integrationData.integrations)
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
        ...(result === undefined ? {} : { result })
      }
    })
  }

  replaceSynchronizedPositions(
    workspaceId: string,
    accountId: string,
    expectedIntegration: AccountIntegration,
    positions: PositionInput[],
    syncedAt: string
  ): Promise<void> {
    return this.runExclusive(async () => {
      await this.initialize()
      const workspace = this.data.workspaces.find((item) => item.id === workspaceId)
      const account = workspace?.accounts.find((item) => item.id === accountId)
      const currentIntegration = this.integrationData.integrations.find(
        (item) => item.accountId === accountId
      )
      if (
        !account?.sync ||
        account.type !== expectedIntegration.provider ||
        !currentIntegration ||
        !isDeepStrictEqual(currentIntegration, expectedIntegration)
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
        )
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
        backup.integrations
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
    const reconciled = reconcileIntegrations(
      structuredClone(storedData ?? EMPTY_PORTFOLIO_DATA),
      structuredClone(storedIntegrationData ?? EMPTY_INTEGRATION_DATA)
    )
    if (
      storedState.source === 'legacy' &&
      (storedState.portfolio !== null || storedState.integrations !== null)
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
