import assert from 'node:assert/strict'
import test from 'node:test'

import type { DesktopOperations } from '../src/main/service/desktop-service'
import {
  McpOperationError,
  PortfolioModule
} from '../src/main/service/portfolio-module'
import { PortfolioService } from '../src/main/service/portfolio-service'
import {
  MCP_TOOL_NAMES,
  mcpToolOutputSchemas,
  type McpAccessSettings,
  type McpToolName,
  type McpToolSuccess
} from '../src/shared/mcp'
import type { OkxSyncResult } from '../src/shared/okx'

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

const readAccess: McpAccessSettings = { enabled: true, allowWrite: false }
const fullAccess: McpAccessSettings = { enabled: true, allowWrite: true }

function desktopFake(): DesktopOperations {
  const exchangeRates = {
    provider: 'coinbase' as const,
    baseCurrency: 'USD' as const,
    rates: { USD: 1, CNY: 7, HKD: 7.8, EUR: 0.86, USDT: 1.01 },
    fetchedAt: '2026-08-31T00:00:00.000Z'
  }
  return {
    syncPositions: async () => ({
      positions: [],
      syncedAt: '2026-08-31T00:00:00.000Z'
    }),
    loadExchangeRates: async () => exchangeRates,
    fetchExchangeRates: async () => exchangeRates,
    exportBackup: async () => ({ canceled: true }),
    importBackup: async () => ({ canceled: true })
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

test('MCP exposes no deletion tools', () => {
  assert.equal(MCP_TOOL_NAMES.some((name) => name.includes('delete')), false)
})

test('MCP defaults to write access while sync operations remain available in read-only mode', async () => {
  const module = createModule()

  const created = await module.callMcpTool(
    'chromie_create_workspace',
    { name: '默认工作区', base_currency: 'CNY' }
  )
  assertValidOutput('chromie_create_workspace', created)

  await assert.rejects(
    () => module.callMcpTool(
      'chromie_create_workspace',
      { name: '家庭资产', base_currency: 'CNY' },
      readAccess
    ),
    (error: unknown) =>
      error instanceof McpOperationError && error.code === 'PERMISSION_DENIED'
  )

  const refreshed = await module.callMcpTool(
    'chromie_refresh_exchange_rates',
    {},
    readAccess
  )
  assertValidOutput('chromie_refresh_exchange_rates', refreshed)

  await assert.rejects(
    () => module.callMcpTool(
      'chromie_sync_account',
      { workspace_id: 'missing', account_id: 'missing' },
      readAccess
    ),
    (error: unknown) =>
      error instanceof McpOperationError && error.code === 'NOT_FOUND'
  )
})

test('MCP tag and account CRUD reads and writes portfolio data', async () => {
  const module = createModule()
  const createdWorkspace = await module.callMcpTool(
    'chromie_create_workspace',
    { name: '家庭资产', base_currency: 'CNY' },
    fullAccess
  )
  const workspaceId = dataOf<{ workspace_id: string }>(createdWorkspace).workspace_id

  const createdTag = await module.callMcpTool(
    'chromie_create_tag',
    {
      workspace_id: workspaceId,
      name: '长期',
      color: 'blue',
      note: '关注长期回报'
    },
    fullAccess
  )
  const tagId = dataOf<{ tag: { id: string } }>(createdTag).tag.id
  assertValidOutput('chromie_create_tag', createdTag)

  const updatedTag = await module.callMcpTool(
    'chromie_update_tag',
    {
      workspace_id: workspaceId,
      tag_id: tagId,
      name: '长期持有',
      color: 'purple',
      note: '  每半年复盘一次  '
    },
    fullAccess
  )
  assert.deepEqual(
    dataOf<{ tag: { name: string; note: string } }>(updatedTag).tag,
    {
      id: tagId,
      name: '长期持有',
      color: 'purple',
      note: '每半年复盘一次'
    }
  )
  assertValidOutput('chromie_update_tag', updatedTag)

  const createdAccount = await module.callMcpTool(
    'chromie_create_account',
    {
      workspace_id: workspaceId,
      name: '券商账户',
      type: 'General',
      tag_ids: [tagId]
    },
    fullAccess
  )
  const accountId = dataOf<{ account_id: string }>(createdAccount).account_id
  assertValidOutput('chromie_create_account', createdAccount)

  const createdPosition = await module.callMcpTool(
    'chromie_create_position',
    {
      workspace_id: workspaceId,
      account_id: accountId,
      market: 'US',
      symbol: 'AAPL',
      name: 'Apple',
      currency: 'USD',
      quantity: 2,
      price: 100,
      tag_ids: [tagId]
    },
    fullAccess
  )
  const position = dataOf<{
    position: { id: string; symbol: string; tag_ids: string[] }
  }>(createdPosition).position
  assert.equal(position.symbol, 'AAPL')
  assert.deepEqual(position.tag_ids, [tagId])
  assertValidOutput('chromie_create_position', createdPosition)

  const setAccountTags = await module.callMcpTool(
    'chromie_set_account_tags',
    { workspace_id: workspaceId, account_id: accountId, tag_ids: [tagId] },
    fullAccess
  )
  const setPositionTags = await module.callMcpTool(
    'chromie_set_position_tags',
    {
      workspace_id: workspaceId,
      account_id: accountId,
      position_id: position.id,
      tag_ids: [tagId]
    },
    fullAccess
  )
  assertValidOutput('chromie_set_account_tags', setAccountTags)
  assertValidOutput('chromie_set_position_tags', setPositionTags)

  const listed = await module.callMcpTool('chromie_list_workspaces', {}, readAccess)
  const listedData = dataOf<{
    workspaces: Array<{ tag_count: number; account_count: number }>
  }>(listed)
  assert.equal(listedData.workspaces[0].tag_count, 1)
  assert.equal(listedData.workspaces[0].account_count, 1)
  assertValidOutput('chromie_list_workspaces', listed)

  const overview = await module.callMcpTool(
    'chromie_get_portfolio_overview',
    { workspace_id: workspaceId, group_by: 'tag' },
    readAccess
  )
  const overviewData = dataOf<{
    total: { converted_market_value: number }
    rows: Array<{ id: string; converted_market_value: number }>
  }>(overview)
  assert.equal(overviewData.total.converted_market_value, 1400)
  assert.equal(
    overviewData.rows.find((row) => row.id === tagId)?.converted_market_value,
    1400
  )
  assertValidOutput('chromie_get_portfolio_overview', overview)

  const workspace = await module.callMcpTool(
    'chromie_get_workspace',
    { workspace_id: workspaceId },
    readAccess
  )
  const workspaceData = dataOf<{
    workspace: {
      tags: Array<{ id: string; name: string; note: string }>
      accounts: Array<{
        tag_ids: string[]
        sync: Record<string, unknown>
        positions?: unknown
      }>
    }
  }>(workspace).workspace
  assert.deepEqual(workspaceData.tags, [
    { id: tagId, name: '长期持有', color: 'purple', note: '每半年复盘一次' }
  ])
  assert.deepEqual(workspaceData.accounts[0].tag_ids, [tagId])
  assert.equal(workspaceData.accounts[0].positions, undefined)
  assert.deepEqual(workspaceData.accounts[0].sync, {
    capable: false,
    configured: false
  })
  assertValidOutput('chromie_get_workspace', workspace)

  const positionsByTag = await module.callMcpTool(
    'chromie_list_positions',
    { workspace_id: workspaceId, tag_id: tagId },
    readAccess
  )
  const listedPosition = dataOf<{
    positions: Array<{
      id: string
      tag_ids: string[]
      tags: Array<{ id: string }>
      account_tags: Array<{ id: string }>
    }>
  }>(positionsByTag).positions[0]
  assert.equal(listedPosition.id, position.id)
  assert.deepEqual(listedPosition.tag_ids, [tagId])
  assert.deepEqual(listedPosition.tags.map((tag) => tag.id), [tagId])
  assert.deepEqual(listedPosition.account_tags.map((tag) => tag.id), [tagId])
  assertValidOutput('chromie_list_positions', positionsByTag)

  const updatedPosition = await module.callMcpTool(
    'chromie_update_position',
    {
      workspace_id: workspaceId,
      account_id: accountId,
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

  const refreshedRates = await module.callMcpTool(
    'chromie_refresh_exchange_rates',
    { workspace_id: workspaceId },
    fullAccess
  )
  assertValidOutput('chromie_refresh_exchange_rates', refreshedRates)
})

test('allows an exchange-traded and OTC fund with the same code', async () => {
  const module = createModule()
  const createdWorkspace = await module.callMcpTool(
    'chromie_create_workspace',
    { name: '基金账户', base_currency: 'CNY' },
    fullAccess
  )
  const workspaceId = dataOf<{ workspace_id: string }>(createdWorkspace).workspace_id
  const createdAccount = await module.callMcpTool(
    'chromie_create_account',
    {
      workspace_id: workspaceId,
      name: '通用账户',
      type: 'General'
    },
    fullAccess
  )
  const accountId = dataOf<{ account_id: string }>(createdAccount).account_id

  await module.callMcpTool(
    'chromie_create_position',
    {
      workspace_id: workspaceId,
      account_id: accountId,
      market: 'CN',
      symbol: '161725',
      name: '白酒基金LOF',
      currency: 'CNY',
      quantity: 100,
      price: 1
    },
    fullAccess
  )
  await module.callMcpTool(
    'chromie_create_position',
    {
      workspace_id: workspaceId,
      account_id: accountId,
      market: 'CN_OTC',
      symbol: '161725',
      name: '招商中证白酒指数(LOF)A',
      currency: 'CNY',
      quantity: 100,
      price: 1
    },
    fullAccess
  )

  const listed = await module.callMcpTool(
    'chromie_list_positions',
    { workspace_id: workspaceId },
    readAccess
  )
  const positions = dataOf<{
    positions: Array<{ market: string; symbol: string }>
  }>(listed).positions
  assert.deepEqual(
    positions.map(({ market, symbol }) => `${market}:${symbol}`).sort(),
    ['CN:161725', 'CN_OTC:161725']
  )
  assertValidOutput('chromie_list_positions', listed)
})

test('position pagination uses a query-bound stable cursor', async () => {
  const module = createModule()
  const createdWorkspace = await module.callMcpTool(
    'chromie_create_workspace',
    { name: '分页测试', base_currency: 'USD' },
    fullAccess
  )
  const workspaceId = dataOf<{ workspace_id: string }>(createdWorkspace).workspace_id
  const createdAccount = await module.callMcpTool(
    'chromie_create_account',
    { workspace_id: workspaceId, name: 'Manual', type: 'General' },
    fullAccess
  )
  const accountId = dataOf<{ account_id: string }>(createdAccount).account_id

  for (const symbol of ['AAA', 'BBB', 'CCC']) {
    await module.callMcpTool(
      'chromie_create_position',
      {
        workspace_id: workspaceId,
        account_id: accountId,
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

  const all = await module.callMcpTool(
    'chromie_list_positions',
    { workspace_id: workspaceId, limit: 100 },
    readAccess
  )
  const allPositionIds = dataOf<{ positions: Array<{ id: string }> }>(all)
    .positions.map((position) => position.id)
  const firstResult = await module.callMcpTool(
    'chromie_list_positions',
    { workspace_id: workspaceId, limit: 1 },
    readAccess
  )
  const first = dataOf<{
    positions: Array<{ id: string }>
    next_cursor: string
  }>(firstResult)
  assert.equal(first.positions[0].id, allPositionIds[0])
  assert.ok(first.next_cursor)

  await assert.rejects(
    () => module.callMcpTool(
      'chromie_list_positions',
      {
        workspace_id: workspaceId,
        query: 'Stock',
        cursor: first.next_cursor,
        limit: 1
      },
      readAccess
    ),
    (error: unknown) =>
      error instanceof McpOperationError && error.code === 'VALIDATION_ERROR'
  )

  const secondResult = await module.callMcpTool(
    'chromie_list_positions',
    { workspace_id: workspaceId, cursor: first.next_cursor, limit: 1 },
    readAccess
  )
  const second = dataOf<{ positions: Array<{ id: string }> }>(secondResult)
  assert.equal(second.positions[0].id, allPositionIds[1])
  assertValidOutput('chromie_list_positions', secondResult)
})

test('tool output schemas accept structured errors', () => {
  assert.deepEqual(
    mcpToolOutputSchemas.chromie_list_workspaces.parse({
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

test('invalid tag and snapshot writes leave portfolio data unchanged', async () => {
  const module = createModule()
  const created = await module.callMcpTool(
    'chromie_create_workspace',
    { name: '边界测试', base_currency: 'CNY' },
    fullAccess
  )
  const workspaceId = dataOf<{ workspace_id: string }>(created).workspace_id

  await assert.rejects(
    () => module.callMcpTool(
      'chromie_update_tag',
      {
        workspace_id: workspaceId,
        tag_id: 'missing-tag',
        name: '不存在',
        color: 'gray'
      },
      fullAccess
    ),
    (error: unknown) =>
      error instanceof McpOperationError && error.code === 'NOT_FOUND'
  )
  await assert.rejects(
    () => module.callMcpTool(
      'chromie_create_snapshot',
      { workspace_id: 'missing-workspace' },
      fullAccess
    ),
    (error: unknown) =>
      error instanceof McpOperationError && error.code === 'NOT_FOUND'
  )

  const listed = await module.callMcpTool('chromie_list_workspaces', {}, readAccess)
  const workspaces = dataOf<{ workspaces: Array<{ id: string; name: string }> }>(listed)
    .workspaces
  assert.equal(workspaces.length, 1)
  assert.equal(workspaces[0].id, workspaceId)
  assert.equal(workspaces[0].name, '边界测试')
})

test('account sync is deduplicated and rejects stale results after configuration changes', async () => {
  const portfolio = new PortfolioService(
    new MemoryRepository(),
    new MemoryRepository()
  )
  const workspaceId = (await portfolio.execute({
    type: 'create-workspace',
    input: { name: '同步测试', baseCurrency: 'USD' }
  })).result as string
  const accountId = (await portfolio.execute({
    type: 'create-account',
    workspaceId,
    input: {
      name: 'OKX',
      type: 'Okx',
      sync: { interval: 30 },
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
  })).result as string

  let syncCalls = 0
  let signalStarted: (() => void) | undefined
  const started = new Promise<void>((resolve) => {
    signalStarted = resolve
  })
  let finishSync: ((value: OkxSyncResult) => void) | undefined
  const syncResult = new Promise<OkxSyncResult>((resolve) => {
    finishSync = resolve
  })
  const module = new PortfolioModule(portfolio, {
    ...desktopFake(),
    syncPositions: () => {
      syncCalls += 1
      signalStarted?.()
      return syncResult
    }
  })

  const first = module.syncAccount(workspaceId, accountId)
  const second = module.syncAccount(workspaceId, accountId)
  assert.equal(first, second)
  await started
  assert.equal(syncCalls, 1)

  await portfolio.execute({
    type: 'update-account',
    workspaceId,
    accountId,
    input: { name: '手动账户', type: 'General' }
  })
  finishSync?.({
    positions: [{
      market: 'CC',
      symbol: 'BTC',
      name: 'Bitcoin',
      currency: 'USD',
      quantity: 1,
      price: 100
    }],
    syncedAt: '2026-09-03T08:00:00.000Z'
  })

  const settled = await Promise.allSettled([first, second])
  settled.forEach((result) => {
    assert.equal(result.status, 'rejected')
    if (result.status === 'rejected') {
      assert.ok(result.reason instanceof McpOperationError)
      assert.equal(result.reason.code, 'SYNC_CONFLICT')
    }
  })
  const account = (await portfolio.load()).data.workspaces[0].accounts[0]
  assert.equal(account.type, 'General')
  assert.deepEqual(account.positions, [])
})
