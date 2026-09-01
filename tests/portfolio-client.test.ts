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
  const createdAccount = await portfolio.execute(
    {
      type: 'create-product-account',
      input: { name: '家庭资产', anchorCurrency: 'CNY' }
    }
  )
  const accountId = createdAccount.result as string
  const createdAccountGroup = await portfolio.execute(
    {
      type: 'create-account-group',
      productAccountId: accountId,
      input: { name: 'Moon' }
    }
  )
  const accountGroupId = createdAccountGroup.result as string
  const createdAssetAccount = await portfolio.execute(
    {
      type: 'create-asset-account',
      productAccountId: accountId,
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
  const assetAccountId = createdAssetAccount.result as string
  await portfolio.execute({
    type: 'set-account-group-accounts',
    productAccountId: accountId,
    groupId: accountGroupId,
    assetAccountIds: [assetAccountId]
  })

  return {
    portfolio,
    integrationRepository,
    accountId,
    assetAccountId
  }
}

test('client portfolio responses redact credentials and preserve them on edit', async () => {
  const {
    portfolio,
    integrationRepository,
    accountId,
    assetAccountId
  } = await createOkxPortfolio()
  const state = await loadPortfolioClientState(portfolio)
  const serializedState = JSON.stringify(state)

  assert.equal(serializedState.includes('api-key-secret'), false)
  assert.equal(serializedState.includes('secret-key-secret'), false)
  assert.equal(serializedState.includes('passphrase-secret'), false)
  assert.deepEqual(state.integrations, [
    {
      assetAccountId,
      provider: 'Okx',
      credentialConfigured: true
    }
  ])

  const account = state.data.productAccounts.find((item) => item.id === accountId)!
  const assetAccount = account.assetAccounts.find((item) => item.id === assetAccountId)!
  const result = await executePortfolioClientCommand(portfolio, {
    type: 'update-asset-account',
    productAccountId: accountId,
    assetAccountId,
    input: {
      name: 'OKX 长期账户',
      type: 'Okx',
      sync: assetAccount.sync,
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

test('legacy holder backups are rejected after the one-time migration boundary', async () => {
  const portfolioRepository = new MemoryRepository()
  const integrationRepository = new MemoryRepository()
  const legacyAccount = {
    id: 'account-1',
    name: '家庭资产',
    anchorCurrency: 'CNY',
    exchangeRateProvider: 'coinbase',
    exchangeRateRefreshIntervalMinutes: 15,
    holders: [{ id: 'holder-1', name: '家庭' }],
    assetAccounts: [
      {
        id: 'asset-account-1',
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
    activeProductAccountId: legacyAccount.id,
    productAccounts: [legacyAccount],
    snapshots: []
  })
  const loaded = await portfolio.load()
  assert.deepEqual(loaded.data.productAccounts, [])
  assert.match(portfolioRepository.content, /"holders"/)

  const inspectedBackup = portfolio.inspectBackup(JSON.stringify({
    format: 'chromie-account',
    version: 1,
    exportedAt: '2026-09-01T00:00:00.000Z',
    account: legacyAccount,
    snapshots: []
  }))
  assert.equal(inspectedBackup, null)
})
