import {
  DEFAULT_MCP_ACCESS_SETTINGS,
  createAccountInputSchema,
  createAssetAccountInputSchema,
  createSnapshotInputSchema,
  deleteItemInputSchema,
  findPositionsInputSchema,
  getAccountInputSchema,
  getOverviewInputSchema,
  listAccountsInputSchema,
  listSnapshotsInputSchema,
  mcpToolInputSchemas,
  refreshExchangeRatesInputSchema,
  saveHolderInputSchema,
  savePositionGroupInputSchema,
  savePositionInputSchema,
  setGroupMembersInputSchema,
  syncAssetAccountInputSchema,
  updateAccountInputSchema,
  updateAssetAccountInputSchema,
  type McpAccessSettings,
  type McpDeleteTarget,
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
  type ProductAccount,
  type ProductAccountSettingsInput
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
  | 'CONFIRMATION_REQUIRED'

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

export type McpDeletePreview = {
  title: string
  description: string
}

export interface PortfolioModuleOperations extends PortfolioOperations {
  callMcpTool(
    name: McpToolName,
    rawArguments: unknown,
    access?: McpAccessSettings,
    confirmed?: boolean
  ): Promise<McpToolSuccess>
  previewMcpDelete(
    rawArguments: unknown,
    access?: McpAccessSettings
  ): Promise<McpDeletePreview>
  syncAssetAccount(
    accountId: string,
    assetAccountId: string
  ): Promise<PortfolioSyncResponse>
}

type AccountView = {
  account: ProductAccount
  exchangeRates: ExchangeRateSnapshot | null
  view: { kind: 'latest' } | { kind: 'snapshot'; snapshotId: string; createdAt: string }
}

const WRITE_TOOLS = new Set<McpToolName>([
  'chromie_create_account',
  'chromie_update_account',
  'chromie_save_holder',
  'chromie_create_asset_account',
  'chromie_update_asset_account',
  'chromie_save_position',
  'chromie_save_position_group',
  'chromie_set_group_members',
  'chromie_create_snapshot'
])

const SYNC_TOOLS = new Set<McpToolName>([
  'chromie_sync_asset_account',
  'chromie_refresh_exchange_rates'
])

function success(summary: string, data?: unknown): McpToolSuccess {
  return {
    ok: true,
    summary,
    ...(data === undefined ? {} : { data })
  }
}

function requireAccount(data: AppData, accountId: string): ProductAccount {
  const account = data.productAccounts.find((item) => item.id === accountId)
  if (!account) throw new McpOperationError('NOT_FOUND', '没有找到对应的账户')
  return account
}

function requireAssetAccount(
  account: ProductAccount,
  assetAccountId: string
): AssetAccount {
  const assetAccount = account.assetAccounts.find((item) => item.id === assetAccountId)
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

function safeAccount(
  account: ProductAccount,
  integrations: AssetAccountIntegration[],
  includePositions: boolean
) {
  return {
    id: account.id,
    name: account.name,
    anchor_currency: account.anchorCurrency,
    exchange_rate_provider: account.exchangeRateProvider,
    exchange_rate_refresh_interval_minutes:
      account.exchangeRateRefreshIntervalMinutes,
    holders: account.holders.map((holder) => ({ ...holder })),
    asset_accounts: account.assetAccounts.map((assetAccount) => ({
      id: assetAccount.id,
      name: assetAccount.name,
      type: assetAccount.type,
      holder_id: assetAccount.holderId,
      sync: safeIntegrationStatus(
        assetAccount,
        integrations.find((item) => item.assetAccountId === assetAccount.id)
      ),
      position_count: assetAccount.positions.length,
      ...(includePositions
        ? { positions: assetAccount.positions.map((position) => ({ ...position })) }
        : {})
    })),
    position_groups: account.positionGroups.map((group) => ({
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
  anchorCurrency: string,
  exchangeRates: ExchangeRateSnapshot | null
) {
  const valuation = valuePositions(
    [position],
    anchorCurrency,
    exchangeRates?.rates
  )
  const item = valuation.byPositionId.get(position.id)
  return {
    ...(item?.marketValue === undefined ? {} : { market_value: item.marketValue }),
    ...(item?.anchoredMarketValue === undefined
      ? {}
      : { anchored_market_value: item.anchoredMarketValue }),
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

  exportActiveAccount(): Promise<string> {
    return this.portfolio.exportActiveAccount()
  }

  subscribe(listener: PortfolioChangeListener): () => void {
    return this.portfolio.subscribe(listener)
  }

  async callMcpTool(
    name: McpToolName,
    rawArguments: unknown,
    access: McpAccessSettings = DEFAULT_MCP_ACCESS_SETTINGS,
    confirmed = false
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
        case 'chromie_list_accounts':
          return await this.listAccounts(listAccountsInputSchema.parse(parsed.data))
        case 'chromie_get_account':
          return await this.getAccount(getAccountInputSchema.parse(parsed.data))
        case 'chromie_get_overview':
          return await this.getOverview(getOverviewInputSchema.parse(parsed.data))
        case 'chromie_find_positions':
          return await this.findPositions(findPositionsInputSchema.parse(parsed.data))
        case 'chromie_list_snapshots':
          return await this.listSnapshots(listSnapshotsInputSchema.parse(parsed.data))
        case 'chromie_create_account':
          return await this.createAccount(createAccountInputSchema.parse(parsed.data))
        case 'chromie_update_account':
          return await this.updateAccount(updateAccountInputSchema.parse(parsed.data))
        case 'chromie_save_holder':
          return await this.saveHolder(saveHolderInputSchema.parse(parsed.data))
        case 'chromie_create_asset_account':
          return await this.createAssetAccount(
            createAssetAccountInputSchema.parse(parsed.data)
          )
        case 'chromie_update_asset_account':
          return await this.updateAssetAccount(
            updateAssetAccountInputSchema.parse(parsed.data)
          )
        case 'chromie_save_position':
          return await this.savePosition(savePositionInputSchema.parse(parsed.data))
        case 'chromie_save_position_group':
          return await this.savePositionGroup(
            savePositionGroupInputSchema.parse(parsed.data)
          )
        case 'chromie_set_group_members':
          return await this.setGroupMembers(setGroupMembersInputSchema.parse(parsed.data))
        case 'chromie_create_snapshot':
          return await this.createSnapshot(createSnapshotInputSchema.parse(parsed.data))
        case 'chromie_sync_asset_account':
          return await this.syncForMcp(syncAssetAccountInputSchema.parse(parsed.data))
        case 'chromie_refresh_exchange_rates':
          return await this.refreshExchangeRates(
            refreshExchangeRatesInputSchema.parse(parsed.data)
          )
        case 'chromie_delete_item':
          if (!confirmed) {
            throw new McpOperationError(
              'CONFIRMATION_REQUIRED',
              '删除操作需要用户确认'
            )
          }
          return await this.deleteItem(deleteItemInputSchema.parse(parsed.data))
    }
  }

  async previewMcpDelete(
    rawArguments: unknown,
    access: McpAccessSettings = DEFAULT_MCP_ACCESS_SETTINGS
  ): Promise<McpDeletePreview> {
    this.assertAccess('chromie_delete_item', access)
    const input = deleteItemInputSchema.safeParse(rawArguments)
    if (!input.success) {
      throw new McpOperationError(
        'VALIDATION_ERROR',
        input.error.issues.map((issue) => issue.message).join('；')
      )
    }
    const state = await this.portfolio.load()
    return this.describeDeletion(state, input.data.target)
  }

  async syncAssetAccount(
    accountId: string,
    assetAccountId: string
  ): Promise<PortfolioSyncResponse> {
    const state = await this.portfolio.load()
    const account = requireAccount(state.data, accountId)
    const assetAccount = requireAssetAccount(account, assetAccountId)
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
        productAccountId: accountId,
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
    if (name === 'chromie_delete_item') {
      if (!access.allowWrite || !access.allowDelete) {
        throw new McpOperationError('PERMISSION_DENIED', 'Chromie 未授权 MCP 删除数据')
      }
      return
    }
    if (WRITE_TOOLS.has(name) && !access.allowWrite) {
      throw new McpOperationError('PERMISSION_DENIED', 'Chromie MCP 当前为只读模式')
    }
    if (SYNC_TOOLS.has(name) && (!access.allowWrite || !access.allowSync)) {
      throw new McpOperationError('PERMISSION_DENIED', 'Chromie 未授权 MCP 执行同步')
    }
  }

  private async resolveView(
    state: PortfolioLoadResponse,
    accountId: string,
    view: { kind: 'latest' } | { kind: 'snapshot'; snapshot_id: string } = {
      kind: 'latest'
    }
  ): Promise<AccountView> {
    const latestAccount = requireAccount(state.data, accountId)
    if (view.kind === 'snapshot') {
      const snapshot = state.data.snapshots.find(
        (item) => item.id === view.snapshot_id && item.productAccountId === accountId
      )
      if (!snapshot) throw new McpOperationError('NOT_FOUND', '没有找到对应的快照')
      return {
        account: snapshot.account,
        exchangeRates: snapshot.exchangeRates ?? null,
        view: {
          kind: 'snapshot',
          snapshotId: snapshot.id,
          createdAt: snapshot.createdAt
        }
      }
    }
    return {
      account: latestAccount,
      exchangeRates: await this.desktop.loadExchangeRates(),
      view: { kind: 'latest' }
    }
  }

  private async listAccounts(
    _input: McpToolArguments['chromie_list_accounts']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const exchangeRates = await this.desktop.loadExchangeRates()
    const accounts = state.data.productAccounts.map((account) => {
      const positions = account.assetAccounts.flatMap((item) => item.positions)
      const valuation = valuePositions(
        positions,
        account.anchorCurrency,
        exchangeRates?.rates
      )
      return {
        id: account.id,
        name: account.name,
        anchor_currency: account.anchorCurrency,
        holder_count: account.holders.length,
        asset_account_count: account.assetAccounts.length,
        position_group_count: account.positionGroups.length,
        position_count: positions.length,
        snapshot_count: state.data.snapshots.filter(
          (snapshot) => snapshot.productAccountId === account.id
        ).length,
        ...(valuation.totalAnchoredMarketValue === undefined
          ? {}
          : { total_anchored_market_value: valuation.totalAnchoredMarketValue }),
        missing_currencies: valuation.missingCurrencies
      }
    })
    return success(`找到 ${accounts.length} 个账户`, {
      active_account_id: state.data.activeProductAccountId,
      exchange_rates: exchangeRates,
      accounts
    })
  }

  private async getAccount(
    input: McpToolArguments['chromie_get_account']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const resolved = await this.resolveView(state, input.account_id, input.view)
    return success(`已读取账户“${resolved.account.name}”`, {
      view: resolved.view,
      exchange_rates: resolved.exchangeRates,
      account: safeAccount(
        resolved.account,
        resolved.view.kind === 'latest' ? state.integrations : [],
        input.include_positions
      )
    })
  }

  private async getOverview(
    input: McpToolArguments['chromie_get_overview']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const resolved = await this.resolveView(state, input.account_id, input.view)
    const { account, exchangeRates } = resolved
    const allPositions = account.assetAccounts.flatMap((item) => item.positions)
    const total = valuePositions(allPositions, account.anchorCurrency, exchangeRates?.rates)
    const positionById = new Map(allPositions.map((position) => [position.id, position]))
    let rawRows: Array<{
      id: string
      name: string
      positions: Position[]
      originalCurrency?: string
    }>

    if (input.group_by === 'asset_account') {
      rawRows = account.assetAccounts.map((item) => ({
        id: item.id,
        name: item.name,
        positions: item.positions
      }))
    } else if (input.group_by === 'position_group') {
      rawRows = account.positionGroups.map((group) => ({
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
        account.anchorCurrency,
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
        ...(valuation.totalAnchoredMarketValue === undefined
          ? {}
          : {
              anchored_market_value: valuation.totalAnchoredMarketValue,
              ...(total.isComplete &&
              valuation.isComplete &&
              total.totalAnchoredMarketValue
                ? {
                    allocation_percent:
                      valuation.totalAnchoredMarketValue /
                      total.totalAnchoredMarketValue *
                      100
                  }
                : {})
            }),
        missing_currencies: valuation.missingCurrencies
      }
    })
    rows.sort(
      (left, right) =>
        (right.anchored_market_value ?? Number.NEGATIVE_INFINITY) -
        (left.anchored_market_value ?? Number.NEGATIVE_INFINITY)
    )

    return success(`已生成“${account.name}”资产透视`, {
      view: resolved.view,
      group_by: input.group_by,
      anchor_currency: account.anchorCurrency,
      exchange_rates: exchangeRates,
      total: {
        position_count: allPositions.length,
        ...(total.totalAnchoredMarketValue === undefined
          ? {}
          : { anchored_market_value: total.totalAnchoredMarketValue }),
        missing_currencies: total.missingCurrencies,
        complete: total.isComplete
      },
      rows
    })
  }

  private async findPositions(
    input: McpToolArguments['chromie_find_positions']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const resolved = await this.resolveView(state, input.account_id, input.view)
    const account = resolved.account
    const holderById = new Map(account.holders.map((holder) => [holder.id, holder]))
    const groupsByPositionId = new Map(
      account.positionGroups.flatMap((group) =>
        group.positionIds.map((positionId) => [positionId, group] as const)
      )
    )
    const normalizedQuery = input.query?.toLocaleLowerCase()
    const rows = account.assetAccounts.flatMap((assetAccount) => {
      if (input.asset_account_id && input.asset_account_id !== assetAccount.id) return []
      if (input.holder_id && input.holder_id !== assetAccount.holderId) return []
      return assetAccount.positions.flatMap((position) => {
        const group = groupsByPositionId.get(position.id)
        if (input.group_id && group?.id !== input.group_id) return []
        if (input.market && position.market !== input.market) return []
        if (input.currency && position.currency !== input.currency) return []
        if (
          normalizedQuery &&
          !position.symbol.toLocaleLowerCase().includes(normalizedQuery) &&
          !position.name.toLocaleLowerCase().includes(normalizedQuery) &&
          !assetAccount.name.toLocaleLowerCase().includes(normalizedQuery)
        ) return []
        return [{
          ...position,
          asset_account: { id: assetAccount.id, name: assetAccount.name },
          holder: holderById.get(assetAccount.holderId) ?? null,
          group: group ? { id: group.id, name: group.name } : null,
          valuation: positionValue(
            position,
            account.anchorCurrency,
            resolved.exchangeRates
          )
        }]
      })
    })
    const offset = Number(input.cursor ?? '0')
    const page = rows.slice(offset, offset + input.limit)
    const nextOffset = offset + page.length
    return success(`找到 ${rows.length} 项持仓`, {
      view: resolved.view,
      total: rows.length,
      positions: page,
      ...(nextOffset < rows.length ? { next_cursor: String(nextOffset) } : {})
    })
  }

  private async listSnapshots(
    input: McpToolArguments['chromie_list_snapshots']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const account = requireAccount(state.data, input.account_id)
    const snapshots = state.data.snapshots
      .filter((snapshot) => snapshot.productAccountId === account.id)
      .map((snapshot) => ({
        id: snapshot.id,
        created_at: snapshot.createdAt,
        asset_account_count: snapshot.account.assetAccounts.length,
        position_group_count: snapshot.account.positionGroups.length,
        position_count: snapshot.account.assetAccounts.reduce(
          (count, item) => count + item.positions.length,
          0
        ),
        exchange_rates_fetched_at: snapshot.exchangeRates?.fetchedAt ?? null
      }))
    return success(`找到 ${snapshots.length} 个历史快照`, {
      account: { id: account.id, name: account.name },
      snapshots
    })
  }

  private async createAccount(
    input: McpToolArguments['chromie_create_account']
  ): Promise<McpToolSuccess> {
    const response = await this.portfolio.execute({
      type: 'create-product-account',
      input: { name: input.name, anchorCurrency: input.anchor_currency }
    })
    return success(`已创建账户“${input.name}”`, {
      account_id: response.result
    })
  }

  private async updateAccount(
    input: McpToolArguments['chromie_update_account']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const account = requireAccount(state.data, input.account_id)
    const settings: ProductAccountSettingsInput = {
      name: input.name ?? account.name,
      anchorCurrency: input.anchor_currency ?? account.anchorCurrency,
      exchangeRateProvider:
        input.exchange_rate_provider ?? account.exchangeRateProvider,
      exchangeRateRefreshIntervalMinutes:
        input.exchange_rate_refresh_interval_minutes ??
        account.exchangeRateRefreshIntervalMinutes,
      holders: account.holders
    }
    await this.portfolio.execute({
      type: 'update-product-account',
      id: account.id,
      input: settings
    })
    return success(`已更新账户“${settings.name}”`, {
      account_id: account.id
    })
  }

  private async saveHolder(
    input: McpToolArguments['chromie_save_holder']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const account = requireAccount(state.data, input.account_id)
    const existing = input.mode === 'update'
      ? account.holders.find((holder) => holder.id === input.holder_id)
      : undefined
    if (input.mode === 'update' && !existing) {
      throw new McpOperationError('NOT_FOUND', '没有找到对应的持有人')
    }
    if (
      account.holders.some(
        (holder) =>
          holder.id !== existing?.id &&
          holder.name.trim().toLocaleLowerCase() ===
            input.name.trim().toLocaleLowerCase()
      )
    ) {
      throw new McpOperationError('VALIDATION_ERROR', '持有人名称不能重复')
    }
    const holder = existing
      ? { ...existing, name: input.name }
      : { id: crypto.randomUUID(), name: input.name }
    const holders = existing
      ? account.holders.map((item) => item.id === holder.id ? holder : item)
      : [...account.holders, holder]
    await this.portfolio.execute({
      type: 'update-product-account',
      id: account.id,
      input: {
        name: account.name,
        anchorCurrency: account.anchorCurrency,
        exchangeRateProvider: account.exchangeRateProvider,
        exchangeRateRefreshIntervalMinutes:
          account.exchangeRateRefreshIntervalMinutes,
        holders
      }
    })
    return success(
      existing ? `已更新持有人“${holder.name}”` : `已创建持有人“${holder.name}”`,
      { holder }
    )
  }

  private async createAssetAccount(
    input: McpToolArguments['chromie_create_asset_account']
  ): Promise<McpToolSuccess> {
    const response = await this.portfolio.execute({
      type: 'create-asset-account',
      productAccountId: input.account_id,
      input: {
        name: input.name,
        type: input.type,
        holderId: input.holder_id
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
    const account = requireAccount(state.data, input.account_id)
    const assetAccount = requireAssetAccount(account, input.asset_account_id)
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
      productAccountId: account.id,
      assetAccountId: assetAccount.id,
      input: {
        name: input.name ?? assetAccount.name,
        type: nextType,
        holderId: input.holder_id ?? assetAccount.holderId,
        sync: assetAccount.sync,
        ...(integration ? { integration: integrationInput(integration) } : {})
      }
    })
    return success(`已更新资产账户“${input.name ?? assetAccount.name}”`, {
      asset_account_id: assetAccount.id
    })
  }

  private async savePosition(
    input: McpToolArguments['chromie_save_position']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const account = requireAccount(state.data, input.account_id)
    const assetAccount = requireAssetAccount(account, input.asset_account_id)
    if (assetAccount.sync) {
      throw new McpOperationError('READ_ONLY', '自动同步账户不能手动修改持仓')
    }
    const existing = input.mode === 'update'
      ? assetAccount.positions.find((position) => position.id === input.position_id)
      : undefined
    if (input.mode === 'update' && !existing) {
      throw new McpOperationError('NOT_FOUND', '没有找到对应的持仓')
    }
    const positionInput = {
      market: input.market ?? existing!.market,
      symbol: input.symbol ?? existing!.symbol,
      name: input.name ?? existing!.name,
      currency: input.currency ?? existing!.currency,
      quantity: input.quantity ?? existing!.quantity,
      ...(
        input.price === null
          ? {}
          : input.price !== undefined
            ? { price: input.price }
            : existing?.price === undefined
              ? {}
              : { price: existing.price }
      )
    }
    const response = await this.portfolio.execute({
      type: 'save-position',
      productAccountId: account.id,
      assetAccountId: assetAccount.id,
      input: positionInput,
      ...(existing ? { positionId: existing.id } : {})
    })
    assertCommandResult(response)
    const stored = response.data.productAccounts
      .find((item) => item.id === account.id)
      ?.assetAccounts.find((item) => item.id === assetAccount.id)
      ?.positions.find((position) =>
        existing
          ? position.id === existing.id
          : position.market === positionInput.market &&
            position.symbol === positionInput.symbol.trim().toUpperCase()
      )
    return success(
      existing ? `已更新持仓 ${positionInput.symbol}` : `已创建持仓 ${positionInput.symbol}`,
      { position: stored }
    )
  }

  private async savePositionGroup(
    input: McpToolArguments['chromie_save_position_group']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const account = requireAccount(state.data, input.account_id)
    if (
      input.mode === 'update' &&
      !account.positionGroups.some((group) => group.id === input.group_id)
    ) {
      throw new McpOperationError('NOT_FOUND', '没有找到对应的持仓分组')
    }
    const response = await this.portfolio.execute(
      input.mode === 'create'
        ? {
            type: 'create-position-group',
            productAccountId: input.account_id,
            input: { name: input.name }
          }
        : {
            type: 'update-position-group',
            productAccountId: input.account_id,
            groupId: input.group_id,
            input: { name: input.name }
          }
    )
    return success(
      input.mode === 'create'
        ? `已创建持仓分组“${input.name}”`
        : `已更新持仓分组“${input.name}”`,
      { group_id: input.mode === 'create' ? response.result : input.group_id }
    )
  }

  private async setGroupMembers(
    input: McpToolArguments['chromie_set_group_members']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const account = requireAccount(state.data, input.account_id)
    if (!account.positionGroups.some((group) => group.id === input.group_id)) {
      throw new McpOperationError('NOT_FOUND', '没有找到对应的持仓分组')
    }
    const response = await this.portfolio.execute({
      type: 'set-position-group-positions',
      productAccountId: input.account_id,
      groupId: input.group_id,
      positionIds: input.position_ids
    })
    assertCommandResult(response)
    return success(`持仓分组现包含 ${input.position_ids.length} 项持仓`, {
      group_id: input.group_id,
      position_ids: input.position_ids
    })
  }

  private async createSnapshot(
    input: McpToolArguments['chromie_create_snapshot']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    requireAccount(state.data, input.account_id)
    const exchangeRates = await this.desktop.loadExchangeRates()
    const response = await this.portfolio.execute({
      type: 'create-snapshot',
      productAccountId: input.account_id,
      exchangeRates
    })
    if (!response.result) {
      throw new McpOperationError('NOT_FOUND', '没有找到对应的账户')
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
      input.account_id,
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
    const provider = input.account_id
      ? requireAccount(state.data, input.account_id).exchangeRateProvider
      : DEFAULT_EXCHANGE_RATE_PROVIDER
    const snapshot = await this.desktop.fetchExchangeRates(provider)
    return success(`已刷新 ${snapshot.provider} 汇率`, {
      exchange_rates: snapshot
    })
  }

  private async deleteItem(
    input: McpToolArguments['chromie_delete_item']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const target = input.target
    const account = requireAccount(state.data, target.account_id)
    let command: PortfolioCommand

    if (target.kind === 'account') {
      command = { type: 'delete-product-account', id: account.id }
    } else if (target.kind === 'holder') {
      const holder = account.holders.find((item) => item.id === target.holder_id)
      if (!holder) throw new McpOperationError('NOT_FOUND', '没有找到对应的持有人')
      if (account.assetAccounts.some((item) => item.holderId === holder.id)) {
        throw new McpOperationError(
          'VALIDATION_ERROR',
          '请先为该持有人名下的资产账户重新指定持有人'
        )
      }
      command = {
        type: 'update-product-account',
        id: account.id,
        input: {
          name: account.name,
          anchorCurrency: account.anchorCurrency,
          exchangeRateProvider: account.exchangeRateProvider,
          exchangeRateRefreshIntervalMinutes:
            account.exchangeRateRefreshIntervalMinutes,
          holders: account.holders.filter((item) => item.id !== holder.id)
        }
      }
    } else if (target.kind === 'asset_account') {
      requireAssetAccount(account, target.asset_account_id)
      command = {
        type: 'delete-asset-account',
        productAccountId: account.id,
        assetAccountId: target.asset_account_id
      }
    } else if (target.kind === 'position') {
      const assetAccount = requireAssetAccount(account, target.asset_account_id)
      if (!assetAccount.positions.some((item) => item.id === target.position_id)) {
        throw new McpOperationError('NOT_FOUND', '没有找到对应的持仓')
      }
      if (assetAccount.sync) {
        throw new McpOperationError('READ_ONLY', '自动同步账户不能手动删除持仓')
      }
      command = {
        type: 'delete-position',
        productAccountId: account.id,
        assetAccountId: assetAccount.id,
        positionId: target.position_id
      }
    } else if (target.kind === 'position_group') {
      if (!account.positionGroups.some((item) => item.id === target.group_id)) {
        throw new McpOperationError('NOT_FOUND', '没有找到对应的持仓分组')
      }
      command = {
        type: 'delete-position-group',
        productAccountId: account.id,
        groupId: target.group_id
      }
    } else {
      const snapshot = state.data.snapshots.find(
        (item) => item.id === target.snapshot_id && item.productAccountId === account.id
      )
      if (!snapshot) throw new McpOperationError('NOT_FOUND', '没有找到对应的快照')
      command = { type: 'delete-snapshot', snapshotId: snapshot.id }
    }

    const preview = this.describeDeletion(state, target)
    await this.portfolio.execute(command)
    return success(preview.title, { target })
  }

  private describeDeletion(
    state: PortfolioLoadResponse,
    target: McpDeleteTarget
  ): McpDeletePreview {
    const account = requireAccount(state.data, target.account_id)
    if (target.kind === 'account') {
      const positionCount = account.assetAccounts.reduce(
        (count, item) => count + item.positions.length,
        0
      )
      const snapshotCount = state.data.snapshots.filter(
        (item) => item.productAccountId === account.id
      ).length
      return {
        title: `删除账户“${account.name}”`,
        description: `将同时删除 ${account.holders.length} 个持有人、${account.assetAccounts.length} 个资产账户、${account.positionGroups.length} 个持仓分组、${positionCount} 项持仓和 ${snapshotCount} 个历史快照。此操作无法撤销。`
      }
    }
    if (target.kind === 'holder') {
      const holder = account.holders.find((item) => item.id === target.holder_id)
      if (!holder) throw new McpOperationError('NOT_FOUND', '没有找到对应的持有人')
      const assetAccountCount = account.assetAccounts.filter(
        (item) => item.holderId === holder.id
      ).length
      return {
        title: `删除持有人“${holder.name}”`,
        description: assetAccountCount
          ? `该持有人仍有 ${assetAccountCount} 个资产账户，当前无法删除。`
          : '将删除这个持有人。此操作无法撤销。'
      }
    }
    if (target.kind === 'asset_account') {
      const assetAccount = requireAssetAccount(account, target.asset_account_id)
      const membershipCount = account.positionGroups.reduce(
        (count, group) =>
          count + group.positionIds.filter((id) =>
            assetAccount.positions.some((position) => position.id === id)
          ).length,
        0
      )
      return {
        title: `删除资产账户“${assetAccount.name}”`,
        description: `将同时删除 ${assetAccount.positions.length} 项持仓和 ${membershipCount} 个分组引用，并移除同步配置。此操作无法撤销。`
      }
    }
    if (target.kind === 'position') {
      const assetAccount = requireAssetAccount(account, target.asset_account_id)
      const position = assetAccount.positions.find(
        (item) => item.id === target.position_id
      )
      if (!position) throw new McpOperationError('NOT_FOUND', '没有找到对应的持仓')
      const group = account.positionGroups.find((item) =>
        item.positionIds.includes(position.id)
      )
      return {
        title: `删除持仓 ${position.symbol}`,
        description: `将从“${assetAccount.name}”移除${group ? `，并退出分组“${group.name}”` : ''}。此操作无法撤销。`
      }
    }
    if (target.kind === 'position_group') {
      const group = account.positionGroups.find((item) => item.id === target.group_id)
      if (!group) throw new McpOperationError('NOT_FOUND', '没有找到对应的持仓分组')
      return {
        title: `删除持仓分组“${group.name}”`,
        description: `只会删除分组及其 ${group.positionIds.length} 个引用，不会删除原持仓。此操作无法撤销。`
      }
    }
    const snapshot = state.data.snapshots.find(
      (item) => item.id === target.snapshot_id && item.productAccountId === account.id
    )
    if (!snapshot) throw new McpOperationError('NOT_FOUND', '没有找到对应的快照')
    return {
      title: `删除 ${snapshot.createdAt} 的历史快照`,
      description: '只会删除这个历史版本，最新版资产不会受到影响。此操作无法撤销。'
    }
  }
}
