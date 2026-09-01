import assert from 'node:assert/strict'
import test from 'node:test'

import {
  mcpToolOutputSchemas,
  type McpAccessSettings,
  type McpToolName,
  type McpToolSuccess
} from '../src/shared/mcp'
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
  allowDelete: false
}

const fullAccess: McpAccessSettings = {
  enabled: true,
  allowWrite: true,
  allowDelete: true
}

function desktopFake(): DesktopOperations {
  return {
    syncPositions: async () => ({ positions: [], syncedAt: '2026-08-31T00:00:00.000Z' }),
    loadExchangeRates: async () => ({
      provider: 'coinbase',
      baseCurrency: 'USD',
      rates: { USD: 1, CNY: 7, HKD: 7.8, EUR: 0.86, USDT: 1.01 },
      fetchedAt: '2026-08-31T00:00:00.000Z'
    }),
    fetchExchangeRates: async () => ({
      provider: 'coinbase',
      baseCurrency: 'USD',
      rates: { USD: 1, CNY: 7, HKD: 7.8, EUR: 0.86, USDT: 1.01 },
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

function assertValidOutput(name: McpToolName, result: McpToolSuccess): void {
  mcpToolOutputSchemas[name].parse(result)
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

  const accountGroupResult = await module.callMcpTool(
    'chromie_create_account_group',
    {
      account_id: accountId,
      name: 'Moon'
    },
    fullAccess
  )
  const accountGroupId = dataOf<{ account_group: { id: string } }>(
    accountGroupResult
  ).account_group.id
  const updatedAccountGroup = await module.callMcpTool(
    'chromie_update_account_group',
    {
      account_id: accountId,
      account_group_id: accountGroupId,
      name: 'Moon Updated'
    },
    fullAccess
  )
  assert.equal(
    dataOf<{ account_group: { name: string } }>(updatedAccountGroup)
      .account_group.name,
    'Moon Updated'
  )
  assertValidOutput('chromie_update_account_group', updatedAccountGroup)

  const assetResult = await module.callMcpTool(
    'chromie_create_asset_account',
    {
      account_id: accountId,
      name: '券商账户',
      type: 'General'
    },
    fullAccess
  )
  const assetAccountId = dataOf<{ asset_account_id: string }>(assetResult)
    .asset_account_id
  const accountGroupMembers = await module.callMcpTool(
    'chromie_replace_account_group_members',
    {
      account_id: accountId,
      account_group_id: accountGroupId,
      asset_account_ids: [assetAccountId]
    },
    fullAccess
  )
  assertValidOutput('chromie_replace_account_group_members', accountGroupMembers)
  const positionResult = await module.callMcpTool(
    'chromie_create_position',
    {
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
  assertValidOutput('chromie_create_position', positionResult)

  const listed = await module.callMcpTool(
    'chromie_list_accounts',
    {},
    readAccess
  )
  assert.deepEqual(
    dataOf<{ exchange_rates: { rates: Record<string, number> } }>(listed)
      .exchange_rates.rates,
    { CNY: 7, HKD: 7.8, USD: 1 }
  )
  assert.equal(
    dataOf<{ accounts: Array<{ account_group_count: number }> }>(listed)
      .accounts[0].account_group_count,
    1
  )
  assertValidOutput('chromie_list_accounts', listed)

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
  assert.deepEqual(
    dataOf<{ exchange_rates: { rates: Record<string, number> } }>(overview)
      .exchange_rates.rates,
    { CNY: 7, HKD: 7.8, USD: 1 }
  )
  assertValidOutput('chromie_get_overview', overview)

  const accountGroupOverview = await module.callMcpTool(
    'chromie_get_overview',
    { account_id: accountId, group_by: 'account_group' },
    readAccess
  )
  assert.equal(
    dataOf<{ rows: Array<{ id: string; anchored_market_value: number }> }>(
      accountGroupOverview
    ).rows.find((row) => row.id === accountGroupId)?.anchored_market_value,
    1400
  )
  assertValidOutput('chromie_get_overview', accountGroupOverview)

  const refreshedRates = await module.callMcpTool(
    'chromie_refresh_exchange_rates',
    { account_id: accountId },
    fullAccess
  )
  assert.deepEqual(
    dataOf<{ exchange_rates: { rates: Record<string, number> } }>(refreshedRates)
      .exchange_rates.rates,
    { CNY: 7, HKD: 7.8, USD: 1 }
  )
  assertValidOutput('chromie_refresh_exchange_rates', refreshedRates)

  const account = await module.callMcpTool(
    'chromie_get_account',
    { account_id: accountId },
    readAccess
  )
  const accountData = dataOf<{
    account: {
      account_groups: Array<{
        id: string
        name: string
        asset_account_ids: string[]
      }>
      asset_accounts: Array<{
        sync: Record<string, unknown>
        positions?: Array<{ id: string }>
      }>
    }
  }>(account)
  assert.deepEqual(accountData.account.account_groups, [
    {
      id: accountGroupId,
      name: 'Moon Updated',
      asset_account_ids: [assetAccountId]
    }
  ])
  assert.equal(accountData.account.asset_accounts[0].positions, undefined)
  assert.deepEqual(accountData.account.asset_accounts[0].sync, {
    capable: false,
    configured: false
  })
  assertValidOutput('chromie_get_account', account)

  const accountWithPositions = await module.callMcpTool(
    'chromie_get_account',
    { account_id: accountId, include_positions: true },
    readAccess
  )
  const accountWithPositionsData = dataOf<{
    account: { asset_accounts: Array<{ positions: Array<{ id: string }> }> }
  }>(accountWithPositions)
  assert.equal(
    accountWithPositionsData.account.asset_accounts[0].positions[0].id,
    position.id
  )
  assertValidOutput('chromie_get_account', accountWithPositions)

  const updatedPosition = await module.callMcpTool(
    'chromie_update_position',
    {
      account_id: accountId,
      asset_account_id: assetAccountId,
      position_id: position.id,
      name: 'Apple Inc.'
    },
    fullAccess
  )
  assert.equal(
    dataOf<{ position: { name: string } }>(updatedPosition).position.name,
    'Apple Inc.'
  )
  assertValidOutput('chromie_update_position', updatedPosition)

  const createdGroup = await module.callMcpTool(
    'chromie_create_position_group',
    { account_id: accountId, name: '科技股' },
    fullAccess
  )
  const groupId = dataOf<{ group_id: string }>(createdGroup).group_id
  const updatedGroup = await module.callMcpTool(
    'chromie_update_position_group',
    { account_id: accountId, group_id: groupId, name: '科技' },
    fullAccess
  )
  assert.equal(dataOf<{ group_id: string }>(updatedGroup).group_id, groupId)
  assertValidOutput('chromie_create_position_group', createdGroup)
  assertValidOutput('chromie_update_position_group', updatedGroup)
})

test('position pagination uses a query-bound stable cursor', async () => {
  const module = createModule()
  const createdAccount = await module.callMcpTool(
    'chromie_create_account',
    { name: '分页测试', anchor_currency: 'USD' },
    fullAccess
  )
  const accountId = dataOf<{ account_id: string }>(createdAccount).account_id
  const createdAccountGroup = await module.callMcpTool(
    'chromie_create_account_group',
    { account_id: accountId, name: 'Tester' },
    fullAccess
  )
  const accountGroupId = dataOf<{ account_group: { id: string } }>(
    createdAccountGroup
  ).account_group.id
  const createdAssetAccount = await module.callMcpTool(
    'chromie_create_asset_account',
    {
      account_id: accountId,
      name: 'Manual',
      type: 'General'
    },
    fullAccess
  )
  const assetAccountId = dataOf<{ asset_account_id: string }>(createdAssetAccount)
    .asset_account_id
  await module.callMcpTool(
    'chromie_replace_account_group_members',
    {
      account_id: accountId,
      account_group_id: accountGroupId,
      asset_account_ids: [assetAccountId]
    },
    fullAccess
  )

  for (const symbol of ['AAA', 'BBB', 'CCC']) {
    await module.callMcpTool(
      'chromie_create_position',
      {
        account_id: accountId,
        asset_account_id: assetAccountId,
        market: 'US',
        symbol,
        name: `${symbol} Stock`,
        currency: 'USD',
        quantity: 1,
        price: 1
      },
      fullAccess
    )
  }

  const allPositionsResult = await module.callMcpTool(
    'chromie_search_positions',
    { account_id: accountId, limit: 100 },
    readAccess
  )
  const allPositionIds = dataOf<{ positions: Array<{ id: string }> }>(
    allPositionsResult
  ).positions.map((position) => position.id)
  const firstPageResult = await module.callMcpTool(
    'chromie_search_positions',
    { account_id: accountId, limit: 1 },
    readAccess
  )
  const firstPage = dataOf<{
    positions: Array<{ id: string }>
    next_cursor: string
  }>(firstPageResult)
  assert.equal(firstPage.positions[0].id, allPositionIds[0])
  assert.ok(firstPage.next_cursor)

  await assert.rejects(
    () => module.callMcpTool(
      'chromie_search_positions',
      {
        account_id: accountId,
        query: 'Stock',
        cursor: firstPage.next_cursor,
        limit: 1
      },
      readAccess
    ),
    (error: unknown) =>
      error instanceof McpOperationError && error.code === 'VALIDATION_ERROR'
  )

  await module.callMcpTool(
    'chromie_delete_portfolio_item',
    {
      target: {
        kind: 'position',
        account_id: accountId,
        asset_account_id: assetAccountId,
        position_id: allPositionIds[0]
      }
    },
    fullAccess
  )
  const secondPageResult = await module.callMcpTool(
    'chromie_search_positions',
    { account_id: accountId, cursor: firstPage.next_cursor, limit: 1 },
    readAccess
  )
  const secondPage = dataOf<{ positions: Array<{ id: string }> }>(secondPageResult)
  assert.equal(secondPage.positions[0].id, allPositionIds[1])
  assertValidOutput('chromie_search_positions', secondPageResult)
})

test('tool output schemas accept structured errors', () => {
  assert.deepEqual(
    mcpToolOutputSchemas.chromie_list_accounts.parse({
      ok: false,
      error: {
        code: 'APP_NOT_RUNNING',
        message: 'Chromie 未运行',
        retryable: true
      }
    }),
    {
      ok: false,
      error: {
        code: 'APP_NOT_RUNNING',
        message: 'Chromie 未运行',
        retryable: true
      }
    }
  )
})

test('delete executes directly after the client grants permission', async () => {
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
  const deleted = await module.callMcpTool(
    'chromie_delete_portfolio_item',
    argumentsValue,
    fullAccess
  )
  assertValidOutput('chromie_delete_portfolio_item', deleted)
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
      'chromie_update_position_group',
      {
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
