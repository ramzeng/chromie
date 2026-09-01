import assert from 'node:assert/strict'
import test from 'node:test'

import { ExchangeRateService } from '../src/main/service/exchange-rate-service'

class MemoryExchangeRateRepository {
  content: string | null = null

  load(): Promise<string | null> {
    return Promise.resolve(this.content)
  }

  save(content: string): Promise<void> {
    this.content = content
    return Promise.resolve()
  }
}

const fetchedAt = '2026-09-01T00:00:00.000Z'

test('Coinbase refresh only keeps USD, CNY and HKD rates', async () => {
  const repository = new MemoryExchangeRateRepository()
  const service = new ExchangeRateService(repository)

  const snapshot = await service.refresh('coinbase', {
    fetch: async () => ({
      provider: 'coinbase',
      baseCurrency: 'USD',
      rates: {
        USD: 1,
        CNY: 7.12,
        HKD: 7.81,
        EUR: 0.86,
        JPY: 147,
        USDT: 1
      },
      fetchedAt
    })
  })

  assert.deepEqual(snapshot.rates, { USD: 1, CNY: 7.12, HKD: 7.81 })
  assert.deepEqual(JSON.parse(repository.content!).rates, {
    USD: 1,
    CNY: 7.12,
    HKD: 7.81
  })
})

test('loading an existing cache removes unsupported currencies', async () => {
  const repository = new MemoryExchangeRateRepository()
  repository.content = JSON.stringify({
    provider: 'coinbase',
    baseCurrency: 'USD',
    rates: { USD: 1, CNY: 7.12, HKD: 7.81, EUR: 0.86 },
    fetchedAt
  })
  const service = new ExchangeRateService(repository)

  const snapshot = await service.load()

  assert.deepEqual(snapshot?.rates, { USD: 1, CNY: 7.12, HKD: 7.81 })
})
