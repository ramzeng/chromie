import assert from 'node:assert/strict'
import test from 'node:test'

import type {
  AssetQuoteLookupInput,
  AssetQuoteLookupResult
} from '../src/shared/asset-quotes'
import type { PositionInput } from '../src/shared/portfolio'
import { portfolioPriceRefreshTargetSchema } from '../src/shared/portfolio-command'
import {
  DesktopService,
  type DesktopOperations,
  type DesktopServiceDependencies
} from '../src/main/service/desktop-service'
import {
  McpOperationError,
  PortfolioModule
} from '../src/main/service/portfolio-module'
import { PortfolioService } from '../src/main/service/portfolio-service'
import type { SyncDiagnosticLogger } from '../src/main/service/sync-diagnostics'

class MemoryRepository {
  content: string | null = null

  load(): Promise<string | null> {
    return Promise.resolve(this.content)
  }

  save(content: string): Promise<void> {
    this.content = content
    return Promise.resolve()
  }
}

type QuoteLookup = (
  input: AssetQuoteLookupInput
) => Promise<AssetQuoteLookupResult>

function desktopFake(lookupAssetQuote?: QuoteLookup): DesktopOperations {
  const exchangeRates = {
    provider: 'coinbase' as const,
    baseCurrency: 'USD' as const,
    rates: { USD: 1, CNY: 7, HKD: 7.8 },
    fetchedAt: '2026-09-05T00:00:00.000Z'
  }
  return {
    syncPositions: async () => ({
      positions: [],
      syncedAt: '2026-09-05T00:00:00.000Z'
    }),
    loadExchangeRates: async () => exchangeRates,
    fetchExchangeRates: async () => exchangeRates,
    ...(lookupAssetQuote
      ? {
          lookupAssetQuote: (input: unknown) =>
            lookupAssetQuote(input as AssetQuoteLookupInput)
        }
      : {}),
    exportBackup: async () => ({ canceled: true }),
    importBackup: async () => ({ canceled: true })
  }
}

function createModule(
  lookupAssetQuote?: QuoteLookup,
  diagnostics?: SyncDiagnosticLogger
) {
  const portfolio = new PortfolioService(
    new MemoryRepository(),
    new MemoryRepository()
  )
  return {
    module: new PortfolioModule(
      portfolio,
      desktopFake(lookupAssetQuote),
      diagnostics
    ),
    portfolio
  }
}

test('logs the account, position and reason for unmatched manual quotes', async () => {
  const diagnostics: Array<{
    event: string
    details: Readonly<Record<string, unknown>>
  }> = []
  const { module } = createModule(
    async () => ({ status: 'not-found' }),
    (_level, event, details) => diagnostics.push({ event, details })
  )
  const workspaceId = await createWorkspace(module)
  const accountId = await createManualAccount(module, workspaceId, '养老金')
  await savePosition(module, workspaceId, accountId, {
    market: 'CN_OTC',
    symbol: '000216',
    name: '华安黄金ETF联接A',
    currency: 'CNY',
    quantity: 1,
    price: 3.3417
  })

  await module.refreshPositionPrices(workspaceId, accountId)

  const unmatched = diagnostics.find(
    ({ event }) => event === 'price-refresh.position-not-found'
  )
  assert.deepEqual(unmatched?.details, {
    accountId,
    accountName: '养老金',
    positionId: unmatched?.details.positionId,
    positionName: '华安黄金ETF联接A',
    market: 'CN_OTC',
    symbol: '000216',
    provider: 'eastmoney',
    currentPrice: 3.3417,
    currentCurrency: 'CNY'
  })
  assert.ok(diagnostics.some(({ event, details }) =>
    event === 'price-refresh.completed' &&
    details.notFoundCount === 1 &&
    details.refreshedCount === 0
  ))
})

test('preserves the DesktopService receiver while refreshing a quote', async () => {
  const portfolio = new PortfolioService(
    new MemoryRepository(),
    new MemoryRepository()
  )
  const desktop = new DesktopService({
    lookupAssetQuote: async (input: AssetQuoteLookupInput) => ({
      market: input.market,
      symbol: input.symbol,
      source: input.provider,
      currency: 'HKD',
      price: 450,
      fetchedAt: '2026-09-06T00:00:00.000Z'
    })
  } as unknown as DesktopServiceDependencies)
  const module = new PortfolioModule(portfolio, desktop)
  const workspaceId = await createWorkspace(module)
  const accountId = await createManualAccount(module, workspaceId, '是然中银国际')
  await savePosition(module, workspaceId, accountId, {
    market: 'HK',
    symbol: '00700',
    name: '腾讯控股',
    currency: 'HKD',
    quantity: 571,
    price: 442.8
  })

  const result = await module.refreshPositionPrices(workspaceId, accountId)

  assert.equal(result.refreshedCount, 1)
  assert.equal(result.unavailableCount, 0)
  assert.equal(
    (await module.load()).data.workspaces[0].accounts[0].positions[0].price,
    450
  )
})

async function createWorkspace(module: PortfolioModule): Promise<string> {
  const created = await module.execute({
    type: 'create-workspace',
    input: { name: '家庭资产', baseCurrency: 'CNY' }
  })
  return created.result as string
}

async function createManualAccount(
  module: PortfolioModule,
  workspaceId: string,
  name: string
): Promise<string> {
  const created = await module.execute({
    type: 'create-account',
    workspaceId,
    input: { name, type: 'General' }
  })
  return created.result as string
}

async function savePosition(
  module: PortfolioModule,
  workspaceId: string,
  accountId: string,
  input: PositionInput
): Promise<void> {
  await module.execute({
    type: 'save-position',
    workspaceId,
    accountId,
    input
  })
}

function quote(
  input: AssetQuoteLookupInput,
  price: number,
  currency?: string
): AssetQuoteLookupResult {
  return {
    status: 'found',
    quote: {
      ...input,
      source: input.provider,
      price,
      ...(currency ? { currency } : {}),
      fetchedAt: '2026-09-05T01:00:00.000Z'
    }
  }
}

test('validates workspace-wide and account-scoped price refresh targets', () => {
  assert.equal(portfolioPriceRefreshTargetSchema.safeParse({
    workspaceId: 'workspace-1'
  }).success, true)
  assert.equal(portfolioPriceRefreshTargetSchema.safeParse({
    workspaceId: 'workspace-1',
    accountId: 'account-1'
  }).success, true)
  assert.equal(portfolioPriceRefreshTargetSchema.safeParse({
    workspaceId: '',
    accountId: 'account-1'
  }).success, false)
  assert.equal(portfolioPriceRefreshTargetSchema.safeParse({
    workspaceId: 'workspace-1',
    unexpected: true
  }).success, false)
})

test('refreshes every manual position, deduplicates quotes and excludes synced accounts', async () => {
  const requests: AssetQuoteLookupInput[] = []
  const { module } = createModule(async (input) => {
    requests.push(input)
    if (input.symbol === 'AAPL') return quote(input, 125, 'USD')
    if (input.symbol === 'BTC') return quote(input, 60_000, 'USDT')
    if (input.symbol === '017641') return quote(input, 1.5, 'CNY')
    if (input.symbol === 'MISSING') return { status: 'not-found' }
    throw new Error('HTTP 429')
  })
  const workspaceId = await createWorkspace(module)
  const initialWorkspace = (await module.load()).data.workspaces[0]
  await module.execute({
    type: 'update-workspace',
    id: workspaceId,
    input: {
      name: initialWorkspace.name,
      baseCurrency: initialWorkspace.baseCurrency,
      exchangeRateProvider: initialWorkspace.exchangeRateProvider,
      exchangeRateRefreshIntervalMinutes:
        initialWorkspace.exchangeRateRefreshIntervalMinutes,
      stockQuoteProvider: 'yahoo',
      cryptoQuoteProvider: 'yahoo'
    }
  })

  const firstAccountId = await createManualAccount(module, workspaceId, '长期账户')
  const secondAccountId = await createManualAccount(module, workspaceId, '备用账户')
  await savePosition(module, workspaceId, firstAccountId, {
    market: 'US',
    symbol: 'AAPL',
    name: 'Apple',
    currency: 'USD',
    quantity: 2,
    price: 100
  })
  await savePosition(module, workspaceId, firstAccountId, {
    market: 'CC',
    symbol: 'BTC',
    name: 'Bitcoin',
    currency: 'USD',
    quantity: 0.5,
    price: 50_000
  })
  await savePosition(module, workspaceId, firstAccountId, {
    market: 'CN_OTC',
    symbol: '017641',
    name: '指数基金',
    currency: 'CNY',
    quantity: 100,
    price: 1.2
  })
  await savePosition(module, workspaceId, firstAccountId, {
    market: 'US',
    symbol: 'MISSING',
    name: 'Missing',
    currency: 'USD',
    quantity: 1,
    price: 10
  })
  await savePosition(module, workspaceId, firstAccountId, {
    market: 'US',
    symbol: 'BROKEN',
    name: 'Broken',
    currency: 'USD',
    quantity: 1,
    price: 20
  })
  await savePosition(module, workspaceId, secondAccountId, {
    market: 'US',
    symbol: 'AAPL',
    name: 'Apple duplicate',
    currency: 'USD',
    quantity: 3,
    price: 101
  })

  const synchronizedAccount = await module.execute({
    type: 'create-account',
    workspaceId,
    input: {
      name: 'OKX',
      type: 'Okx',
      integration: {
        provider: 'Okx',
        api: {
          credential: {
            mode: 'replace',
            value: {
              apiKey: 'api-key',
              secretKey: 'secret-key',
              passphrase: 'passphrase'
            }
          }
        }
      }
    }
  })
  const synchronizedAccountId = synchronizedAccount.result as string
  const integration = (await module.load()).integrations.find(
    (item) => item.accountId === synchronizedAccountId
  )!
  await module.replaceSynchronizedPositions(
    workspaceId,
    synchronizedAccountId,
    integration,
    [{
      market: 'CC',
      symbol: 'ETH',
      name: 'Ethereum',
      currency: 'USD',
      quantity: 1,
      price: 2_000
    }],
    '2026-09-05T00:30:00.000Z'
  )

  let changeCount = 0
  module.subscribe(() => {
    changeCount += 1
  })
  const result = await module.refreshPositionPrices(workspaceId)

  assert.deepEqual(
    {
      positionCount: result.positionCount,
      refreshedCount: result.refreshedCount,
      notFoundCount: result.notFoundCount,
      unavailableCount: result.unavailableCount,
      conflictCount: result.conflictCount
    },
    {
      positionCount: 6,
      refreshedCount: 4,
      notFoundCount: 1,
      unavailableCount: 1,
      conflictCount: 0
    }
  )
  assert.equal(Number.isFinite(Date.parse(result.completedAt)), true)
  assert.equal(changeCount, 1)
  assert.deepEqual(
    requests
      .map(({ market, symbol, provider }) => ({ market, symbol, provider }))
      .sort((left, right) => left.symbol.localeCompare(right.symbol)),
    [
      { market: 'CN_OTC', symbol: '017641', provider: 'eastmoney' },
      { market: 'US', symbol: 'AAPL', provider: 'yahoo' },
      { market: 'US', symbol: 'BROKEN', provider: 'yahoo' },
      { market: 'CC', symbol: 'BTC', provider: 'yahoo' },
      { market: 'US', symbol: 'MISSING', provider: 'yahoo' }
    ]
  )

  const workspace = (await module.load()).data.workspaces[0]
  const firstAccount = workspace.accounts.find((item) => item.id === firstAccountId)!
  const secondAccount = workspace.accounts.find((item) => item.id === secondAccountId)!
  const prices = new Map(
    firstAccount.positions.map((position) => [position.symbol, position])
  )
  assert.equal(prices.get('AAPL')?.price, 125)
  assert.equal(prices.get('BTC')?.price, 60_000)
  assert.equal(prices.get('BTC')?.currency, 'USDT')
  assert.equal(prices.get('BTC')?.quantity, 0.5)
  assert.equal(prices.get('BTC')?.name, 'Bitcoin')
  assert.equal(prices.get('017641')?.price, 1.5)
  assert.equal(prices.get('MISSING')?.price, 10)
  assert.equal(prices.get('BROKEN')?.price, 20)
  assert.equal(secondAccount.positions[0].price, 125)
  assert.equal(
    workspace.accounts.find((item) => item.id === synchronizedAccountId)
      ?.positions[0].price,
    2_000
  )
})

test('does not overwrite a position edited while its quote is loading', async () => {
  let signalStarted: (() => void) | undefined
  const started = new Promise<void>((resolve) => {
    signalStarted = resolve
  })
  let finishLookup: ((result: AssetQuoteLookupResult) => void) | undefined
  const lookupResult = new Promise<AssetQuoteLookupResult>((resolve) => {
    finishLookup = resolve
  })
  const { module } = createModule(async () => {
    signalStarted?.()
    return lookupResult
  })
  const workspaceId = await createWorkspace(module)
  const accountId = await createManualAccount(module, workspaceId, '手动账户')
  await savePosition(module, workspaceId, accountId, {
    market: 'US',
    symbol: 'AAPL',
    name: 'Apple',
    currency: 'USD',
    quantity: 1,
    price: 100
  })
  const position = (await module.load()).data.workspaces[0].accounts[0].positions[0]

  const refresh = module.refreshPositionPrices(workspaceId, accountId)
  await started
  await module.execute({
    type: 'save-position',
    workspaceId,
    accountId,
    positionId: position.id,
    input: {
      market: position.market,
      symbol: position.symbol,
      name: position.name,
      currency: position.currency,
      quantity: position.quantity,
      price: 105,
      tagIds: position.tagIds
    }
  })
  finishLookup?.(quote(
    {
      market: position.market,
      symbol: position.symbol,
      provider: 'eastmoney'
    },
    120,
    'USD'
  ))

  const result = await refresh
  assert.equal(result.positionCount, 1)
  assert.equal(result.refreshedCount, 0)
  assert.equal(result.conflictCount, 1)
  assert.equal(
    (await module.load()).data.workspaces[0].accounts[0].positions[0].price,
    105
  )
})

test('scopes refreshes to one account and rejects unknown targets', async () => {
  const requests: string[] = []
  const { module } = createModule(async (input) => {
    requests.push(input.symbol)
    return quote(input, input.symbol === 'AAPL' ? 125 : 250, 'USD')
  })
  const workspaceId = await createWorkspace(module)
  const firstAccountId = await createManualAccount(module, workspaceId, '账户一')
  const secondAccountId = await createManualAccount(module, workspaceId, '账户二')
  await savePosition(module, workspaceId, firstAccountId, {
    market: 'US',
    symbol: 'AAPL',
    name: 'Apple',
    currency: 'USD',
    quantity: 1,
    price: 100
  })
  await savePosition(module, workspaceId, secondAccountId, {
    market: 'US',
    symbol: 'MSFT',
    name: 'Microsoft',
    currency: 'USD',
    quantity: 1,
    price: 200
  })

  const result = await module.refreshPositionPrices(workspaceId, firstAccountId)
  assert.equal(result.positionCount, 1)
  assert.equal(result.refreshedCount, 1)
  assert.deepEqual(requests, ['AAPL'])
  const workspace = (await module.load()).data.workspaces[0]
  assert.equal(workspace.accounts[0].positions[0].price, 125)
  assert.equal(workspace.accounts[1].positions[0].price, 200)

  await assert.rejects(
    () => module.refreshPositionPrices(workspaceId, 'missing'),
    (error: unknown) =>
      error instanceof McpOperationError && error.code === 'NOT_FOUND'
  )
  await assert.rejects(
    () => module.refreshPositionPrices('missing'),
    (error: unknown) =>
      error instanceof McpOperationError && error.code === 'NOT_FOUND'
  )
})
