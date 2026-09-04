import type { McpAccessSettings, McpToolName, McpToolSuccess } from '../../shared/mcp'
import type {
  AccountIntegration,
  ProxyProfile,
  ProxyTestResult,
  ProxyTestTarget
} from '../../shared/integrations'
import type {
  PortfolioCommand,
  PortfolioCommandResponse,
  PortfolioLoadResponse,
  PortfolioSyncResponse,
  PositionInput
} from '../../shared/portfolio'
import { AccountSyncCoordinator } from './account-sync-coordinator'
import type { DesktopOperations } from './desktop-service'
import { PortfolioMcpController } from './portfolio-mcp-controller'
import type { PortfolioChangeListener, PortfolioOperations } from './portfolio-service'

export { McpOperationError, type McpErrorCode } from './mcp-operation-error'

export interface PortfolioModuleOperations extends PortfolioOperations {
  callMcpTool(
    name: McpToolName,
    rawArguments: unknown,
    access?: McpAccessSettings
  ): Promise<McpToolSuccess>
  syncAccount(workspaceId: string, accountId: string): Promise<PortfolioSyncResponse>
  testProxyProfile(profileId: string, target: ProxyTestTarget): Promise<ProxyTestResult>
}

export class PortfolioModule implements PortfolioModuleOperations {
  private readonly accountSync: AccountSyncCoordinator
  private readonly mcp: PortfolioMcpController

  constructor(
    private readonly portfolio: PortfolioOperations,
    desktop: DesktopOperations
  ) {
    this.accountSync = new AccountSyncCoordinator(portfolio, desktop)
    this.mcp = new PortfolioMcpController(portfolio, desktop, (workspaceId, accountId) =>
      this.accountSync.syncAccount(workspaceId, accountId)
    )
  }

  load(): Promise<PortfolioLoadResponse> {
    return this.portfolio.load()
  }

  execute(command: PortfolioCommand): Promise<PortfolioCommandResponse> {
    return this.portfolio.execute(command)
  }

  replaceSynchronizedPositions(
    workspaceId: string,
    accountId: string,
    expectedIntegration: AccountIntegration,
    positions: PositionInput[],
    syncedAt: string,
    expectedProxyProfile?: ProxyProfile
  ): Promise<void> {
    return this.portfolio.replaceSynchronizedPositions(
      workspaceId,
      accountId,
      expectedIntegration,
      positions,
      syncedAt,
      expectedProxyProfile
    )
  }

  inspectBackup(content: unknown) {
    return this.portfolio.inspectBackup(content)
  }

  exportActiveWorkspace(): Promise<string> {
    return this.portfolio.exportActiveWorkspace()
  }

  importBackup(content: unknown): Promise<string> {
    return this.portfolio.importBackup(content)
  }

  subscribe(listener: PortfolioChangeListener): () => void {
    return this.portfolio.subscribe(listener)
  }

  callMcpTool(
    name: McpToolName,
    rawArguments: unknown,
    access?: McpAccessSettings
  ): Promise<McpToolSuccess> {
    return this.mcp.callMcpTool(name, rawArguments, access)
  }

  syncAccount(workspaceId: string, accountId: string): Promise<PortfolioSyncResponse> {
    return this.accountSync.syncAccount(workspaceId, accountId)
  }

  async testProxyProfile(profileId: string, target: ProxyTestTarget): Promise<ProxyTestResult> {
    const state = await this.portfolio.load()
    const profile = state.proxyProfiles.find((item) => item.id === profileId)
    if (!profile) throw new Error('没有找到对应的代理配置')
    return this.accountSync.testProxy(profile, target)
  }
}
