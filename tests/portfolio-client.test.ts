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
    account?: unknown
  }

  assert.equal(serializedState.includes('api-key-secret'), false)
  assert.equal(serializedState.includes('secret-key-secret'), false)
  assert.equal(serializedState.includes('passphrase-secret'), false)
  assert.equal(backup.format, 'chromie-workspace')
  assert.equal(backup.workspace.id, workspaceId)
  assert.equal(backup.account, undefined)
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

test('tags on synchronized positions survive subsequent refreshes', async () => {
  const { portfolio, workspaceId, accountId, tagId } = await createOkxPortfolio()
  const syncedAt = '2026-09-02T08:00:00.000Z'

  await portfolio.execute({
    type: 'replace-positions',
    workspaceId,
    accountId,
    positions: [
      {
        market: 'CC',
        symbol: 'BTC',
        name: 'Bitcoin',
        currency: 'USD',
        quantity: 1,
        price: 100
      }
    ],
    lastSyncedAt: syncedAt
  })
  const initialState = await portfolio.load()
  const positionId = initialState.data.workspaces[0].accounts[0].positions[0].id
  await portfolio.execute({
    type: 'set-position-tags',
    workspaceId,
    accountId,
    positionId,
    tagIds: [tagId]
  })

  await portfolio.execute({
    type: 'replace-positions',
    workspaceId,
    accountId,
    positions: [
      {
        market: 'CC',
        symbol: 'BTC',
        name: 'Bitcoin',
        currency: 'USD',
        quantity: 2,
        price: 110
      }
    ],
    lastSyncedAt: '2026-09-02T08:05:00.000Z'
  })

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

test('华盛交易密码 stays in secure integration state and is redacted from clients', async () => {
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
  const loaded = await portfolio.load()
  assert.deepEqual(loaded.data.workspaces, [])
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
