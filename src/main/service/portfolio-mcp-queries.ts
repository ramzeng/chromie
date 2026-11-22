import { type ExchangeRateSnapshot } from '../../shared/exchange-rates'
import { type McpToolArguments, type McpToolSuccess } from '../../shared/mcp'
import { type PortfolioLoadResponse, type Position, type Workspace } from '../../shared/portfolio'
import {
  comparePortfolios,
  comparisonReasons,
  describeComparison,
  type ComparisonEffects
} from '../../shared/portfolio-comparison'
import { valuePositions } from '../../shared/valuation'
import type { DesktopOperations } from './desktop-service'
import { type PortfolioOperations } from './portfolio-service'

import { McpOperationError } from './mcp-operation-error'
import {
  decodePositionCursor,
  encodePositionCursor,
  mcpExchangeRates,
  positionCursorScope,
  positionValue,
  requireWorkspace,
  safeWorkspace,
  success
} from './portfolio-mcp-helpers'

type WorkspaceView = {
  workspace: Workspace
  exchangeRates: ExchangeRateSnapshot | null
  view:
    | {
        kind: 'latest'
      }
    | {
        kind: 'snapshot'
        snapshot_id: string
        created_at: string
      }
}

export class PortfolioMcpQueries {
  constructor(
    private readonly portfolio: PortfolioOperations,
    private readonly desktop: DesktopOperations
  ) {}

  async resolveView(
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

  async listWorkspaces(
    _input: McpToolArguments['chromie_list_workspaces']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const exchangeRates = await this.desktop.loadExchangeRates()
    const workspaces = state.data.workspaces.map((workspace) => {
      const positions = workspace.accounts.flatMap((item) => item.positions)
      const valuation = valuePositions(positions, workspace.baseCurrency, exchangeRates?.rates)
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
          : {
              total_converted_market_value: valuation.totalConvertedMarketValue
            }),
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

  async getWorkspace(input: McpToolArguments['chromie_get_workspace']): Promise<McpToolSuccess> {
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

  async getPortfolioOverview(
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
          account.positions.filter(
            (position) => account.tagIds.includes(tag.id) || position.tagIds.includes(tag.id)
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
      const valuation = valuePositions(row.positions, workspace.baseCurrency, exchangeRates?.rates)
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
              ...(total.isComplete && valuation.isComplete && total.totalConvertedMarketValue
                ? {
                    allocation_percent:
                      (valuation.totalConvertedMarketValue / total.totalConvertedMarketValue) * 100
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

  async listPositions(input: McpToolArguments['chromie_list_positions']): Promise<McpToolSuccess> {
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
        )
          return []
        return [
          {
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
              valuation: positionValue(position, workspace.baseCurrency, resolved.exchangeRates)
            }
          }
        ]
      })
    })
    rows.sort((left, right) =>
      left.cursorKey < right.cursorKey ? -1 : left.cursorKey > right.cursorKey ? 1 : 0
    )
    const scope = positionCursorScope(input)
    const after = input.cursor ? decodePositionCursor(input.cursor, scope) : null
    const remaining = after ? rows.filter((row) => row.cursorKey > after) : rows
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

  async listSnapshots(input: McpToolArguments['chromie_list_snapshots']): Promise<McpToolSuccess> {
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

  async compareSnapshots(
    input: McpToolArguments['chromie_compare_snapshots']
  ): Promise<McpToolSuccess> {
    const state = await this.portfolio.load()
    const workspace = requireWorkspace(state.data, input.workspace_id)
    const from = await this.resolveView(state, workspace.id, input.from)
    const to = await this.resolveView(state, workspace.id, input.to)
    const comparison = comparePortfolios(
      { workspace: from.workspace, rates: from.exchangeRates?.rates },
      { workspace: to.workspace, rates: to.exchangeRates?.rates },
      workspace.baseCurrency
    )
    const insights = describeComparison(comparison)
    const effects = (value: ComparisonEffects) => ({
      price: value.price,
      exchange_rate: value.exchangeRate,
      bought: value.bought,
      sold: value.sold
    })
    return success(`${insights.headline}，${insights.summary}`, {
      from: from.view,
      to: to.view,
      base_currency: workspace.baseCurrency,
      direction: comparison.direction,
      headline: insights.headline,
      summary: insights.summary,
      ...(insights.tradeSummary ? { trade_summary: insights.tradeSummary } : {}),
      reasons: comparisonReasons(insights, comparison.baseCurrency),
      notes: insights.notes,
      total: {
        from_value: comparison.fromValue,
        to_value: comparison.toValue,
        change: comparison.change,
        ...(comparison.changePercent === undefined
          ? {}
          : { change_percent: comparison.changePercent }),
        market_change: comparison.marketChange,
        ...(comparison.marketChangePercent === undefined
          ? {}
          : { market_change_percent: comparison.marketChangePercent }),
        trade_change: comparison.tradeChange,
        rebalance_amount: comparison.rebalanceAmount,
        effects: effects(comparison.effects),
        complete: comparison.isComplete,
        unavailable_count: comparison.unavailableCount
      },
      accounts: comparison.accounts.map((account) => ({
        id: account.id,
        name: account.name,
        from_value: account.fromValue,
        to_value: account.toValue,
        change: account.change,
        effects: effects(account.effects),
        position_count: account.positionCount,
        unavailable_count: account.unavailableCount
      })),
      currencies: comparison.currencies.map((currency) => ({
        currency: currency.currency,
        ...(currency.fromRate === undefined ? {} : { from_rate: currency.fromRate }),
        ...(currency.toRate === undefined ? {} : { to_rate: currency.toRate }),
        ...(currency.rateChangePercent === undefined
          ? {}
          : { rate_change_percent: currency.rateChangePercent }),
        exchange_rate_effect: currency.exchangeRateEffect
      })),
      position_total: comparison.positions.length,
      positions: comparison.positions.slice(0, input.position_limit).map((position) => ({
        account: { id: position.accountId, name: position.accountName },
        market: position.market,
        symbol: position.symbol,
        name: position.name,
        currency: position.currency,
        kind: position.kind,
        ...(position.fromQuantity === undefined ? {} : { from_quantity: position.fromQuantity }),
        ...(position.toQuantity === undefined ? {} : { to_quantity: position.toQuantity }),
        ...(position.fromPrice === undefined ? {} : { from_price: position.fromPrice }),
        ...(position.toPrice === undefined ? {} : { to_price: position.toPrice }),
        ...(position.fromValue === undefined ? {} : { from_value: position.fromValue }),
        ...(position.toValue === undefined ? {} : { to_value: position.toValue }),
        ...(position.change === undefined ? {} : { change: position.change }),
        ...(position.priceChangePercent === undefined
          ? {}
          : { price_change_percent: position.priceChangePercent }),
        ...(position.effects ? { effects: effects(position.effects) } : {}),
        ...(position.unavailableReason
          ? { unavailable_reason: position.unavailableReason }
          : {})
      }))
    })
  }
}
