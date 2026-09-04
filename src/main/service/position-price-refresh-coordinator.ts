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

const MAX_CONCURRENT_PRICE_LOOKUPS = 4

type PriceRefreshTarget = {
  accountId: string
  positionId: string
  provider: AssetQuoteProvider
  expected: Pick<Position, 'market' | 'symbol' | 'currency' | 'price'>
}

type PriceLookupOutcome =
  | { status: 'found'; price: number; currency?: string }
  | { status: 'not-found' }
  | { status: 'unavailable' }

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
    private readonly desktop: Pick<DesktopOperations, 'lookupAssetQuote'>
  ) {}

  refreshPositionPrices(
    workspaceId: string,
    accountId?: string
  ): Promise<PortfolioPriceRefreshResponse> {
    const key = `${workspaceId}\u0000${accountId ?? '*'}`
    const existing = this.refreshingScopes.get(key)
    if (existing) return existing

    const pending = this.performRefresh(workspaceId, accountId).finally(() => {
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
            positionId: position.id,
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
        return
      }
      if (outcome.status === 'not-found') {
        notFoundCount += 1
        return
      }
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
    if (!lookup) return { status: 'unavailable' }

    const input: AssetQuoteLookupInput = {
      market: target.expected.market,
      symbol: target.expected.symbol,
      provider: target.provider
    }
    try {
      const result = await lookup(input)
      if (result.status !== 'found') return result
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
        return { status: 'unavailable' }
      }
      return {
        status: 'found',
        price: quote.price,
        ...(currency ? { currency } : {})
      }
    } catch {
      return { status: 'unavailable' }
    }
  }
}
