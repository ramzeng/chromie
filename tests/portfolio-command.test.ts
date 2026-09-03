import assert from 'node:assert/strict'
import test from 'node:test'

import { PortfolioService } from '../src/main/service/portfolio-service'
import { normalizeStoredPosition } from '../src/main/service/portfolio-storage'
import { createPositionInputSchema } from '../src/shared/mcp'
import { portfolioCommandSchema } from '../src/shared/portfolio-command'

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

test('portfolio command schema rejects internal, oversized and unknown input', () => {
  assert.equal(portfolioCommandSchema.safeParse({
    type: 'replace-positions',
    workspaceId: 'workspace-1',
    accountId: 'account-1',
    positions: []
  }).success, false)
  assert.equal(portfolioCommandSchema.safeParse({
    type: 'create-workspace',
    input: { name: 'a'.repeat(41), baseCurrency: 'CNY' }
  }).success, false)
  assert.equal(portfolioCommandSchema.safeParse({
    type: 'delete-workspace',
    id: 'workspace-1',
    unexpected: true
  }).success, false)
})

test('accepts mainland OTC funds across storage, command and MCP boundaries', () => {
  const position = {
    id: 'position-fund',
    market: 'CN_OTC_FUND',
    symbol: '017641',
    name: '摩根标普500指数(QDII)人民币A',
    currency: 'CNY',
    quantity: 100,
    price: 1.7044,
    tagIds: []
  }

  assert.equal(normalizeStoredPosition(position)?.market, 'CN_OTC_FUND')
  assert.equal(portfolioCommandSchema.safeParse({
    type: 'save-position',
    workspaceId: 'workspace-1',
    accountId: 'account-1',
    input: {
      market: position.market,
      symbol: position.symbol,
      name: position.name,
      currency: position.currency,
      quantity: position.quantity,
      price: position.price,
      tagIds: []
    }
  }).success, true)
  assert.equal(createPositionInputSchema.safeParse({
    workspace_id: 'workspace-1',
    account_id: 'account-1',
    market: position.market,
    symbol: position.symbol,
    name: position.name,
    currency: position.currency,
    quantity: position.quantity,
    price: position.price,
    tag_ids: []
  }).success, true)
})

test('portfolio service validates commands before mutating or persisting data', async () => {
  const portfolioRepository = new MemoryRepository()
  const integrationRepository = new MemoryRepository()
  const portfolio = new PortfolioService(
    portfolioRepository,
    integrationRepository
  )

  await assert.rejects(
    portfolio.execute({
      type: 'create-workspace',
      input: { name: '', baseCurrency: 'CNY' }
    }),
    /Too small/
  )
  assert.equal(portfolioRepository.content, null)
  assert.equal(integrationRepository.content, null)
  assert.deepEqual((await portfolio.load()).data.workspaces, [])
})
