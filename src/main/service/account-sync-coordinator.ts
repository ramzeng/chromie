import {
  type Account,
  type AppData,
  type PortfolioSyncResponse,
  type PositionInput,
  type Workspace
} from '../../shared/portfolio'
import type { DesktopOperations } from './desktop-service'
import { PortfolioSyncConflictError, type PortfolioOperations } from './portfolio-service'

import { McpOperationError } from './mcp-operation-error'

function requireWorkspace(data: AppData, workspaceId: string): Workspace {
  const workspace = data.workspaces.find((item) => item.id === workspaceId)
  if (!workspace) throw new McpOperationError('NOT_FOUND', '没有找到对应的工作区')
  return workspace
}

function requireAccount(workspace: Workspace, accountId: string): Account {
  const account = workspace.accounts.find((item) => item.id === accountId)
  if (!account) {
    throw new McpOperationError('NOT_FOUND', '没有找到对应的账户')
  }
  return account
}

export class AccountSyncCoordinator {
  private readonly syncingAccounts = new Map<string, Promise<PortfolioSyncResponse>>()

  constructor(
    private readonly portfolio: PortfolioOperations,
    private readonly desktop: DesktopOperations
  ) {}

  syncAccount(workspaceId: string, accountId: string): Promise<PortfolioSyncResponse> {
    const key = `${workspaceId}\u0000${accountId}`
    const existing = this.syncingAccounts.get(key)
    if (existing) return existing

    const pending = this.performAccountSync(workspaceId, accountId).finally(() => {
      if (this.syncingAccounts.get(key) === pending) {
        this.syncingAccounts.delete(key)
      }
    })
    this.syncingAccounts.set(key, pending)
    return pending
  }

  private async performAccountSync(
    workspaceId: string,
    accountId: string
  ): Promise<PortfolioSyncResponse> {
    const state = await this.portfolio.load()
    const workspace = requireWorkspace(state.data, workspaceId)
    const account = requireAccount(workspace, accountId)
    const integration = state.integrations.find((item) => item.accountId === accountId)
    if (!account.sync || !integration) {
      throw new McpOperationError('SYNC_NOT_CONFIGURED', '账户尚未在 Chromie 中配置自动同步')
    }

    try {
      let result: { positions: PositionInput[]; syncedAt: string }
      if (integration.provider === 'Futu' && account.type === 'Futu') {
        result = await this.desktop.syncPositions({
          provider: 'futu',
          options: { ...integration.websocket }
        })
      } else if (integration.provider === 'Ibkr' && account.type === 'Ibkr') {
        result = await this.desktop.syncPositions({
          provider: 'ibkr',
          options: { ...integration.gateway }
        })
      } else if (integration.provider === 'Hstong' && account.type === 'Hstong') {
        result = await this.desktop.syncPositions({
          provider: 'hstong',
          options: { ...integration.gateway }
        })
      } else if (integration.provider === 'Okx' && account.type === 'Okx') {
        result = await this.desktop.syncPositions({
          provider: 'okx',
          options: { ...integration.api }
        })
      } else if (integration.provider === 'Binance' && account.type === 'Binance') {
        result = await this.desktop.syncPositions({
          provider: 'binance',
          options: { ...integration.api }
        })
      } else {
        throw new McpOperationError('SYNC_NOT_CONFIGURED', '同步配置与账户类型不匹配')
      }

      await this.portfolio.replaceSynchronizedPositions(
        workspaceId,
        accountId,
        integration,
        result.positions,
        result.syncedAt
      )
      return {
        positionCount: result.positions.length,
        syncedAt: result.syncedAt
      }
    } catch (error) {
      if (error instanceof McpOperationError) {
        throw error
      }
      if (error instanceof PortfolioSyncConflictError) {
        throw new McpOperationError('SYNC_CONFLICT', error.message, true)
      }
      const message = error instanceof Error ? error.message : String(error)
      throw new McpOperationError('SYNC_FAILED', message, true)
    }
  }
}
