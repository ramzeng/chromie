import {
  DEFAULT_MCP_ACCESS_SETTINGS,
  createAccountInputSchema,
  createPositionInputSchema,
  createSnapshotInputSchema,
  createTagInputSchema,
  createWorkspaceInputSchema,
  getPortfolioOverviewInputSchema,
  getWorkspaceInputSchema,
  listPositionsInputSchema,
  listSnapshotsInputSchema,
  listWorkspacesInputSchema,
  mcpToolInputSchemas,
  refreshExchangeRatesInputSchema,
  setAccountTagsInputSchema,
  setPositionTagsInputSchema,
  syncAccountInputSchema,
  updateAccountInputSchema,
  updatePositionInputSchema,
  updateTagInputSchema,
  updateWorkspaceInputSchema,
  type McpAccessSettings,
  type McpToolName,
  type McpToolSuccess
} from '../../shared/mcp'
import { type PortfolioSyncResponse } from '../../shared/portfolio'
import type { DesktopOperations } from './desktop-service'
import { type PortfolioOperations } from './portfolio-service'

import { McpOperationError } from './mcp-operation-error'
import { PortfolioMcpCommands } from './portfolio-mcp-commands'
import { PortfolioMcpQueries } from './portfolio-mcp-queries'

const WRITE_TOOLS = new Set<McpToolName>([
  'chromie_create_workspace',
  'chromie_update_workspace',
  'chromie_create_tag',
  'chromie_update_tag',
  'chromie_set_account_tags',
  'chromie_set_position_tags',
  'chromie_create_account',
  'chromie_update_account',
  'chromie_create_position',
  'chromie_update_position',
  'chromie_create_snapshot'
])

export class PortfolioMcpController {
  private readonly commands: PortfolioMcpCommands
  private readonly queries: PortfolioMcpQueries

  constructor(
    portfolio: PortfolioOperations,
    desktop: DesktopOperations,
    syncAccount: (workspaceId: string, accountId: string) => Promise<PortfolioSyncResponse>
  ) {
    this.commands = new PortfolioMcpCommands(portfolio, desktop, syncAccount)
    this.queries = new PortfolioMcpQueries(portfolio, desktop)
  }

  async callMcpTool(
    name: McpToolName,
    rawArguments: unknown,
    access: McpAccessSettings = DEFAULT_MCP_ACCESS_SETTINGS
  ): Promise<McpToolSuccess> {
    this.assertAccess(name, access)
    const schema = mcpToolInputSchemas[name]
    const parsed = schema.safeParse(rawArguments)
    if (!parsed.success) {
      throw new McpOperationError(
        'VALIDATION_ERROR',
        parsed.error.issues.map((issue) => issue.message).join('，'),
        false,
        parsed.error.flatten()
      )
    }

    switch (name) {
      case 'chromie_list_workspaces':
        return await this.queries.listWorkspaces(listWorkspacesInputSchema.parse(parsed.data))
      case 'chromie_get_workspace':
        return await this.queries.getWorkspace(getWorkspaceInputSchema.parse(parsed.data))
      case 'chromie_get_portfolio_overview':
        return await this.queries.getPortfolioOverview(
          getPortfolioOverviewInputSchema.parse(parsed.data)
        )
      case 'chromie_list_positions':
        return await this.queries.listPositions(listPositionsInputSchema.parse(parsed.data))
      case 'chromie_list_snapshots':
        return await this.queries.listSnapshots(listSnapshotsInputSchema.parse(parsed.data))
      case 'chromie_create_workspace':
        return await this.commands.createWorkspace(createWorkspaceInputSchema.parse(parsed.data))
      case 'chromie_update_workspace':
        return await this.commands.updateWorkspace(updateWorkspaceInputSchema.parse(parsed.data))
      case 'chromie_create_tag':
        return await this.commands.createTag(createTagInputSchema.parse(parsed.data))
      case 'chromie_update_tag':
        return await this.commands.updateTag(updateTagInputSchema.parse(parsed.data))
      case 'chromie_set_account_tags':
        return await this.commands.setAccountTags(setAccountTagsInputSchema.parse(parsed.data))
      case 'chromie_set_position_tags':
        return await this.commands.setPositionTags(setPositionTagsInputSchema.parse(parsed.data))
      case 'chromie_create_account':
        return await this.commands.createAccount(createAccountInputSchema.parse(parsed.data))
      case 'chromie_update_account':
        return await this.commands.updateAccount(updateAccountInputSchema.parse(parsed.data))
      case 'chromie_create_position':
        return await this.commands.createPosition(createPositionInputSchema.parse(parsed.data))
      case 'chromie_update_position':
        return await this.commands.updatePosition(updatePositionInputSchema.parse(parsed.data))
      case 'chromie_create_snapshot':
        return await this.commands.createSnapshot(createSnapshotInputSchema.parse(parsed.data))
      case 'chromie_sync_account':
        return await this.commands.syncForMcp(syncAccountInputSchema.parse(parsed.data))
      case 'chromie_refresh_exchange_rates':
        return await this.commands.refreshExchangeRates(
          refreshExchangeRatesInputSchema.parse(parsed.data)
        )
    }
  }

  private assertAccess(name: McpToolName, access: McpAccessSettings): void {
    if (!access.enabled) {
      throw new McpOperationError('MCP_DISABLED', '请先在 Chromie 中启用 MCP')
    }
    if (WRITE_TOOLS.has(name) && !access.allowWrite) {
      throw new McpOperationError('PERMISSION_DENIED', 'Chromie MCP 当前为只读模式')
    }
  }
}
