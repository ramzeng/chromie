import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'

import {
  DEFAULT_MCP_ACCESS_SETTINGS,
  createWorkspaceInputSchema,
  createAssetAccountInputSchema,
  createAccountGroupInputSchema,
  createPositionGroupInputSchema,
  createPositionInputSchema,
  createSnapshotInputSchema,
  getWorkspaceInputSchema,
  getPortfolioOverviewInputSchema,
  listWorkspacesInputSchema,
  listSnapshotsInputSchema,
  listPositionsInputSchema,
  mcpToolInputSchemas,
  refreshExchangeRatesInputSchema,
  replaceAccountGroupMembersInputSchema,
  replacePositionGroupMembersInputSchema,
  syncAssetAccountInputSchema,
  updateWorkspaceInputSchema,
  updateAssetAccountInputSchema,
  updateAccountGroupInputSchema,
  updatePositionGroupInputSchema,
  updatePositionInputSchema,
  type McpAccessSettings,
  type McpToolArguments,
  type McpToolName,
  type McpToolSuccess
} from '../../shared/mcp'
import {
  DEFAULT_EXCHANGE_RATE_PROVIDER,
  type ExchangeRateSnapshot
} from '../../shared/exchange-rates'
import type { AssetAccountIntegration } from '../../shared/integrations'
import {
  type AppData,
  type AssetAccount,
  type AssetAccountInput,
  type PortfolioCommand,
  type PortfolioCommandResponse,
  type PortfolioLoadResponse,
  type PortfolioSyncResponse,
  type Position,
  type PositionInput,
  type Workspace,
  type WorkspaceSettingsInput
} from '../../shared/portfolio'
import { valuePositions } from '../../shared/valuation'
import type { DesktopOperations } from './desktop-service'
import {
  type PortfolioChangeListener,
  type PortfolioOperations
} from './portfolio-service'

export type McpErrorCode =
  | 'MCP_DISABLED'
  | 'PERMISSION_DENIED'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'READ_ONLY'
  | 'SYNC_NOT_CONFIGURED'
  | 'SYNC_FAILED'

export class McpOperationError extends Error {
  constructor(
    readonly code: McpErrorCode,
    message: string,
    readonly retryable = false,
    readonly details?: unknown
  ) {
    super(message)
    this.name = 'McpOperationError'
  }
}

export interface PortfolioModuleOperations extends PortfolioOperations {
  callMcpTool(
    name: McpToolName,
    rawArguments: unknown,
    access?: McpAccessSettings
  ): Promise<McpToolSuccess>
  syncAssetAccount(
    workspaceId: string,
    assetAccountId: string
  ): Promise<PortfolioSyncResponse>
}

type WorkspaceView = {
  workspace: Workspace
  exchangeRates: ExchangeRateSnapshot | null
  view: {
    kind: 'latest'
  } | {
    kind: 'snapshot'
    snapshot_id: string
    created_at: string
  }
}

const WRITE_TOOLS = new Set<McpToolName>([
  'chromie_create_workspace',
  'chromie_update_workspace',
  'chromie_create_account_group',
  'chromie_update_account_group',
  'chromie_replace_account_group_members',
  'chromie_create_asset_account',
  'chromie_update_asset_account',
  'chromie_create_position',
  'chromie_update_position',
  'chromie_create_position_group',
  'chromie_update_position_group',
  'chromie_replace_position_group_members',
  'chromie_create_snapshot',
  'chromie_sync_asset_account',
  'chromie_refresh_exchange_rates'
])

function success(summary: string, data: unknown): McpToolSuccess {
  return {
    ok: true,
    summary,
    data
  }
}

function mcpExchangeRates(snapshot: ExchangeRateSnapshot | null) {
  if (!snapshot) return null
  const cny = snapshot.rates.CNY
  const hkd = snapshot.rates.HKD
  return {
    provider: snapshot.provider,
    base_currency: snapshot.baseCurrency,
    rates: {
      ...(Number.isFinite(cny) ? { CNY: cny } : {}),
      ...(Number.isFinite(hkd) ? { HKD: hkd } : {}),
      USD: Number.isFinite(snapshot.rates.USD) ? snapshot.rates.USD : 1
    },
    fetched_at: snapshot.fetchedAt
  }
}

type PositionCursor = {
  version: 1
  scope: string
  after: string
}

function positionCursorScope(
  input: McpToolArguments['chromie_list_positions']
): string {
  return createHash('sha256')
    .update(JSON.stringify({
      workspace_id: input.workspace_id,
      view: input.view ?? { kind: 'latest' },
      query: input.query?.toLocaleLowerCase() ?? null,
      market: input.market ?? null,
      currency: input.currency ?? null,
      asset_account_id: input.asset_account_id ?? null,
      account_group_id: input.account_group_id ?? null,
      position_group_id: input.position_group_id ?? null
    }))
    .digest('base64url')
    .slice(0, 22)
}

function encodePositionCursor(scope: string, after: string): string {
  const cursor: PositionCursor = { version: 1, scope, after }
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

function decodePositionCursor(value: string, scope: string): string {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8')
    ) as Partial<PositionCursor>
    if (
      parsed.version === 1 &&
      parsed.scope === scope &&
      typeof parsed.after === 'string' &&
      parsed.after.length > 0
    ) {
      return parsed.after
    }
  } catch {
    // Invalid cursors use the same public validation error below.
  }
  throw new McpOperationError(
    'VALIDATION_ERROR',
    '分页游标无效或与当前查询条件不匹配'
  )
}

function requireWorkspace(data: AppData, workspaceId: string): Workspace {
  const workspace = data.workspaces.find((item) => item.id === workspaceId)
  if (!workspace) throw new McpOperationError('NOT_FOUND', '没有找到对应的工作区')
  return workspace
}

function requireAssetAccount(
  workspace: Workspace,
  assetAccountId: string
): AssetAccount {
  const assetAccount = workspace.assetAccounts.find((item) => item.id === assetAccountId)
  if (!assetAccount) {
    throw new McpOperationError('NOT_FOUND', '没有找到对应的资产账户')
  }
  return assetAccount
}

function safeIntegrationStatus(
  assetAccount: AssetAccount,
  integration: AssetAccountIntegration | undefined
) {
  return {
    capable: assetAccount.type === 'Futu' ||
      assetAccount.type === 'Okx' ||
      assetAccount.type === 'Ibkr' ||
      assetAccount.type === 'Hstong' ||
      assetAccount.type === 'Binance',
    configured: Boolean(assetAccount.sync && integration),
    ...(assetAccount.sync
      ? {
          interval_seconds: assetAccount.sync.interval,
          ...(assetAccount.sync.lastSyncedAt
            ? { last_synced_at: assetAccount.sync.lastSyncedAt }
            : {})
        }
      : {}),
    ...(integration ? { provider: integration.provider } : {})
  }
}

function safeWorkspace(
  workspace: Workspace,
  integrations: AssetAccountIntegration[],
  includePositions: boolean
) {
  return {
    id: workspace.id,
    name: workspace.name,
    base_currency: workspace.baseCurrency,
    exchange_rate_provider: workspace.exchangeRateProvider,
    exchange_rate_refresh_interval_minutes:
      workspace.exchangeRateRefreshIntervalMinutes,
    account_groups: workspace.accountGroups.map((accountGroup) => ({
      id: accountGroup.id,
      name: accountGroup.name,
      asset_account_ids: [...accountGroup.assetAccountIds]
    })),
    asset_accounts: workspace.assetAccounts.map((assetAccount) => ({
      id: assetAccount.id,
      name: assetAccount.name,
      type: assetAccount.type,
      sync: safeIntegrationStatus(
        assetAccount,
        integrations.find((item) => item.assetAccountId === assetAccount.id)
      ),
      position_count: assetAccount.positions.length,
      ...(includePositions
        ? { positions: assetAccount.positions.map((position) => ({ ...position })) }
        : {})
    })),
    position_groups: workspace.positionGroups.map((group) => ({
      id: group.id,
      name: group.name,
      position_ids: [...group.positionIds]
    }))
  }
}

function integrationInput(
  integration: AssetAccountIntegration
): AssetAccountInput['integration'] {
  if (integration.provider === 'Futu') {
    return {
      provider: 'Futu',
      websocket: {
        host: integration.websocket.host,
        port: integration.websocket.port,
        credential: { mode: 'keep' }
      }
    }
  }
  if (integration.provider === 'Ibkr') {
    return { provider: 'Ibkr', gateway: { ...integration.gateway } }
  }
  if (integration.provider === 'Hstong') {
    return {
      provider: 'Hstong',
      gateway: {
        host: integration.gateway.host,
        port: integration.gateway.port,
        credential: { mode: 'keep' }
      }
    }
  }
  if (integration.provider === 'Okx') {
    return {
      provider: 'Okx',
      api: { credential: { mode: 'keep' } }
    }
  }
  return {
    provider: 'Binance',
    api: { credential: { mode: 'keep' } }
  }
}

function positionValue(
  position: Position,
  baseCurrency: string,
  exchangeRates: ExchangeRateSnapshot | null
) {
  const valuation = valuePositions(
    [position],
    baseCurrency,
    exchangeRates?.rates
  )
  const item = valuation.byPositionId.get(position.id)
  return {
    ...(item?.marketValue === undefined ? {} : { market_value: item.marketValue }),
    ...(item?.convertedMarketValue === undefined
      ? {}
      : { converted_market_value: item.convertedMarketValue }),
    missing_currencies: valuation.missingCurrencies
  }
}

function assertCommandResult(response: PortfolioCommandResponse): void {
  if (typeof response.result === 'string') {
    throw new McpOperationError('VALIDATION_ERROR', response.result)
  }
}

export class PortfolioModule implements PortfolioModuleOperations {
  constructor(
    private readonly portfolio: PortfolioOperations,
    private readonly desktop: DesktopOperations
  ) {}

  load(): Promise<PortfolioLoadResponse> {
    return this.portfolio.load()
  }

  execute(command: PortfolioCommand): Promise<PortfolioCommandResponse> {
    return this.portfolio.execute(command)
  }

  inspectBackup(content: unknown) {
    return this.portfolio.inspectBackup(content)
  }

  exportActiveWorkspace(): Promise<string> {
    return this.portfolio.exportActiveWorkspace()
  }

  subscribe(listener: PortfolioChangeListener): () => void {
    return this.portfolio.subscribe(listener)
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
        parsed.error.issues.map((issue) => issue.message).join('；'),
        false,
        parsed.error.flatten()
      )
    }

    switch (name) {
        case 'chromie_list_workspaces':
          return await this.listWorkspaces(listWorkspacesInputSchema.parse(parsed.data))
        case 'chromie_get_workspace':
          return await this.getWorkspace(getWorkspaceInputSchema.parse(parsed.data))
        case 'chromie_get_portfolio_overview':
          return await this.getPortfolioOverview(
            getPortfolioOverviewInputSchema.parse(parsed.data)
          )
        case 'chromie_list_positions':
          return await this.listPositions(
            listPositionsInputSchema.parse(parsed.data)
          )
        case 'chromie_list_snapshots':
          return await this.listSnapshots(listSnapshotsInputSchema.parse(parsed.data))
        case 'chromie_create_workspace':
          return await this.createWorkspace(createWorkspaceInputSchema.parse(parsed.data))
        case 'chromie_update_workspace':
          return await this.updateWorkspace(updateWorkspaceInputSchema.parse(parsed.data))
        case 'chromie_create_account_group':
          return await this.createAccountGroup(
            createAccountGroupInputSchema.parse(parsed.data)
          )
        case 'chromie_update_account_group':
          return await this.updateAccountGroup(
            updateAccountGroupInputSchema.parse(parsed.data)
          )
        case 'chromie_replace_account_group_members':
          return await this.replaceAccountGroupMembers(
            replaceAccountGroupMembersInputSchema.parse(parsed.data)
          )
        case 'chromie_create_asset_account':
          return await this.createAssetAccount(
            createAssetAccountInputSchema.parse(parsed.data)
          )
        case 'chromie_update_asset_account':
          return await this.updateAssetAccount(
            updateAssetAccountInputSchema.parse(parsed.data)
          )
        case 'chromie_create_position':
          return await this.createPosition(createPositionInputSchema.parse(parsed.data))
        case 'chromie_update_position':
          return await this.updatePosition(updatePositionInputSchema.parse(parsed.data))
        case 'chromie_create_position_group':
          return await this.createPositionGroup(
            createPositionGroupInputSchema.parse(parsed.data)
          )
        case 'chromie_update_position_group':
          return await this.updatePositionGroup(
            updatePositionGroupInputSchema.parse(parsed.data)
          )
        case 'chromie_replace_position_group_members':
          return await this.replacePositionGroupMembers(
            replacePositionGroupMembersInputSchema.parse(parsed.data)
          )
        case 'chromie_create_snapshot':
          return await this.createSnapshot(createSnapshotInputSchema.parse(parsed.data))
        case 'chromie_sync_asset_account':
          return await this.syncForMcp(syncAssetAccountInputSchema.parse(parsed.data))
        case 'chromie_refresh_exchange_rates':
          return await this.refreshExchangeRates(
            refreshExchangeRatesInputSchema.parse(parsed.data)
          )
    }
  }

  async syncAssetAccount(
    workspaceId: string,
    assetAccountId: string
  ): Promise<PortfolioSyncResponse> {
    const state = await this.portfolio.load()
    const workspace = requireWorkspace(state.data, workspaceId)
    const assetAccount = requireAssetAccount(workspace, assetAccountId)
    const integration = state.integrations.find(
      (item) => item.assetAccountId === assetAccountId
    )
    if (!assetAccount.sync || !integration) {
      throw new McpOperationError(
        'SYNC_NOT_CONFIGURED',
        '资产账户尚未在 Chromie 中配置自动同步'
      )
    }

    try {
      let result: { positions: PositionInput[]; syncedAt: string }
      if (integration.provider === 'Futu' && assetAccount.type === 'Futu') {
        result = await this.desktop.syncPositions({
          provider: 'futu',
          options: { ...integration.websocket }
        })
      } else if (integration.provider === 'Ibkr' && assetAccount.type === 'Ibkr') {
        result = await this.desktop.syncPositions({
          provider: 'ibkr',
          options: { ...integration.gateway }
        })
      } else if (
        integration.provider === 'Hstong' &&
        assetAccount.type === 'Hstong'
      ) {
        result = await this.desktop.syncPositions({
          provider: 'hstong',
          options: { ...integration.gateway }
        })
      } else if (integration.provider === 'Okx' && assetAccount.type === 'Okx') {
        result = await this.desktop.syncPositions({
          provider: 'okx',
          options: { ...integration.api }
        })
      } else if (
        integration.provider === 'Binance' &&
        assetAccount.type === 'Binance'
      ) {
        result = await this.desktop.syncPositions({
          provider: 'binance',
          options: { ...integration.api }
        })
      } else {
        throw new McpOperationError(
          'SYNC_NOT_CONFIGURED',
          '同步配置与资产账户类型不匹配'
        )
      }

      await this.portfolio.execute({
        type: 'replace-positions',
        workspaceId,
        assetAccountId,
        positions: result.positions,
        lastSyncedAt: result.syncedAt
      })
      return {
        positionCount: result.positions.length,
        syncedAt: result.syncedAt
      }
    } catch (error) {
      if (error instanceof McpOperationError) {
        throw error
      }
      const message = error instanceof Error ? error.message : String(error)
      throw new McpOperationError('SYNC_FAILED', message, true)
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

  private async resolveView(
    state: PortfolioLoadResponse,
    workspaceId: string,
    view: { kind: 'latest' } | { kind: 'snapshot'; snapshot_id: string } = {
      kind: 'latest'
    }
  ): Promise<WorkspaceView> {
    const currentWorkspace = requireWorkspace(state.data, workspaceId)
    if (view.kind === 'snapshot') {
      const snapshot = state.data.snapshots.find(
        (item) => item.id === view.snapshot_id && item.workspaceId === workspaceId
      )
      if (!snapshot) throw new McpOperationError('NOT_FOUND', '没有找到对应的快照')
      return {
        workspace: snapshot.workspace,
        exchangeRates: snapshot.exchangeRates ?? null,
        view: {
          kind: 'snapshot',
          snapshot_id: snapshot.id,
          created_at: snapshot.createdAt
        }
      }
    }
    return {
      workspace: currentWorkspace,
      exchangeRates: await this.desktop.loadExchangeRates(),
      view: { kind: 'latest' }
    }
  }

  private async listWorkspaces(
    _input: McpToolArguments['chromie_list_workspaces']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const exchangeRates = await this.desktop.loadExchangeRates()
    const workspaces = state.data.workspaces.map((workspace) => {
      const positions = workspace.assetAccounts.flatMap((item) => item.positions)
      const valuation = valuePositions(
        positions,
        workspace.baseCurrency,
        exchangeRates?.rates
      )
      return {
        id: workspace.id,
        name: workspace.name,
        base_currency: workspace.baseCurrency,
        account_group_count: workspace.accountGroups.length,
        asset_account_count: workspace.assetAccounts.length,
        position_group_count: workspace.positionGroups.length,
        position_count: positions.length,
        snapshot_count: state.data.snapshots.filter(
          (snapshot) => snapshot.workspaceId === workspace.id
        ).length,
        ...(valuation.totalConvertedMarketValue === undefined
          ? {}
          : { total_converted_market_value: valuation.totalConvertedMarketValue }),
        missing_currencies: valuation.missingCurrencies
      }
    })
    return success(`找到 ${workspaces.length} 个工作区`, {
      active_workspace_id: state.data.activeWorkspaceId,
      exchange_rates: mcpExchangeRates(exchangeRates),
      workspaces
    })
  }

  private async getWorkspace(
    input: McpToolArguments['chromie_get_workspace']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const resolved = await this.resolveView(state, input.workspace_id, input.view)
    return success(`已读取工作区“${resolved.workspace.name}”`, {
      view: resolved.view,
      exchange_rates: mcpExchangeRates(resolved.exchangeRates),
      workspace: safeWorkspace(
        resolved.workspace,
        resolved.view.kind === 'latest' ? state.integrations : [],
        input.include_positions
      )
    })
  }

  private async getPortfolioOverview(
    input: McpToolArguments['chromie_get_portfolio_overview']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const resolved = await this.resolveView(state, input.workspace_id, input.view)
    const { workspace, exchangeRates } = resolved
    const allPositions = workspace.assetAccounts.flatMap((item) => item.positions)
    const total = valuePositions(allPositions, workspace.baseCurrency, exchangeRates?.rates)
    const positionById = new Map(allPositions.map((position) => [position.id, position]))
    let rawRows: Array<{
      id: string
      name: string
      positions: Position[]
      originalCurrency?: string
    }>

    if (input.group_by === 'asset_account') {
      rawRows = workspace.assetAccounts.map((item) => ({
        id: item.id,
        name: item.name,
        positions: item.positions
      }))
    } else if (input.group_by === 'account_group') {
      const assetAccountById = new Map(
        workspace.assetAccounts.map((assetAccount) => [assetAccount.id, assetAccount] as const)
      )
      rawRows = workspace.accountGroups.map((group) => ({
        id: group.id,
        name: group.name,
        positions: group.assetAccountIds.flatMap(
          (assetAccountId) => assetAccountById.get(assetAccountId)?.positions ?? []
        )
      }))
    } else if (input.group_by === 'position_group') {
      rawRows = workspace.positionGroups.map((group) => ({
        id: group.id,
        name: group.name,
        positions: group.positionIds.flatMap((positionId) => {
          const position = positionById.get(positionId)
          return position ? [position] : []
        })
      }))
    } else {
      const positionsByCurrency = new Map<string, Position[]>()
      allPositions.forEach((position) => {
        positionsByCurrency.set(position.currency, [
          ...(positionsByCurrency.get(position.currency) ?? []),
          position
        ])
      })
      rawRows = [...positionsByCurrency].map(([rowCurrency, positions]) => ({
        id: rowCurrency,
        name: rowCurrency,
        positions,
        originalCurrency: rowCurrency
      }))
    }

    const rows = rawRows.map((row) => {
      const valuation = valuePositions(
        row.positions,
        workspace.baseCurrency,
        exchangeRates?.rates
      )
      const originalMarketValue = row.originalCurrency
        ? row.positions.reduce(
            (sum, position) =>
              sum + (position.price === undefined ? 0 : position.quantity * position.price),
            0
          )
        : undefined
      return {
        id: row.id,
        name: row.name,
        position_count: row.positions.length,
        ...(originalMarketValue === undefined
          ? {}
          : {
              currency: row.originalCurrency,
              market_value: originalMarketValue
            }),
        ...(valuation.totalConvertedMarketValue === undefined
          ? {}
          : {
              converted_market_value: valuation.totalConvertedMarketValue,
              ...(total.isComplete &&
              valuation.isComplete &&
              total.totalConvertedMarketValue
                ? {
                    allocation_percent:
                      valuation.totalConvertedMarketValue /
                      total.totalConvertedMarketValue *
                      100
                  }
                : {})
            }),
        missing_currencies: valuation.missingCurrencies
      }
    })
    rows.sort(
      (left, right) =>
        (right.converted_market_value ?? Number.NEGATIVE_INFINITY) -
        (left.converted_market_value ?? Number.NEGATIVE_INFINITY)
    )

    return success(`已生成“${workspace.name}”资产概览`, {
      view: resolved.view,
      group_by: input.group_by,
      base_currency: workspace.baseCurrency,
      exchange_rates: mcpExchangeRates(exchangeRates),
      total: {
        position_count: allPositions.length,
        ...(total.totalConvertedMarketValue === undefined
          ? {}
          : { converted_market_value: total.totalConvertedMarketValue }),
        missing_currencies: total.missingCurrencies,
        complete: total.isComplete
      },
      rows
    })
  }

  private async listPositions(
    input: McpToolArguments['chromie_list_positions']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const resolved = await this.resolveView(state, input.workspace_id, input.view)
    const workspace = resolved.workspace
    const accountGroupByAssetAccountId = new Map(
      workspace.accountGroups.flatMap((accountGroup) =>
        accountGroup.assetAccountIds.map(
          (assetAccountId) => [assetAccountId, accountGroup] as const
        )
      )
    )
    const groupsByPositionId = new Map(
      workspace.positionGroups.flatMap((group) =>
        group.positionIds.map((positionId) => [positionId, group] as const)
      )
    )
    const normalizedQuery = input.query?.toLocaleLowerCase()
    const rows = workspace.assetAccounts.flatMap((assetAccount) => {
      if (input.asset_account_id && input.asset_account_id !== assetAccount.id) return []
      if (
        input.account_group_id &&
        input.account_group_id !== accountGroupByAssetAccountId.get(assetAccount.id)?.id
      ) {
        return []
      }
      return assetAccount.positions.flatMap((position) => {
        const group = groupsByPositionId.get(position.id)
        if (
          input.position_group_id &&
          group?.id !== input.position_group_id
        ) {
          return []
        }
        if (input.market && position.market !== input.market) return []
        if (input.currency && position.currency !== input.currency) return []
        if (
          normalizedQuery &&
          !position.symbol.toLocaleLowerCase().includes(normalizedQuery) &&
          !position.name.toLocaleLowerCase().includes(normalizedQuery) &&
          !assetAccount.name.toLocaleLowerCase().includes(normalizedQuery)
        ) return []
        return [{
          cursorKey: JSON.stringify([assetAccount.id, position.id]),
          value: {
            ...position,
            asset_account: { id: assetAccount.id, name: assetAccount.name },
            account_group: (() => {
              const accountGroup = accountGroupByAssetAccountId.get(assetAccount.id)
              return accountGroup
                ? {
                    id: accountGroup.id,
                    name: accountGroup.name,
                    asset_account_ids: [...accountGroup.assetAccountIds]
                  }
                : null
            })(),
            position_group: group ? { id: group.id, name: group.name } : null,
            valuation: positionValue(
              position,
              workspace.baseCurrency,
              resolved.exchangeRates
            )
          }
        }]
      })
    })
    rows.sort((left, right) =>
      left.cursorKey < right.cursorKey ? -1 : left.cursorKey > right.cursorKey ? 1 : 0
    )
    const scope = positionCursorScope(input)
    const after = input.cursor
      ? decodePositionCursor(input.cursor, scope)
      : null
    const remaining = after
      ? rows.filter((row) => row.cursorKey > after)
      : rows
    const pageRows = remaining.slice(0, input.limit)
    const positions = pageRows.map((row) => row.value)
    const lastCursorKey = pageRows.at(-1)?.cursorKey
    return success(`找到 ${rows.length} 项持仓`, {
      view: resolved.view,
      total: rows.length,
      positions,
      ...(remaining.length > pageRows.length && lastCursorKey
        ? { next_cursor: encodePositionCursor(scope, lastCursorKey) }
        : {})
    })
  }

  private async listSnapshots(
    input: McpToolArguments['chromie_list_snapshots']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const workspace = requireWorkspace(state.data, input.workspace_id)
    const snapshots = state.data.snapshots
      .filter((snapshot) => snapshot.workspaceId === workspace.id)
      .map((snapshot) => ({
        id: snapshot.id,
        created_at: snapshot.createdAt,
        asset_account_count: snapshot.workspace.assetAccounts.length,
        position_group_count: snapshot.workspace.positionGroups.length,
        position_count: snapshot.workspace.assetAccounts.reduce(
          (count, item) => count + item.positions.length,
          0
        ),
        exchange_rates_fetched_at: snapshot.exchangeRates?.fetchedAt ?? null
      }))
    return success(`找到 ${snapshots.length} 个历史快照`, {
      workspace: { id: workspace.id, name: workspace.name },
      snapshots
    })
  }

  private async createWorkspace(
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

  private async updateWorkspace(
    input: McpToolArguments['chromie_update_workspace']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const workspace = requireWorkspace(state.data, input.workspace_id)
    const settings: WorkspaceSettingsInput = {
      name: input.name ?? workspace.name,
      baseCurrency: input.base_currency ?? workspace.baseCurrency,
      exchangeRateProvider:
        input.exchange_rate_provider ?? workspace.exchangeRateProvider,
      exchangeRateRefreshIntervalMinutes:
        input.exchange_rate_refresh_interval_minutes ??
        workspace.exchangeRateRefreshIntervalMinutes
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

  private async createAccountGroup(
    input: McpToolArguments['chromie_create_account_group']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    requireWorkspace(state.data, input.workspace_id)
    const response = await this.portfolio.execute({
      type: 'create-account-group',
      workspaceId: input.workspace_id,
      input: { name: input.name }
    })
    if (typeof response.result !== 'string') {
      throw new Error('创建账户分组后无法读取结果')
    }
    return success(`已创建账户分组“${input.name}”`, {
      account_group: {
        id: response.result,
        name: input.name,
        asset_account_ids: []
      }
    })
  }

  private async updateAccountGroup(
    input: McpToolArguments['chromie_update_account_group']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const workspace = requireWorkspace(state.data, input.workspace_id)
    const existing = workspace.accountGroups.find(
      (accountGroup) => accountGroup.id === input.account_group_id
    )
    if (!existing) {
      throw new McpOperationError('NOT_FOUND', '没有找到对应的账户分组')
    }
    await this.portfolio.execute({
      type: 'update-account-group',
      workspaceId: workspace.id,
      groupId: existing.id,
      input: { name: input.name }
    })
    return success(`已更新账户分组“${input.name}”`, {
      account_group: {
        id: existing.id,
        name: input.name,
        asset_account_ids: [...existing.assetAccountIds]
      }
    })
  }

  private async replaceAccountGroupMembers(
    input: McpToolArguments['chromie_replace_account_group_members']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const workspace = requireWorkspace(state.data, input.workspace_id)
    if (!workspace.accountGroups.some((group) => group.id === input.account_group_id)) {
      throw new McpOperationError('NOT_FOUND', '没有找到对应的账户分组')
    }
    const response = await this.portfolio.execute({
      type: 'set-account-group-accounts',
      workspaceId: workspace.id,
      groupId: input.account_group_id,
      assetAccountIds: input.asset_account_ids
    })
    assertCommandResult(response)
    return success(`账户分组现包含 ${input.asset_account_ids.length} 个资产账户`, {
      account_group_id: input.account_group_id,
      asset_account_ids: input.asset_account_ids
    })
  }

  private async createAssetAccount(
    input: McpToolArguments['chromie_create_asset_account']
  ): Promise<McpToolSuccess> {
    const response = await this.portfolio.execute({
      type: 'create-asset-account',
      workspaceId: input.workspace_id,
      input: {
        name: input.name,
        type: input.type
      }
    })
    return success(`已创建资产账户“${input.name}”`, {
      asset_account_id: response.result
    })
  }

  private async updateAssetAccount(
    input: McpToolArguments['chromie_update_asset_account']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const workspace = requireWorkspace(state.data, input.workspace_id)
    const assetAccount = requireAssetAccount(workspace, input.asset_account_id)
    const integration = state.integrations.find(
      (item) => item.assetAccountId === assetAccount.id
    )
    const nextType = input.type ?? assetAccount.type
    if (integration && nextType !== assetAccount.type) {
      throw new McpOperationError(
        'VALIDATION_ERROR',
        '已配置自动同步的资产账户不能通过 MCP 修改类型，请在 Chromie 中操作'
      )
    }
    await this.portfolio.execute({
      type: 'update-asset-account',
      workspaceId: workspace.id,
      assetAccountId: assetAccount.id,
      input: {
        name: input.name ?? assetAccount.name,
        type: nextType,
        sync: assetAccount.sync,
        ...(integration ? { integration: integrationInput(integration) } : {})
      }
    })
    return success(`已更新资产账户“${input.name ?? assetAccount.name}”`, {
      asset_account_id: assetAccount.id
    })
  }

  private async createPosition(
    input: McpToolArguments['chromie_create_position']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const workspace = requireWorkspace(state.data, input.workspace_id)
    const assetAccount = requireAssetAccount(workspace, input.asset_account_id)
    if (assetAccount.sync) {
      throw new McpOperationError('READ_ONLY', '自动同步的资产账户不能手动修改持仓')
    }
    const positionInput: PositionInput = {
      market: input.market,
      symbol: input.symbol,
      name: input.name,
      currency: input.currency,
      quantity: input.quantity,
      ...(input.price === null || input.price === undefined
        ? {}
        : { price: input.price })
    }
    const position = await this.persistPosition(workspace, assetAccount, positionInput)
    return success(`已创建持仓 ${position.symbol}`, { position })
  }

  private async updatePosition(
    input: McpToolArguments['chromie_update_position']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const workspace = requireWorkspace(state.data, input.workspace_id)
    const assetAccount = requireAssetAccount(workspace, input.asset_account_id)
    if (assetAccount.sync) {
      throw new McpOperationError('READ_ONLY', '自动同步的资产账户不能手动修改持仓')
    }
    const existing = assetAccount.positions.find(
      (position) => position.id === input.position_id
    )
    if (!existing) {
      throw new McpOperationError('NOT_FOUND', '没有找到对应的持仓')
    }
    const positionInput: PositionInput = {
      market: input.market ?? existing.market,
      symbol: input.symbol ?? existing.symbol,
      name: input.name ?? existing.name,
      currency: input.currency ?? existing.currency,
      quantity: input.quantity ?? existing.quantity,
      ...(
        input.price === null
          ? {}
          : input.price !== undefined
            ? { price: input.price }
            : existing.price === undefined
              ? {}
              : { price: existing.price }
      )
    }
    const position = await this.persistPosition(
      workspace,
      assetAccount,
      positionInput,
      existing.id
    )
    return success(`已更新持仓 ${position.symbol}`, { position })
  }

  private async persistPosition(
    workspace: Workspace,
    assetAccount: AssetAccount,
    positionInput: PositionInput,
    positionId?: string
  ): Promise<Position> {
    const response = await this.portfolio.execute({
      type: 'save-position',
      workspaceId: workspace.id,
      assetAccountId: assetAccount.id,
      input: positionInput,
      ...(positionId ? { positionId } : {})
    })
    assertCommandResult(response)
    const stored = response.data.workspaces
      .find((item) => item.id === workspace.id)
      ?.assetAccounts.find((item) => item.id === assetAccount.id)
      ?.positions.find((position) =>
        positionId
          ? position.id === positionId
          : position.market === positionInput.market &&
            position.symbol === positionInput.symbol.trim().toUpperCase()
      )
    if (!stored) throw new Error('保存持仓后无法读取结果')
    return stored
  }

  private async createPositionGroup(
    input: McpToolArguments['chromie_create_position_group']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    requireWorkspace(state.data, input.workspace_id)
    const response = await this.portfolio.execute({
      type: 'create-position-group',
      workspaceId: input.workspace_id,
      input: { name: input.name }
    })
    if (typeof response.result !== 'string') {
      throw new Error('创建持仓分组后无法读取结果')
    }
    return success(`已创建持仓分组“${input.name}”`, {
      position_group_id: response.result
    })
  }

  private async updatePositionGroup(
    input: McpToolArguments['chromie_update_position_group']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const workspace = requireWorkspace(state.data, input.workspace_id)
    if (
      !workspace.positionGroups.some(
        (group) => group.id === input.position_group_id
      )
    ) {
      throw new McpOperationError('NOT_FOUND', '没有找到对应的持仓分组')
    }
    await this.portfolio.execute({
      type: 'update-position-group',
      workspaceId: input.workspace_id,
      groupId: input.position_group_id,
      input: { name: input.name }
    })
    return success(`已更新持仓分组“${input.name}”`, {
      position_group_id: input.position_group_id
    })
  }

  private async replacePositionGroupMembers(
    input: McpToolArguments['chromie_replace_position_group_members']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const workspace = requireWorkspace(state.data, input.workspace_id)
    if (
      !workspace.positionGroups.some(
        (group) => group.id === input.position_group_id
      )
    ) {
      throw new McpOperationError('NOT_FOUND', '没有找到对应的持仓分组')
    }
    const response = await this.portfolio.execute({
      type: 'set-position-group-positions',
      workspaceId: input.workspace_id,
      groupId: input.position_group_id,
      positionIds: input.position_ids
    })
    assertCommandResult(response)
    return success(`持仓分组现包含 ${input.position_ids.length} 项持仓`, {
      position_group_id: input.position_group_id,
      position_ids: input.position_ids
    })
  }

  private async createSnapshot(
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

  private async syncForMcp(
    input: McpToolArguments['chromie_sync_asset_account']
  ): Promise<McpToolSuccess> {
    const result = await this.syncAssetAccount(
      input.workspace_id,
      input.asset_account_id
    )
    return success(`已同步 ${result.positionCount} 项持仓`, {
      asset_account_id: input.asset_account_id,
      position_count: result.positionCount,
      synced_at: result.syncedAt
    })
  }

  private async refreshExchangeRates(
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
