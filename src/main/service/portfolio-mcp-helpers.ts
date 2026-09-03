import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'

import { type ExchangeRateSnapshot } from '../../shared/exchange-rates'
import type { AccountIntegration } from '../../shared/integrations'
import { type McpToolArguments, type McpToolSuccess } from '../../shared/mcp'
import {
  type Account,
  type AccountInput,
  type AppData,
  type Position,
  type Workspace
} from '../../shared/portfolio'
import { valuePositions } from '../../shared/valuation'

import { McpOperationError } from './mcp-operation-error'

export function success(summary: string, data: unknown): McpToolSuccess {
  return {
    ok: true,
    summary,
    data
  }
}

export function mcpExchangeRates(snapshot: ExchangeRateSnapshot | null) {
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

export function positionCursorScope(input: McpToolArguments['chromie_list_positions']): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        workspace_id: input.workspace_id,
        view: input.view ?? { kind: 'latest' },
        query: input.query?.toLocaleLowerCase() ?? null,
        market: input.market ?? null,
        currency: input.currency ?? null,
        account_id: input.account_id ?? null,
        tag_id: input.tag_id ?? null
      })
    )
    .digest('base64url')
    .slice(0, 22)
}

export function encodePositionCursor(scope: string, after: string): string {
  const cursor: PositionCursor = { version: 1, scope, after }
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

export function decodePositionCursor(value: string, scope: string): string {
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
  throw new McpOperationError('VALIDATION_ERROR', '分页游标无效或与当前查询条件不匹配')
}

export function requireWorkspace(data: AppData, workspaceId: string): Workspace {
  const workspace = data.workspaces.find((item) => item.id === workspaceId)
  if (!workspace) throw new McpOperationError('NOT_FOUND', '没有找到对应的工作区')
  return workspace
}

export function requireAccount(workspace: Workspace, accountId: string): Account {
  const account = workspace.accounts.find((item) => item.id === accountId)
  if (!account) {
    throw new McpOperationError('NOT_FOUND', '没有找到对应的账户')
  }
  return account
}

export function safeIntegrationStatus(
  account: Account,
  integration: AccountIntegration | undefined
) {
  return {
    capable:
      account.type === 'Futu' ||
      account.type === 'Okx' ||
      account.type === 'Ibkr' ||
      account.type === 'Hstong' ||
      account.type === 'Binance',
    configured: Boolean(account.sync && integration),
    ...(account.sync
      ? {
          interval_seconds: account.sync.interval,
          ...(account.sync.lastSyncedAt ? { last_synced_at: account.sync.lastSyncedAt } : {})
        }
      : {}),
    ...(integration ? { provider: integration.provider } : {})
  }
}

export function safeWorkspace(
  workspace: Workspace,
  integrations: AccountIntegration[],
  includePositions: boolean
) {
  return {
    id: workspace.id,
    name: workspace.name,
    base_currency: workspace.baseCurrency,
    exchange_rate_provider: workspace.exchangeRateProvider,
    exchange_rate_refresh_interval_minutes: workspace.exchangeRateRefreshIntervalMinutes,
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

export function safePosition(position: Position) {
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

export function integrationInput(integration: AccountIntegration): AccountInput['integration'] {
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

export function positionValue(
  position: Position,
  baseCurrency: string,
  exchangeRates: ExchangeRateSnapshot | null
) {
  const valuation = valuePositions([position], baseCurrency, exchangeRates?.rates)
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
