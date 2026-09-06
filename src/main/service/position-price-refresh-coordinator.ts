import {
  resolveAssetQuoteProvider,
  type AssetQuoteLookupInput,
  type AssetQuoteProvider
} from '../../shared/asset-quotes'
import {
  type Account,
  type AppData,
  type PortfolioPriceRefreshResponse,
  type Position,
  type Workspace
} from '../../shared/portfolio'
import type { DesktopOperations } from './desktop-service'
import { McpOperationError } from './mcp-operation-error'
import { isCurrencyCode } from './portfolio-data'
import type {
  PortfolioOperations,
  PositionPriceUpdate
} from './portfolio-service'
import {
  diagnosticErrorMessage,
  type SyncDiagnosticLogger
} from './sync-diagnostics'

const MAX_CONCURRENT_PRICE_LOOKUPS = 4

type PriceRefreshTarget = {
  accountId: string
  accountName: string
  positionId: string
  positionName: string
  provider: AssetQuoteProvider
  expected: Pick<Position, 'market' | 'symbol' | 'currency' | 'price'>
}

type PriceLookupOutcome =
  | { status: 'found'; price: number; currency?: string }
  | { status: 'not-found' }
  | { status: 'unavailable'; reason: string }

function requireWorkspace(data: AppData, workspaceId: string): Workspace {
  const workspace = data.workspaces.find((item) => item.id === workspaceId)
  if (!workspace) throw new McpOperationError('NOT_FOUND', '没有找到对应的工作区')
  return workspace
}

function requireAccount(workspace: Workspace, accountId: string): Account {
  const account = workspace.accounts.find((item) => item.id === accountId)
  if (!account) throw new McpOperationError('NOT_FOUND', '没有找到对应的账户')
  return account
}

function priceLookupKey(target: PriceRefreshTarget): string {
  return JSON.stringify([
    target.provider,
    target.expected.market,
    target.expected.symbol
  ])
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  operation: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await operation(items[index])
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length) },
      () => worker()
    )
  )
  return results
}

export class PositionPriceRefreshCoordinator {
  private readonly refreshingScopes = new Map<
    string,
    Promise<PortfolioPriceRefreshResponse>
  >()

  constructor(
    private readonly portfolio: PortfolioOperations,
    private readonly desktop: Pick<DesktopOperations, 'lookupAssetQuote'>,
    private readonly diagnostics?: SyncDiagnosticLogger
  ) {}

  refreshPositionPrices(
    workspaceId: string,
    accountId?: string
  ): Promise<PortfolioPriceRefreshResponse> {
    const key = `${workspaceId}\u0000${accountId ?? '*'}`
    const existing = this.refreshingScopes.get(key)
    if (existing) {
      this.diagnostics?.('info', 'price-refresh.coalesced', {
        workspaceId,
        accountId: accountId ?? null
      })
      return existing
    }

    const startedAt = Date.now()
    this.diagnostics?.('info', 'price-refresh.started', {
      workspaceId,
      accountId: accountId ?? null
    })
    const pending = this.performRefresh(workspaceId, accountId)
      .then((result) => {
        this.diagnostics?.('info', 'price-refresh.completed', {
          workspaceId,
          accountId: accountId ?? null,
          positionCount: result.positionCount,
          refreshedCount: result.refreshedCount,
          notFoundCount: result.notFoundCount,
          unavailableCount: result.unavailableCount,
          conflictCount: result.conflictCount,
          durationMs: Date.now() - startedAt
        })
        return result
      })
      .catch((error: unknown) => {
        this.diagnostics?.('error', 'price-refresh.failed', {
          workspaceId,
          accountId: accountId ?? null,
          error: diagnosticErrorMessage(error),
          durationMs: Date.now() - startedAt
        })
        throw error
      })
      .finally(() => {
        if (this.refreshingScopes.get(key) === pending) {
          this.refreshingScopes.delete(key)
        }
      })
    this.refreshingScopes.set(key, pending)
    return pending
  }

  private async performRefresh(
    workspaceId: string,
    accountId?: string
  ): Promise<PortfolioPriceRefreshResponse> {
    const state = await this.portfolio.load()
    const workspace = requireWorkspace(state.data, workspaceId)
    const accounts = accountId
      ? [requireAccount(workspace, accountId)]
      : workspace.accounts
    const targets = accounts.flatMap((account): PriceRefreshTarget[] =>
      account.sync
        ? []
        : account.positions.map((position) => ({
            accountId: account.id,
            accountName: account.name,
            positionId: position.id,
            positionName: position.name,
            provider: resolveAssetQuoteProvider(
              position.market,
              workspace.stockQuoteProvider,
              workspace.cryptoQuoteProvider
            ),
            expected: {
              market: position.market,
              symbol: position.symbol,
              currency: position.currency,
              price: position.price
            }
          }))
    )

    const uniqueTargets = [
      ...new Map(targets.map((target) => [priceLookupKey(target), target])).values()
    ]
    this.diagnostics?.('info', 'price-refresh.targets-resolved', {
      workspaceId,
      accountId: accountId ?? null,
      accountCount: accounts.length,
      positionCount: targets.length,
      uniqueQuoteCount: uniqueTargets.length
    })
    const outcomes = await mapWithConcurrency(
      uniqueTargets,
      MAX_CONCURRENT_PRICE_LOOKUPS,
      (target) => this.lookupPrice(target)
    )
    const outcomesByKey = new Map(
      uniqueTargets.map((target, index) => [priceLookupKey(target), outcomes[index]])
    )

    let notFoundCount = 0
    let unavailableCount = 0
    const updates: PositionPriceUpdate[] = []
    targets.forEach((target) => {
      const outcome = outcomesByKey.get(priceLookupKey(target))
      if (!outcome || outcome.status === 'unavailable') {
        unavailableCount += 1
        this.diagnostics?.('warn', 'price-refresh.position-unavailable', {
          ...this.targetDiagnosticDetails(target),
          reason: outcome?.status === 'unavailable'
            ? outcome.reason
            : 'lookup-result-missing'
        })
        return
      }
      if (outcome.status === 'not-found') {
        notFoundCount += 1
        this.diagnostics?.('warn', 'price-refresh.position-not-found',
          this.targetDiagnosticDetails(target)
        )
        return
      }
      this.diagnostics?.('info', 'price-refresh.position-ready', {
        ...this.targetDiagnosticDetails(target),
        nextPrice: outcome.price,
        nextCurrency: outcome.currency ?? target.expected.currency
      })
      updates.push({
        accountId: target.accountId,
        positionId: target.positionId,
        provider: target.provider,
        expected: target.expected,
        price: outcome.price,
        currency: outcome.currency ?? target.expected.currency
      })
    })

    const committed = await this.portfolio.applyManualPositionPriceUpdates(
      workspaceId,
      updates
    )
    if (committed.conflictCount > 0) {
      this.diagnostics?.('warn', 'price-refresh.commit-conflict', {
        workspaceId,
        accountId: accountId ?? null,
        attemptedUpdateCount: updates.length,
        conflictCount: committed.conflictCount
      })
    }
    return {
      positionCount: targets.length,
      refreshedCount: committed.appliedCount,
      notFoundCount,
      unavailableCount,
      conflictCount: committed.conflictCount,
      completedAt: new Date().toISOString()
    }
  }

  private async lookupPrice(
    target: PriceRefreshTarget
  ): Promise<PriceLookupOutcome> {
    const lookup = this.desktop.lookupAssetQuote
    if (!lookup) {
      return { status: 'unavailable', reason: 'quote-adapter-not-configured' }
    }

    const input: AssetQuoteLookupInput = {
      market: target.expected.market,
      symbol: target.expected.symbol,
      provider: target.provider
    }
    try {
      const result = await lookup.call(this.desktop, input)
      if (result.status === 'not-found') return result
      if (result.status === 'unavailable') {
        return { status: 'unavailable', reason: 'quote-provider-unavailable' }
      }
      const { quote } = result
      const currency = quote.currency?.trim().toUpperCase()
      if (
        quote.source !== input.provider ||
        quote.market !== input.market ||
        quote.symbol.trim().toUpperCase() !== input.symbol ||
        quote.price === undefined ||
        !Number.isFinite(quote.price) ||
        quote.price < 0 ||
        (currency !== undefined && !isCurrencyCode(currency))
      ) {
        return { status: 'unavailable', reason: 'invalid-quote-response' }
      }
      return {
        status: 'found',
        price: quote.price,
        ...(currency ? { currency } : {})
      }
    } catch (error) {
      return {
        status: 'unavailable',
        reason: `lookup-threw: ${diagnosticErrorMessage(error)}`
      }
    }
  }

  private targetDiagnosticDetails(
    target: PriceRefreshTarget
  ): Readonly<Record<string, unknown>> {
    return {
      accountId: target.accountId,
      accountName: target.accountName,
      positionId: target.positionId,
      positionName: target.positionName,
      market: target.expected.market,
      symbol: target.expected.symbol,
      provider: target.provider,
      currentPrice: target.expected.price,
      currentCurrency: target.expected.currency
    }
  }
}
