import assert from 'node:assert/strict'
import test from 'node:test'

import type { StringStore } from '../src/main/infra/file-store'
import { FilePortfolioStateRepository } from '../src/main/repository/portfolio-state-repository'
import { PortfolioService } from '../src/main/service/portfolio-service'

class MemoryStore implements StringStore {
  constructor(public content: string | null = null) {}

  read(): Promise<string | null> {
    return Promise.resolve(this.content)
  }

  write(content: string): Promise<void> {
    this.content = content
    return Promise.resolve()
  }

  load(): Promise<string | null> {
    return this.read()
  }

  save(content: string): Promise<void> {
    return this.write(content)
  }
}

test('portfolio state falls back to legacy files and saves one combined envelope', async () => {
  const stateStore = new MemoryStore()
  const portfolioStore = new MemoryStore('{"version":1,"workspaces":[]}')
  const integrationStore = new MemoryStore('{"version":1,"integrations":[]}')
  const repository = new FilePortfolioStateRepository(
    stateStore,
    portfolioStore,
    integrationStore
  )

  assert.deepEqual(await repository.load(), {
    portfolio: portfolioStore.content,
    integrations: integrationStore.content,
    source: 'legacy'
  })

  await repository.save(portfolioStore.content!, integrationStore.content!)
  const envelope = JSON.parse(stateStore.content!) as Record<string, unknown>
  assert.equal(envelope.format, 'chromie-portfolio-state')
  assert.equal(envelope.version, 1)
  assert.deepEqual(envelope.portfolio, { version: 1, workspaces: [] })
  assert.deepEqual(envelope.integrations, { version: 1, integrations: [] })
  assert.equal((await repository.load()).source, 'state')
})

test('portfolio state rejects a corrupt combined envelope without using legacy data', async () => {
  const repository = new FilePortfolioStateRepository(
    new MemoryStore('{broken'),
    new MemoryStore('{"legacy":true}'),
    new MemoryStore('{"legacy":true}')
  )

  await assert.rejects(repository.load(), /资产状态文件损坏/)
})

test('portfolio service migrates valid legacy data into the combined state file', async () => {
  const stateStore = new MemoryStore()
  const portfolioStore = new MemoryStore(JSON.stringify({
    version: 1,
    activeWorkspaceId: null,
    workspaces: [],
    snapshots: []
  }))
  const integrationStore = new MemoryStore(JSON.stringify({
    version: 1,
    integrations: []
  }))
  const portfolio = new PortfolioService(new FilePortfolioStateRepository(
    stateStore,
    portfolioStore,
    integrationStore
  ))

  await portfolio.load()

  assert.ok(stateStore.content)
  assert.equal(portfolioStore.content?.includes('activeWorkspaceId'), true)
  assert.equal(integrationStore.content?.includes('integrations'), true)
  assert.equal((await new FilePortfolioStateRepository(
    stateStore,
    portfolioStore,
    integrationStore
  ).load()).source, 'state')
})

test('portfolio service writes compatible stored-state migrations back atomically', async () => {
  const stateStore = new MemoryStore(JSON.stringify({
    format: 'chromie-portfolio-state',
    version: 1,
    portfolio: {
      version: 1,
      activeWorkspaceId: 'workspace-1',
      workspaces: [
        {
          id: 'workspace-1',
          name: '旧工作区',
          baseCurrency: 'CNY',
          exchangeRateProvider: 'coinbase',
          exchangeRateRefreshIntervalMinutes: 15,
          stockQuoteProvider: 'eastmoney',
          cryptoQuoteProvider: 'coinbase',
          tags: [{ id: 'tag-1', name: '长期持有', color: 'blue' }],
          accounts: []
        }
      ],
      snapshots: []
    },
    integrations: { version: 1, integrations: [] }
  }))
  const portfolio = new PortfolioService(new FilePortfolioStateRepository(
    stateStore,
    new MemoryStore(),
    new MemoryStore()
  ))

  await portfolio.load()

  const migrated = JSON.parse(stateStore.content!) as {
    portfolio: { workspaces: Array<{ tags: Array<{ note?: string }> }> }
    integrations: { proxyProfiles?: unknown[] }
  }
  assert.equal(migrated.portfolio.workspaces[0].tags[0].note, '')
  assert.deepEqual(migrated.integrations.proxyProfiles, [])
})
