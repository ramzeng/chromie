import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'

import {
  DEFAULT_MCP_ACCESS_SETTINGS,
  createWorkspaceInputSchema,
  createAccountInputSchema,
  createTagInputSchema,
  createPositionInputSchema,
  createSnapshotInputSchema,
  getWorkspaceInputSchema,
  getPortfolioOverviewInputSchema,
  listWorkspacesInputSchema,
  listSnapshotsInputSchema,
  listPositionsInputSchema,
  mcpToolInputSchemas,
  refreshExchangeRatesInputSchema,
  setAccountTagsInputSchema,
  setPositionTagsInputSchema,
  syncAccountInputSchema,
  updateWorkspaceInputSchema,
  updateAccountInputSchema,
  updateTagInputSchema,
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
import type { AccountIntegration } from '../../shared/integrations'
import {
  type AppData,
  type Account,
  type AccountInput,
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
  type PortfolioOperations,
  PortfolioSyncConflictError
} from './portfolio-service'

export type McpErrorCode =
  | 'MCP_DISABLED'
  | 'PERMISSION_DENIED'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'READ_ONLY'
  | 'SYNC_NOT_CONFIGURED'
  | 'SYNC_CONFLICT'
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
  syncAccount(
    workspaceId: string,
    accountId: string
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
      account_id: input.account_id ?? null,
      tag_id: input.tag_id ?? null
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

function requireAccount(
  workspace: Workspace,
  accountId: string
): Account {
  const account = workspace.accounts.find((item) => item.id === accountId)
  if (!account) {
    throw new McpOperationError('NOT_FOUND', '没有找到对应的账户')
  }
  return account
}

function safeIntegrationStatus(
  account: Account,
  integration: AccountIntegration | undefined
) {
  return {
    capable: account.type === 'Futu' ||
      account.type === 'Okx' ||
      account.type === 'Ibkr' ||
      account.type === 'Hstong' ||
      account.type === 'Binance',
    configured: Boolean(account.sync && integration),
    ...(account.sync
      ? {
          interval_seconds: account.sync.interval,
          ...(account.sync.lastSyncedAt
            ? { last_synced_at: account.sync.lastSyncedAt }
            : {})
        }
      : {}),
    ...(integration ? { provider: integration.provider } : {})
  }
}

function safeWorkspace(
  workspace: Workspace,
  integrations: AccountIntegration[],
  includePositions: boolean
) {
  return {
    id: workspace.id,
    name: workspace.name,
    base_currency: workspace.baseCurrency,
    exchange_rate_provider: workspace.exchangeRateProvider,
    exchange_rate_refresh_interval_minutes:
      workspace.exchangeRateRefreshIntervalMinutes,
    tags: workspace.tags.map((tag) => ({ ...tag })),
    accounts: workspace.accounts.map((account) => ({
      id: account.id,
      name: account.name,
      type: account.type,
      sync: safeIntegrationStatus(
        account,
        integrations.find((item) => item.accountId === account.id)
      ),
      tag_ids: [...account.tagIds],
      position_count: account.positions.length,
      ...(includePositions
        ? {
            positions: account.positions.map(safePosition)
          }
        : {})
    }))
  }
}

function safePosition(position: Position) {
  return {
    id: position.id,
    market: position.market,
    symbol: position.symbol,
    name: position.name,
    currency: position.currency,
    quantity: position.quantity,
    ...(position.price === undefined ? {} : { price: position.price }),
    tag_ids: [...position.tagIds]
  }
}

function integrationInput(
  integration: AccountIntegration
): AccountInput['integration'] {
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
    missing_currencies: valuation.missingCurrencies,
    missing_price_count: valuation.missingPriceCount
  }
}

export class PortfolioModule implements PortfolioModuleOperations {
  private readonly syncingAccounts = new Map<string, Promise<PortfolioSyncResponse>>()

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

  replaceSynchronizedPositions(
    workspaceId: string,
    accountId: string,
    expectedIntegration: AccountIntegration,
    positions: PositionInput[],
    syncedAt: string
  ): Promise<void> {
    return this.portfolio.replaceSynchronizedPositions(
      workspaceId,
      accountId,
      expectedIntegration,
      positions,
      syncedAt
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
        case 'chromie_create_tag':
          return await this.createTag(
            createTagInputSchema.parse(parsed.data)
          )
        case 'chromie_update_tag':
          return await this.updateTag(
            updateTagInputSchema.parse(parsed.data)
          )
        case 'chromie_set_account_tags':
          return await this.setAccountTags(
            setAccountTagsInputSchema.parse(parsed.data)
          )
        case 'chromie_set_position_tags':
          return await this.setPositionTags(
            setPositionTagsInputSchema.parse(parsed.data)
          )
        case 'chromie_create_account':
          return await this.createAccount(
            createAccountInputSchema.parse(parsed.data)
          )
        case 'chromie_update_account':
          return await this.updateAccount(
            updateAccountInputSchema.parse(parsed.data)
          )
        case 'chromie_create_position':
          return await this.createPosition(createPositionInputSchema.parse(parsed.data))
        case 'chromie_update_position':
          return await this.updatePosition(updatePositionInputSchema.parse(parsed.data))
        case 'chromie_create_snapshot':
          return await this.createSnapshot(createSnapshotInputSchema.parse(parsed.data))
        case 'chromie_sync_account':
          return await this.syncForMcp(syncAccountInputSchema.parse(parsed.data))
        case 'chromie_refresh_exchange_rates':
          return await this.refreshExchangeRates(
            refreshExchangeRatesInputSchema.parse(parsed.data)
          )
    }
  }

  syncAccount(
    workspaceId: string,
    accountId: string
  ): Promise<PortfolioSyncResponse> {
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
    const integration = state.integrations.find(
      (item) => item.accountId === accountId
    )
    if (!account.sync || !integration) {
      throw new McpOperationError(
        'SYNC_NOT_CONFIGURED',
        '账户尚未在 Chromie 中配置自动同步'
      )
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
      } else if (
        integration.provider === 'Hstong' &&
        account.type === 'Hstong'
      ) {
        result = await this.desktop.syncPositions({
          provider: 'hstong',
          options: { ...integration.gateway }
        })
      } else if (integration.provider === 'Okx' && account.type === 'Okx') {
        result = await this.desktop.syncPositions({
          provider: 'okx',
          options: { ...integration.api }
        })
      } else if (
        integration.provider === 'Binance' &&
        account.type === 'Binance'
      ) {
        result = await this.desktop.syncPositions({
          provider: 'binance',
          options: { ...integration.api }
        })
      } else {
        throw new McpOperationError(
          'SYNC_NOT_CONFIGURED',
          '同步配置与账户类型不匹配'
        )
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
      const positions = workspace.accounts.flatMap((item) => item.positions)
      const valuation = valuePositions(
        positions,
        workspace.baseCurrency,
        exchangeRates?.rates
      )
      return {
        id: workspace.id,
        name: workspace.name,
        base_currency: workspace.baseCurrency,
        tag_count: workspace.tags.length,
        account_count: workspace.accounts.length,
        position_count: positions.length,
        snapshot_count: state.data.snapshots.filter(
          (snapshot) => snapshot.workspaceId === workspace.id
        ).length,
        ...(valuation.totalConvertedMarketValue === undefined
          ? {}
          : { total_converted_market_value: valuation.totalConvertedMarketValue }),
        missing_currencies: valuation.missingCurrencies,
        missing_price_count: valuation.missingPriceCount
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
    const allPositions = workspace.accounts.flatMap((item) => item.positions)
    const total = valuePositions(allPositions, workspace.baseCurrency, exchangeRates?.rates)
    let rawRows: Array<{
      id: string
      name: string
      positions: Position[]
      originalCurrency?: string
    }>

    if (input.group_by === 'account') {
      rawRows = workspace.accounts.map((item) => ({
        id: item.id,
        name: item.name,
        positions: item.positions
      }))
    } else if (input.group_by === 'tag') {
      rawRows = workspace.tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        positions: workspace.accounts.flatMap((account) =>
          account.positions.filter((position) =>
            account.tagIds.includes(tag.id) || position.tagIds.includes(tag.id)
          )
        )
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
        missing_currencies: valuation.missingCurrencies,
        missing_price_count: valuation.missingPriceCount
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
        missing_price_count: total.missingPriceCount,
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
    const tagById = new Map(workspace.tags.map((tag) => [tag.id, tag] as const))
    const normalizedQuery = input.query?.toLocaleLowerCase()
    const rows = workspace.accounts.flatMap((account) => {
      if (input.account_id && input.account_id !== account.id) return []
      return account.positions.flatMap((position) => {
        if (
          input.tag_id &&
          !account.tagIds.includes(input.tag_id) &&
          !position.tagIds.includes(input.tag_id)
        ) {
          return []
        }
        if (input.market && position.market !== input.market) return []
        if (input.currency && position.currency !== input.currency) return []
        if (
          normalizedQuery &&
          !position.symbol.toLocaleLowerCase().includes(normalizedQuery) &&
          !position.name.toLocaleLowerCase().includes(normalizedQuery) &&
          !account.name.toLocaleLowerCase().includes(normalizedQuery)
        ) return []
        return [{
          cursorKey: JSON.stringify([account.id, position.id]),
          value: {
            id: position.id,
            market: position.market,
            symbol: position.symbol,
            name: position.name,
            currency: position.currency,
            quantity: position.quantity,
            ...(position.price === undefined ? {} : { price: position.price }),
            tag_ids: [...position.tagIds],
            account: { id: account.id, name: account.name },
            tags: position.tagIds.flatMap((tagId) => {
              const tag = tagById.get(tagId)
              return tag ? [{ ...tag }] : []
            }),
            account_tags: account.tagIds.flatMap((tagId) => {
              const tag = tagById.get(tagId)
              return tag ? [{ ...tag }] : []
            }),
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
        account_count: snapshot.workspace.accounts.length,
        tag_count: snapshot.workspace.tags.length,
        position_count: snapshot.workspace.accounts.reduce(
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

  private async createTag(
    input: McpToolArguments['chromie_create_tag']
  ): Promise<McpToolSuccess> {
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

  private async updateTag(
    input: McpToolArguments['chromie_update_tag']
  ): Promise<McpToolSuccess> {
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

  private async setAccountTags(
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

  private async setPositionTags(
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

  private async createAccount(
    input: McpToolArguments['chromie_create_account']
  ): Promise<McpToolSuccess> {
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

  private async updateAccount(
    input: McpToolArguments['chromie_update_account']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const workspace = requireWorkspace(state.data, input.workspace_id)
    const account = requireAccount(workspace, input.account_id)
    const integration = state.integrations.find(
      (item) => item.accountId === account.id
    )
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

  private async createPosition(
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
      ...(input.price === null || input.price === undefined
        ? {}
        : { price: input.price })
    }
    const position = await this.persistPosition(workspace, account, positionInput)
    return success(`已创建持仓 ${position.symbol}`, { position: safePosition(position) })
  }

  private async updatePosition(
    input: McpToolArguments['chromie_update_position']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const workspace = requireWorkspace(state.data, input.workspace_id)
    const account = requireAccount(workspace, input.account_id)
    if (account.sync) {
      throw new McpOperationError('READ_ONLY', '自动同步的账户不能手动修改持仓')
    }
    const existing = account.positions.find(
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
      tagIds: input.tag_ids ?? existing.tagIds,
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
      account,
      positionInput,
      existing.id
    )
    return success(`已更新持仓 ${position.symbol}`, { position: safePosition(position) })
  }

  private async persistPosition(
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
    input: McpToolArguments['chromie_sync_account']
  ): Promise<McpToolSuccess> {
    const result = await this.syncAccount(
      input.workspace_id,
      input.account_id
    )
    return success(`已同步 ${result.positionCount} 项持仓`, {
      account_id: input.account_id,
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
