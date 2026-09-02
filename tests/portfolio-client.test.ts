import assert from 'node:assert/strict'
import test from 'node:test'

import { PortfolioService } from '../src/main/service/portfolio-service'
import {
  executePortfolioClientCommand,
  loadPortfolioClientState
} from '../src/main/transport/portfolio-client'

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

async function createOkxPortfolio() {
  const portfolioRepository = new MemoryRepository()
  const integrationRepository = new MemoryRepository()
  const portfolio = new PortfolioService(
    portfolioRepository,
    integrationRepository
  )
  const createdWorkspace = await portfolio.execute(
    {
      type: 'create-workspace',
      input: { name: '家庭资产', baseCurrency: 'CNY' }
    }
  )
  const workspaceId = createdWorkspace.result as string
  const createdTag = await portfolio.execute(
    {
      type: 'create-tag',
      workspaceId,
      input: { name: 'Moon', color: 'blue' }
    }
  )
  const tagId = createdTag.result as string
  const createdAccount = await portfolio.execute(
    {
      type: 'create-account',
      workspaceId,
      input: {
        name: 'OKX',
        type: 'Okx',
        tagIds: [tagId],
        sync: { interval: 30 },
        integration: {
          provider: 'Okx',
          api: {
            credential: {
              mode: 'replace',
              value: {
                apiKey: 'api-key-secret',
                secretKey: 'secret-key-secret',
                passphrase: 'passphrase-secret'
              }
            }
          }
        }
      }
    }
  )
  const accountId = createdAccount.result as string
  return {
    portfolio,
    integrationRepository,
    workspaceId,
    accountId,
    tagId
  }
}

test('account names are unique within a workspace', async () => {
  const portfolio = new PortfolioService(
    new MemoryRepository(),
    new MemoryRepository()
  )
  const createdWorkspace = await portfolio.execute({
    type: 'create-workspace',
    input: { name: '家庭资产', baseCurrency: 'CNY' }
  })
  const workspaceId = createdWorkspace.result as string
  const firstAccount = await portfolio.execute({
    type: 'create-account',
    workspaceId,
    input: { name: 'Broker', type: 'General' }
  })

  await assert.rejects(
    portfolio.execute({
      type: 'create-account',
      workspaceId,
      input: { name: '  broker  ', type: 'General' }
    }),
    { message: '账户“broker”已存在' }
  )

  const secondAccount = await portfolio.execute({
    type: 'create-account',
    workspaceId,
    input: { name: '现金账户', type: 'General' }
  })
  await assert.rejects(
    portfolio.execute({
      type: 'update-account',
      workspaceId,
      accountId: secondAccount.result as string,
      input: { name: 'BROKER', type: 'General' }
    }),
    { message: '账户“BROKER”已存在' }
  )

  await portfolio.execute({
    type: 'update-account',
    workspaceId,
    accountId: firstAccount.result as string,
    input: { name: 'Broker', type: 'General' }
  })
  const accounts = (await portfolio.load()).data.workspaces[0].accounts
  assert.deepEqual(accounts.map((account) => account.name), ['Broker', '现金账户'])
})

test('workspace quote providers default, persist and migrate independently', async () => {
  const portfolioRepository = new MemoryRepository()
  const integrationRepository = new MemoryRepository()
  const portfolio = new PortfolioService(portfolioRepository, integrationRepository)
  const created = await portfolio.execute({
    type: 'create-workspace',
    input: { name: '行情测试', baseCurrency: 'CNY' }
  })
  const workspaceId = created.result as string
  let workspace = (await portfolio.load()).data.workspaces[0]

  assert.equal(workspace.stockQuoteProvider, 'eastmoney')
  assert.equal(workspace.cryptoQuoteProvider, 'coinbase')

  await portfolio.execute({
    type: 'update-workspace',
    id: workspaceId,
    input: {
      name: workspace.name,
      baseCurrency: workspace.baseCurrency,
      exchangeRateProvider: workspace.exchangeRateProvider,
      exchangeRateRefreshIntervalMinutes:
        workspace.exchangeRateRefreshIntervalMinutes,
      stockQuoteProvider: 'yahoo',
      cryptoQuoteProvider: 'yahoo'
    }
  })
  workspace = (await portfolio.load()).data.workspaces[0]
  assert.equal(workspace.stockQuoteProvider, 'yahoo')
  assert.equal(workspace.cryptoQuoteProvider, 'yahoo')

  const legacyData = JSON.parse(portfolioRepository.content ?? '{}') as {
    workspaces?: Array<Record<string, unknown>>
  }
  delete legacyData.workspaces?.[0]?.stockQuoteProvider
  delete legacyData.workspaces?.[0]?.cryptoQuoteProvider
  portfolioRepository.content = JSON.stringify(legacyData)
  const migrated = new PortfolioService(
    portfolioRepository,
    integrationRepository
  )
  workspace = (await migrated.load()).data.workspaces[0]
  assert.equal(workspace.stockQuoteProvider, 'eastmoney')
  assert.equal(workspace.cryptoQuoteProvider, 'coinbase')
})

test('client portfolio responses redact credentials and preserve them on edit', async () => {
  const {
    portfolio,
    integrationRepository,
    workspaceId,
    accountId
  } = await createOkxPortfolio()
  const state = await loadPortfolioClientState(portfolio)
  const serializedState = JSON.stringify(state)
  const backup = JSON.parse(await portfolio.exportActiveWorkspace()) as {
    format: string
    workspace: { id: string }
    integrations: Array<{
      accountId: string
      provider: string
      api: { apiKey: string; secretKey: string; passphrase: string }
    }>
    account?: unknown
  }

  assert.equal(serializedState.includes('api-key-secret'), false)
  assert.equal(serializedState.includes('secret-key-secret'), false)
  assert.equal(serializedState.includes('passphrase-secret'), false)
  assert.equal(backup.format, 'chromie-workspace')
  assert.equal(backup.workspace.id, workspaceId)
  assert.equal(backup.account, undefined)
  assert.deepEqual(backup.integrations, [
    {
      accountId,
      provider: 'Okx',
      api: {
        apiKey: 'api-key-secret',
        secretKey: 'secret-key-secret',
        passphrase: 'passphrase-secret'
      }
    }
  ])
  assert.equal(portfolio.inspectBackup(JSON.stringify(backup))?.workspace.id, workspaceId)
  assert.deepEqual(state.integrations, [
    {
      accountId,
      provider: 'Okx',
      credentialConfigured: true
    }
  ])

  const workspace = state.data.workspaces.find((item) => item.id === workspaceId)!
  const account = workspace.accounts.find((item) => item.id === accountId)!
  const result = await executePortfolioClientCommand(portfolio, {
    type: 'update-account',
    workspaceId,
    accountId,
    input: {
      name: 'OKX 长期账户',
      type: 'Okx',
      sync: account.sync,
      tagIds: account.tagIds,
      integration: {
        provider: 'Okx',
        api: { credential: { mode: 'keep' } }
      }
    }
  })

  assert.equal(JSON.stringify(result).includes('secret-key-secret'), false)
  assert.match(integrationRepository.content ?? '', /api-key-secret/)
  assert.match(integrationRepository.content ?? '', /secret-key-secret/)
  assert.match(integrationRepository.content ?? '', /passphrase-secret/)
})

test('workspace backup restores synchronization credentials under remapped account IDs', async () => {
  const { portfolio, workspaceId, accountId } = await createOkxPortfolio()
  const content = await portfolio.exportActiveWorkspace()
  const restoredIntegrationRepository = new MemoryRepository()
  const restored = new PortfolioService(
    new MemoryRepository(),
    restoredIntegrationRepository
  )

  const importedWorkspaceId = await restored.importBackup(content)
  const state = await loadPortfolioClientState(restored)
  const importedWorkspace = state.data.workspaces.find(
    (workspace) => workspace.id === importedWorkspaceId
  )!
  const importedAccount = importedWorkspace.accounts[0]

  assert.notEqual(importedWorkspaceId, workspaceId)
  assert.notEqual(importedAccount.id, accountId)
  assert.deepEqual(importedAccount.sync, { interval: 30 })
  assert.deepEqual(state.integrations, [
    {
      accountId: importedAccount.id,
      provider: 'Okx',
      credentialConfigured: true
    }
  ])
  assert.match(restoredIntegrationRepository.content ?? '', /api-key-secret/)
  assert.match(restoredIntegrationRepository.content ?? '', /secret-key-secret/)
  assert.match(restoredIntegrationRepository.content ?? '', /passphrase-secret/)
})

test('workspace backups without synchronization credentials remain importable', async () => {
  const { portfolio } = await createOkxPortfolio()
  const legacyBackup = JSON.parse(await portfolio.exportActiveWorkspace()) as {
    integrations?: unknown
  }
  delete legacyBackup.integrations

  const inspected = portfolio.inspectBackup(JSON.stringify(legacyBackup))

  assert.deepEqual(inspected?.integrations, [])
})

test('tags on synchronized positions survive subsequent refreshes', async () => {
  const { portfolio, workspaceId, accountId, tagId } = await createOkxPortfolio()
  const syncedAt = '2026-09-02T08:00:00.000Z'
  const integration = (await portfolio.load()).integrations[0]

  await portfolio.replaceSynchronizedPositions(
    workspaceId,
    accountId,
    integration,
    [
      {
        market: 'CC',
        symbol: 'BTC',
        name: 'Bitcoin',
        currency: 'USD',
        quantity: 1,
        price: 100
      }
    ],
    syncedAt
  )
  const initialState = await portfolio.load()
  const positionId = initialState.data.workspaces[0].accounts[0].positions[0].id
  await portfolio.execute({
    type: 'set-position-tags',
    workspaceId,
    accountId,
    positionId,
    tagIds: [tagId]
  })

  await portfolio.replaceSynchronizedPositions(
    workspaceId,
    accountId,
    integration,
    [
      {
        market: 'CC',
        symbol: 'BTC',
        name: 'Bitcoin',
        currency: 'USD',
        quantity: 2,
        price: 110
      }
    ],
    '2026-09-02T08:05:00.000Z'
  )

  const refreshedState = await portfolio.load()
  const refreshedPosition = refreshedState.data.workspaces[0].accounts[0].positions[0]
  assert.equal(refreshedPosition.quantity, 2)
  assert.deepEqual(refreshedPosition.tagIds, [tagId])

  await portfolio.execute({ type: 'delete-tag', workspaceId, tagId })
  const stateAfterDelete = await portfolio.load()
  assert.deepEqual(stateAfterDelete.data.workspaces[0].tags, [])
  assert.deepEqual(stateAfterDelete.data.workspaces[0].accounts[0].tagIds, [])
  assert.deepEqual(
    stateAfterDelete.data.workspaces[0].accounts[0].positions[0].tagIds,
    []
  )
})

test('华盛交易密码 stays in integration state and is redacted from clients', async () => {
  const portfolioRepository = new MemoryRepository()
  const integrationRepository = new MemoryRepository()
  const portfolio = new PortfolioService(portfolioRepository, integrationRepository)
  const workspace = await portfolio.execute({
    type: 'create-workspace',
    input: { name: '华盛资产', baseCurrency: 'HKD' }
  })
  const workspaceId = workspace.result as string
  const account = await portfolio.execute({
    type: 'create-account',
    workspaceId,
    input: {
      name: '华盛通',
      type: 'Hstong',
      sync: { interval: 30 },
      integration: {
        provider: 'Hstong',
        gateway: {
          host: '127.0.0.1',
          port: 11111,
          credential: {
            mode: 'replace',
            value: { tradingPassword: 'trading-password-secret' }
          }
        }
      }
    }
  })
  const accountId = account.result as string

  const state = await loadPortfolioClientState(portfolio)
  assert.equal(JSON.stringify(state).includes('trading-password-secret'), false)
  assert.deepEqual(state.integrations, [
    {
      accountId,
      provider: 'Hstong',
      gateway: {
        host: '127.0.0.1',
        port: 11111,
        credentialConfigured: true
      }
    }
  ])
  assert.match(integrationRepository.content ?? '', /trading-password-secret/)

  await executePortfolioClientCommand(portfolio, {
    type: 'update-account',
    workspaceId,
    accountId,
    input: {
      name: '华盛通长期账户',
      type: 'Hstong',
      sync: { interval: 60 },
      integration: {
        provider: 'Hstong',
        gateway: {
          host: 'localhost',
          port: 11111,
          credential: { mode: 'keep' }
        }
      }
    }
  })
  assert.match(integrationRepository.content ?? '', /trading-password-secret/)
})

test('pre-tag portfolio data is rejected without compatibility migration', async () => {
  const portfolioRepository = new MemoryRepository()
  const integrationRepository = new MemoryRepository()
  const legacyWorkspace = {
    id: 'workspace-1',
    name: '家庭资产',
    baseCurrency: 'CNY',
    exchangeRateProvider: 'coinbase',
    exchangeRateRefreshIntervalMinutes: 15,
    holders: [{ id: 'holder-1', name: '家庭' }],
    accounts: [
      {
        id: 'account-1',
        name: '银行卡',
        type: 'General',
        holderId: 'holder-1',
        positions: []
      }
    ],
    positionGroups: []
  }
  const portfolio = new PortfolioService(
    portfolioRepository,
    integrationRepository
  )
  portfolioRepository.content = JSON.stringify({
    version: 1,
    activeWorkspaceId: legacyWorkspace.id,
    workspaces: [legacyWorkspace],
    snapshots: []
  })
  await assert.rejects(
    portfolio.load(),
    /资产数据文件损坏或版本不受支持，原文件已保留/
  )
  assert.match(portfolioRepository.content, /"holders"/)

  const inspectedBackup = portfolio.inspectBackup(JSON.stringify({
    format: 'chromie-account',
    version: 1,
    exportedAt: '2026-09-01T00:00:00.000Z',
    account: legacyWorkspace,
    snapshots: []
  }))
  assert.equal(inspectedBackup, null)
})

test('invalid nested positions reject the whole stored portfolio without rewriting it', async () => {
  const portfolioRepository = new MemoryRepository()
  const original = JSON.stringify({
    version: 1,
    activeWorkspaceId: 'workspace-1',
    workspaces: [{
      id: 'workspace-1',
      name: '家庭资产',
      baseCurrency: 'CNY',
      exchangeRateProvider: 'coinbase',
      exchangeRateRefreshIntervalMinutes: 15,
      stockQuoteProvider: 'eastmoney',
      cryptoQuoteProvider: 'coinbase',
      tags: [],
      accounts: [{
        id: 'account-1',
        name: '手工账户',
        type: 'General',
        tagIds: [],
        positions: [{ id: '', market: 'US' }]
      }]
    }],
    snapshots: []
  })
  portfolioRepository.content = original
  const portfolio = new PortfolioService(
    portfolioRepository,
    new MemoryRepository()
  )

  await assert.rejects(portfolio.load(), /资产数据文件损坏/)
  assert.equal(portfolioRepository.content, original)
})
