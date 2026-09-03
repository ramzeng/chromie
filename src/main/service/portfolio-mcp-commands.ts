import { DEFAULT_EXCHANGE_RATE_PROVIDER } from '../../shared/exchange-rates'
import { type McpToolArguments, type McpToolSuccess } from '../../shared/mcp'
import {
  type Account,
  type PortfolioSyncResponse,
  type Position,
  type PositionInput,
  type Workspace,
  type WorkspaceSettingsInput
} from '../../shared/portfolio'
import type { DesktopOperations } from './desktop-service'
import { type PortfolioOperations } from './portfolio-service'

import { McpOperationError } from './mcp-operation-error'
import {
  integrationInput,
  mcpExchangeRates,
  requireAccount,
  requireWorkspace,
  safePosition,
  success
} from './portfolio-mcp-helpers'

export class PortfolioMcpCommands {
  constructor(
    private readonly portfolio: PortfolioOperations,
    private readonly desktop: DesktopOperations,
    private readonly syncAccount: (
      workspaceId: string,
      accountId: string
    ) => Promise<PortfolioSyncResponse>
  ) {}

  async createWorkspace(
    input: McpToolArguments['chromie_create_workspace']
  ): Promise<McpToolSuccess> {
    const response = await this.portfolio.execute({
      type: 'create-workspace',
      input: { name: input.name, baseCurrency: input.base_currency }
    })
    return success(`已创建工作区“${input.name}”`, {
      workspace_id: response.result
    })
  }

  async updateWorkspace(
    input: McpToolArguments['chromie_update_workspace']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const workspace = requireWorkspace(state.data, input.workspace_id)
    const settings: WorkspaceSettingsInput = {
      name: input.name ?? workspace.name,
      baseCurrency: input.base_currency ?? workspace.baseCurrency,
      exchangeRateProvider: input.exchange_rate_provider ?? workspace.exchangeRateProvider,
      exchangeRateRefreshIntervalMinutes:
        input.exchange_rate_refresh_interval_minutes ??
        workspace.exchangeRateRefreshIntervalMinutes,
      stockQuoteProvider: workspace.stockQuoteProvider,
      cryptoQuoteProvider: workspace.cryptoQuoteProvider
    }
    await this.portfolio.execute({
      type: 'update-workspace',
      id: workspace.id,
      input: settings
    })
    return success(`已更新工作区“${settings.name}”`, {
      workspace_id: workspace.id
    })
  }

  async createTag(input: McpToolArguments['chromie_create_tag']): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    requireWorkspace(state.data, input.workspace_id)
    const response = await this.portfolio.execute({
      type: 'create-tag',
      workspaceId: input.workspace_id,
      input: { name: input.name, color: input.color }
    })
    if (typeof response.result !== 'string') {
      throw new Error('添加标签后无法读取结果')
    }
    return success(`已添加标签“${input.name}”`, {
      tag: { id: response.result, name: input.name, color: input.color }
    })
  }

  async updateTag(input: McpToolArguments['chromie_update_tag']): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const workspace = requireWorkspace(state.data, input.workspace_id)
    const existing = workspace.tags.find((tag) => tag.id === input.tag_id)
    if (!existing) {
      throw new McpOperationError('NOT_FOUND', '没有找到对应的标签')
    }
    await this.portfolio.execute({
      type: 'update-tag',
      workspaceId: workspace.id,
      tagId: existing.id,
      input: { name: input.name, color: input.color }
    })
    return success(`已更新标签“${input.name}”`, {
      tag: { id: existing.id, name: input.name, color: input.color }
    })
  }

  async setAccountTags(
    input: McpToolArguments['chromie_set_account_tags']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const workspace = requireWorkspace(state.data, input.workspace_id)
    requireAccount(workspace, input.account_id)
    await this.portfolio.execute({
      type: 'set-account-tags',
      workspaceId: workspace.id,
      accountId: input.account_id,
      tagIds: input.tag_ids
    })
    return success('账户标签已更新', {
      account_id: input.account_id,
      tag_ids: input.tag_ids
    })
  }

  async setPositionTags(
    input: McpToolArguments['chromie_set_position_tags']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const workspace = requireWorkspace(state.data, input.workspace_id)
    const account = requireAccount(workspace, input.account_id)
    if (!account.positions.some((position) => position.id === input.position_id)) {
      throw new McpOperationError('NOT_FOUND', '没有找到对应的持仓')
    }
    await this.portfolio.execute({
      type: 'set-position-tags',
      workspaceId: workspace.id,
      accountId: account.id,
      positionId: input.position_id,
      tagIds: input.tag_ids
    })
    return success('持仓标签已更新', {
      position_id: input.position_id,
      tag_ids: input.tag_ids
    })
  }

  async createAccount(input: McpToolArguments['chromie_create_account']): Promise<McpToolSuccess> {
    const response = await this.portfolio.execute({
      type: 'create-account',
      workspaceId: input.workspace_id,
      input: {
        name: input.name,
        type: input.type,
        tagIds: input.tag_ids
      }
    })
    return success(`已创建账户“${input.name}”`, {
      account_id: response.result
    })
  }

  async updateAccount(input: McpToolArguments['chromie_update_account']): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const workspace = requireWorkspace(state.data, input.workspace_id)
    const account = requireAccount(workspace, input.account_id)
    const integration = state.integrations.find((item) => item.accountId === account.id)
    const nextType = input.type ?? account.type
    if (integration && nextType !== account.type) {
      throw new McpOperationError(
        'VALIDATION_ERROR',
        '已配置自动同步的账户不能通过 MCP 修改类型，请在 Chromie 中操作'
      )
    }
    await this.portfolio.execute({
      type: 'update-account',
      workspaceId: workspace.id,
      accountId: account.id,
      input: {
        name: input.name ?? account.name,
        type: nextType,
        sync: account.sync,
        tagIds: input.tag_ids ?? account.tagIds,
        ...(integration ? { integration: integrationInput(integration) } : {})
      }
    })
    return success(`已更新账户“${input.name ?? account.name}”`, {
      account_id: account.id
    })
  }

  async createPosition(
    input: McpToolArguments['chromie_create_position']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const workspace = requireWorkspace(state.data, input.workspace_id)
    const account = requireAccount(workspace, input.account_id)
    if (account.sync) {
      throw new McpOperationError('READ_ONLY', '自动同步的账户不能手动修改持仓')
    }
    const positionInput: PositionInput = {
      market: input.market,
      symbol: input.symbol,
      name: input.name,
      currency: input.currency,
      quantity: input.quantity,
      tagIds: input.tag_ids,
      ...(input.price === null || input.price === undefined ? {} : { price: input.price })
    }
    const position = await this.persistPosition(workspace, account, positionInput)
    return success(`已创建持仓 ${position.symbol}`, {
      position: safePosition(position)
    })
  }

  async updatePosition(
    input: McpToolArguments['chromie_update_position']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const workspace = requireWorkspace(state.data, input.workspace_id)
    const account = requireAccount(workspace, input.account_id)
    if (account.sync) {
      throw new McpOperationError('READ_ONLY', '自动同步的账户不能手动修改持仓')
    }
    const existing = account.positions.find((position) => position.id === input.position_id)
    if (!existing) {
      throw new McpOperationError('NOT_FOUND', '没有找到对应的持仓')
    }
    const positionInput: PositionInput = {
      market: input.market ?? existing.market,
      symbol: input.symbol ?? existing.symbol,
      name: input.name ?? existing.name,
      currency: input.currency ?? existing.currency,
      quantity: input.quantity ?? existing.quantity,
      tagIds: input.tag_ids ?? existing.tagIds,
      ...(input.price === null
        ? {}
        : input.price !== undefined
          ? { price: input.price }
          : existing.price === undefined
            ? {}
            : { price: existing.price })
    }
    const position = await this.persistPosition(workspace, account, positionInput, existing.id)
    return success(`已更新持仓 ${position.symbol}`, {
      position: safePosition(position)
    })
  }

  async persistPosition(
    workspace: Workspace,
    account: Account,
    positionInput: PositionInput,
    positionId?: string
  ): Promise<Position> {
    const response = await this.portfolio.execute({
      type: 'save-position',
      workspaceId: workspace.id,
      accountId: account.id,
      input: positionInput,
      ...(positionId ? { positionId } : {})
    })
    const stored = response.data.workspaces
      .find((item) => item.id === workspace.id)
      ?.accounts.find((item) => item.id === account.id)
      ?.positions.find((position) =>
        positionId
          ? position.id === positionId
          : position.market === positionInput.market &&
            position.symbol === positionInput.symbol.trim().toUpperCase()
      )
    if (!stored) throw new Error('保存持仓后无法读取结果')
    return stored
  }

  async createSnapshot(
    input: McpToolArguments['chromie_create_snapshot']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    requireWorkspace(state.data, input.workspace_id)
    const exchangeRates = await this.desktop.loadExchangeRates()
    const response = await this.portfolio.execute({
      type: 'create-snapshot',
      workspaceId: input.workspace_id,
      exchangeRates
    })
    if (!response.result) {
      throw new McpOperationError('NOT_FOUND', '没有找到对应的工作区')
    }
    return success('已创建资产快照', {
      snapshot_id: response.result,
      exchange_rates_fetched_at: exchangeRates?.fetchedAt ?? null
    })
  }

  async syncForMcp(input: McpToolArguments['chromie_sync_account']): Promise<McpToolSuccess> {
    const result = await this.syncAccount(input.workspace_id, input.account_id)
    return success(`已同步 ${result.positionCount} 项持仓`, {
      account_id: input.account_id,
      position_count: result.positionCount,
      synced_at: result.syncedAt
    })
  }

  async refreshExchangeRates(
    input: McpToolArguments['chromie_refresh_exchange_rates']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const provider = input.workspace_id
      ? requireWorkspace(state.data, input.workspace_id).exchangeRateProvider
      : DEFAULT_EXCHANGE_RATE_PROVIDER
    const snapshot = await this.desktop.fetchExchangeRates(provider)
    return success(`已刷新 ${snapshot.provider} 汇率`, {
      exchange_rates: mcpExchangeRates(snapshot)
    })
  }
}
