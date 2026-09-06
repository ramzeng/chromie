import {
  type Account,
  type AppData,
  type PortfolioSyncResponse,
  type PositionInput,
  type Workspace
} from '../../shared/portfolio'
import type { ProxyProfile, ProxyTestResult, ProxyTestTarget } from '../../shared/integrations'
import type { DesktopOperations } from './desktop-service'
import { PortfolioSyncConflictError, type PortfolioOperations } from './portfolio-service'

import { McpOperationError } from './mcp-operation-error'
import {
  diagnosticErrorMessage,
  type SyncDiagnosticLogger
} from './sync-diagnostics'

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
    private readonly desktop: DesktopOperations,
    private readonly diagnostics?: SyncDiagnosticLogger
  ) {}

  syncAccount(workspaceId: string, accountId: string): Promise<PortfolioSyncResponse> {
    const key = `${workspaceId}\u0000${accountId}`
    const existing = this.syncingAccounts.get(key)
    if (existing) {
      this.diagnostics?.('info', 'account-sync.coalesced', {
        workspaceId,
        accountId
      })
      return existing
    }

    const startedAt = Date.now()
    this.diagnostics?.('info', 'account-sync.started', {
      workspaceId,
      accountId
    })
    const pending = this.performAccountSync(workspaceId, accountId)
      .then((result) => {
        this.diagnostics?.('info', 'account-sync.completed', {
          workspaceId,
          accountId,
          positionCount: result.positionCount,
          syncedAt: result.syncedAt,
          durationMs: Date.now() - startedAt
        })
        return result
      })
      .catch((error: unknown) => {
        this.diagnostics?.('error', 'account-sync.failed', {
          workspaceId,
          accountId,
          error: diagnosticErrorMessage(error),
          durationMs: Date.now() - startedAt
        })
        throw error
      })
      .finally(() => {
        if (this.syncingAccounts.get(key) === pending) {
          this.syncingAccounts.delete(key)
        }
      })
    this.syncingAccounts.set(key, pending)
    return pending
  }

  testProxy(profile: ProxyProfile, target: ProxyTestTarget): Promise<ProxyTestResult> {
    if (!this.desktop.testProxy) throw new Error('代理测试组件尚未加载，请重启 Chromie')
    return this.desktop.testProxy(profile, target)
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
      let networkProxyProfile: ProxyProfile | undefined
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
        const proxyProfileId =
          integration.network.mode === 'proxy'
            ? integration.network.proxyProfileId
            : undefined
        networkProxyProfile =
          proxyProfileId
            ? state.proxyProfiles.find((profile) => profile.id === proxyProfileId)
            : undefined
        result = await this.desktop.syncPositions({
          provider: 'okx',
          options: { ...integration.api },
          network: {
            route: integration.network,
            ...(networkProxyProfile ? { proxyProfile: networkProxyProfile } : {})
          }
        })
      } else if (integration.provider === 'Binance' && account.type === 'Binance') {
        const proxyProfileId =
          integration.network.mode === 'proxy'
            ? integration.network.proxyProfileId
            : undefined
        networkProxyProfile =
          proxyProfileId
            ? state.proxyProfiles.find((profile) => profile.id === proxyProfileId)
            : undefined
        result = await this.desktop.syncPositions({
          provider: 'binance',
          options: { ...integration.api },
          network: {
            route: integration.network,
            ...(networkProxyProfile ? { proxyProfile: networkProxyProfile } : {})
          }
        })
      } else {
        throw new McpOperationError('SYNC_NOT_CONFIGURED', '同步配置与账户类型不匹配')
      }

      await this.portfolio.replaceSynchronizedPositions(
        workspaceId,
        accountId,
        integration,
        result.positions,
        result.syncedAt,
        networkProxyProfile
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
