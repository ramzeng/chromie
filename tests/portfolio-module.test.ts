import assert from 'node:assert/strict'
import test from 'node:test'

import type { McpAccessSettings, McpToolSuccess } from '../src/shared/mcp'
import type { DesktopOperations } from '../src/main/service/desktop-service'
import {
  McpOperationError,
  PortfolioModule
} from '../src/main/service/portfolio-module'
import { PortfolioService } from '../src/main/service/portfolio-service'

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

const readAccess: McpAccessSettings = {
  enabled: true,
  allowWrite: false,
  allowSync: false,
  allowDelete: false
}

const fullAccess: McpAccessSettings = {
  enabled: true,
  allowWrite: true,
  allowSync: true,
  allowDelete: true
}

function desktopFake(): DesktopOperations {
  return {
    syncPositions: async () => ({ positions: [], syncedAt: '2026-08-31T00:00:00.000Z' }),
    loadExchangeRates: async () => ({
      provider: 'coinbase',
      baseCurrency: 'USD',
      rates: { USD: 1, CNY: 7, HKD: 7.8 },
      fetchedAt: '2026-08-31T00:00:00.000Z'
    }),
    fetchExchangeRates: async () => ({
      provider: 'coinbase',
      baseCurrency: 'USD',
      rates: { USD: 1, CNY: 7, HKD: 7.8 },
      fetchedAt: '2026-08-31T00:00:00.000Z'
    }),
    exportBackup: async () => ({ canceled: true }),
    importBackup: async () => ({ canceled: true }),
    saveShareImage: async () => ({ canceled: true })
  }
}

function dataOf<T>(result: McpToolSuccess): T {
  return result.data as T
}

function createModule() {
  const portfolio = new PortfolioService(
    new MemoryRepository(),
    new MemoryRepository()
  )
  return new PortfolioModule(portfolio, desktopFake())
}

test('MCP starts disabled and read-only access cannot mutate', async () => {
  const module = createModule()

  await assert.rejects(
    () => module.callMcpTool('chromie_list_accounts', {}),
    (error: unknown) =>
      error instanceof McpOperationError && error.code === 'MCP_DISABLED'
  )

  await assert.rejects(
    () => module.callMcpTool(
      'chromie_create_account',
      {
        name: '家庭资产',
        anchor_currency: 'CNY'
      },
      readAccess
    ),
    (error: unknown) =>
      error instanceof McpOperationError && error.code === 'PERMISSION_DENIED'
  )
})

test('MCP CRUD reads and writes portfolio data', async () => {
  const module = createModule()
  const createdAccount = await module.callMcpTool(
    'chromie_create_account',
    {
      name: '家庭资产',
      anchor_currency: 'CNY'
    },
    fullAccess
  )
  const accountId = dataOf<{ account_id: string }>(createdAccount).account_id
  assert.ok(accountId)

  const holderResult = await module.callMcpTool(
    'chromie_save_holder',
    {
      mode: 'create',
      account_id: accountId,
      name: 'Moon'
    },
    fullAccess
  )
  const holderId = dataOf<{ holder: { id: string } }>(holderResult).holder.id
  const assetResult = await module.callMcpTool(
    'chromie_create_asset_account',
    {
      account_id: accountId,
      name: '券商账户',
      type: 'General',
      holder_id: holderId
    },
    fullAccess
  )
  const assetAccountId = dataOf<{ asset_account_id: string }>(assetResult)
    .asset_account_id
  const positionResult = await module.callMcpTool(
    'chromie_save_position',
    {
      mode: 'create',
      account_id: accountId,
      asset_account_id: assetAccountId,
      market: 'US',
      symbol: 'AAPL',
      name: 'Apple',
      currency: 'USD',
      quantity: 2,
      price: 100
    },
    fullAccess
  )
  const position = dataOf<{ position: { id: string; symbol: string } }>(positionResult)
    .position
  assert.equal(position.symbol, 'AAPL')

  const overview = await module.callMcpTool(
    'chromie_get_overview',
    { account_id: accountId, group_by: 'asset_account' },
    readAccess
  )
  const overviewData = dataOf<{
    total: { anchored_market_value: number }
    rows: Array<{ anchored_market_value: number }>
  }>(overview)
  assert.equal(overviewData.total.anchored_market_value, 1400)
  assert.equal(overviewData.rows[0].anchored_market_value, 1400)

  const account = await module.callMcpTool(
    'chromie_get_account',
    { account_id: accountId },
    readAccess
  )
  const accountData = dataOf<{
    account: {
      asset_accounts: Array<{
        sync: Record<string, unknown>
        positions: Array<{ id: string }>
      }>
    }
  }>(account)
  assert.equal(accountData.account.asset_accounts[0].positions[0].id, position.id)
  assert.deepEqual(accountData.account.asset_accounts[0].sync, {
    capable: false,
    configured: false
  })
})

test('delete requires explicit confirmation and reports cascading impact', async () => {
  const module = createModule()
  const created = await module.callMcpTool(
    'chromie_create_account',
    {
      name: '待删除账户',
      anchor_currency: 'USD'
    },
    fullAccess
  )
  const accountId = dataOf<{ account_id: string }>(created).account_id
  const argumentsValue = {
    target: { kind: 'account', account_id: accountId }
  }
  const preview = await module.previewMcpDelete(argumentsValue, fullAccess)
  assert.match(preview.description, /历史快照/)

  await assert.rejects(
    () => module.callMcpTool(
      'chromie_delete_item',
      argumentsValue,
      fullAccess
    ),
    (error: unknown) =>
      error instanceof McpOperationError && error.code === 'CONFIRMATION_REQUIRED'
  )

  await module.callMcpTool(
    'chromie_delete_item',
    argumentsValue,
    fullAccess,
    true
  )
  const listed = await module.callMcpTool(
    'chromie_list_accounts',
    {},
    readAccess
  )
  assert.deepEqual(dataOf<{ accounts: unknown[] }>(listed).accounts, [])
})

test('invalid group and snapshot writes leave portfolio data unchanged', async () => {
  const module = createModule()
  const created = await module.callMcpTool(
    'chromie_create_account',
    {
      name: '边界测试',
      anchor_currency: 'CNY'
    },
    fullAccess
  )
  const accountId = dataOf<{ account_id: string }>(created).account_id

  await assert.rejects(
    () => module.callMcpTool(
      'chromie_save_position_group',
      {
        mode: 'update',
        account_id: accountId,
        group_id: 'missing-group',
        name: '不存在'
      },
      fullAccess
    ),
    (error: unknown) =>
      error instanceof McpOperationError && error.code === 'NOT_FOUND'
  )
  await assert.rejects(
    () => module.callMcpTool(
      'chromie_create_snapshot',
      { account_id: 'missing-account' },
      fullAccess
    ),
    (error: unknown) =>
      error instanceof McpOperationError && error.code === 'NOT_FOUND'
  )

  const listed = await module.callMcpTool(
    'chromie_list_accounts',
    {},
    readAccess
  )
  const accounts = dataOf<{ accounts: Array<{ id: string; name: string }> }>(
    listed
  ).accounts
  assert.equal(accounts.length, 1)
  assert.equal(accounts[0].id, accountId)
  assert.equal(accounts[0].name, '边界测试')
})
