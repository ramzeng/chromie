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
  const holderId = crypto.randomUUID()
  await portfolio.execute(
    {
      type: 'update-product-account',
      id: accountId,
      input: {
        name: '家庭资产',
        anchorCurrency: 'CNY',
        exchangeRateProvider: 'coinbase',
        exchangeRateRefreshIntervalMinutes: 15,
        holders: [{ id: holderId, name: 'Moon' }]
      }
    }
  )
  const createdAssetAccount = await portfolio.execute(
    {
      type: 'create-asset-account',
      productAccountId: accountId,
      input: {
        name: 'OKX',
        type: 'Okx',
        holderId,
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

  return {
    portfolio,
    integrationRepository,
    accountId,
    assetAccountId: createdAssetAccount.result as string
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
      holderId: assetAccount.holderId,
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
