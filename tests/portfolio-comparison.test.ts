import assert from 'node:assert/strict'
import test from 'node:test'

import type { Account, Position, Workspace } from '../src/shared/portfolio'
import {
  comparePortfolios,
  describeComparison,
  formatComparisonReport
} from '../src/shared/portfolio-comparison'

function position(overrides: Partial<Position> = {}): Position {
  return {
    id: 'position-1',
    market: 'US',
    symbol: 'AAPL',
    name: 'Apple',
    currency: 'USD',
    quantity: 10,
    price: 100,
    tagIds: [],
    ...overrides
  }
}

function account(positions: Position[], overrides: Partial<Account> = {}): Account {
  return {
    id: 'account-1',
    name: '富途',
    type: 'Futu',
    tagIds: [],
    positions,
    ...overrides
  }
}

function workspace(accounts: Account[]): Workspace {
  return {
    id: 'workspace-1',
    name: '家庭资产',
    baseCurrency: 'CNY',
    exchangeRateProvider: 'coinbase',
    exchangeRateRefreshIntervalMinutes: 15,
    stockQuoteProvider: 'eastmoney',
    cryptoQuoteProvider: 'coinbase',
    tags: [],
    accounts
  }
}

function assertClose(actual: number | undefined, expected: number): void {
  assert.ok(actual !== undefined, 'expected a value')
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} !== ${expected}`)
}

test('comparison splits a held position into price, exchange rate and quantity effects', () => {
  const result = comparePortfolios(
    {
      workspace: workspace([account([position({ quantity: 10, price: 100 })])]),
      rates: { USD: 1, CNY: 7 }
    },
    {
      workspace: workspace([account([position({ quantity: 12, price: 110 })])]),
      rates: { USD: 1, CNY: 7.2 }
    },
    'CNY'
  )

  assertClose(result.fromValue, 7000)
  assertClose(result.toValue, 12 * 110 * 7.2)
  assertClose(result.effects.price, 10 * 10 * 7)
  assertClose(result.effects.exchangeRate, 10 * 110 * 0.2)
  assertClose(result.effects.bought, 2 * 110 * 7.2)
  assertClose(result.effects.sold, 0)
  assertClose(result.marketChange + result.tradeChange, result.change)
  assertClose(result.marketChange, 700 + 220)
  assert.equal(result.direction, 'up')
  assert.equal(result.positions[0].kind, 'increased')
  assertClose(result.positions[0].priceChangePercent, 10)
  assertClose(result.currencies[0].rateChangePercent, 100 * 0.2 / 7)
})

test('comparison matches positions by account, market, symbol and currency instead of id', () => {
  const result = comparePortfolios(
    {
      workspace: workspace([account([
        position({ id: 'old-id' }),
        position({ id: 'sold', symbol: 'TSLA', name: 'Tesla', price: 200 })
      ])]),
      rates: { USD: 1, CNY: 7 }
    },
    {
      workspace: workspace([account([
        position({ id: 'new-id' }),
        position({ id: 'bought', symbol: 'NVDA', name: 'NVIDIA', quantity: 1, price: 500 })
      ])]),
      rates: { USD: 1, CNY: 7 }
    },
    'CNY'
  )

  const kinds = Object.fromEntries(result.positions.map((item) => [item.symbol, item.kind]))
  assert.deepEqual(kinds, { AAPL: 'unchanged', TSLA: 'closed', NVDA: 'opened' })
  assertClose(result.effects.sold, -10 * 200 * 7)
  assertClose(result.effects.bought, 500 * 7)
  assertClose(result.tradeChange, result.change)
  assertClose(result.marketChange, 0)
})

test('comparison excludes positions that cannot be valued on either side', () => {
  const result = comparePortfolios(
    {
      workspace: workspace([account([
        position(),
        position({ id: 'p2', symbol: 'SAP', currency: 'EUR' })
      ])]),
      rates: { USD: 1, CNY: 7 }
    },
    {
      workspace: workspace([account([
        position({ price: 90 }),
        position({ id: 'p2', symbol: 'SAP', currency: 'EUR' })
      ])]),
      rates: { USD: 1, CNY: 7 }
    },
    'CNY'
  )

  assert.equal(result.unavailableCount, 1)
  assert.equal(result.isComplete, false)
  assert.equal(result.positions.at(-1)?.unavailableReason, 'missing-rate')
  assertClose(result.change, -10 * 10 * 7)
  assert.equal(result.direction, 'down')
  assert.equal(result.accounts[0].unavailableCount, 1)
})

test('comparison insights separate market moves from trades', () => {
  const result = comparePortfolios(
    {
      workspace: workspace([account([position({ quantity: 10, price: 100 })])]),
      rates: { USD: 1, CNY: 7 }
    },
    {
      workspace: workspace([account([position({ quantity: 20, price: 90 })])]),
      rates: { USD: 1, CNY: 7 }
    },
    'CNY'
  )
  const insights = describeComparison(result)

  assert.equal(result.direction, 'up')
  assert.equal(insights.headline, '资产增加 5,600.00 CNY（+80.00%）')
  assert.equal(insights.summary, '其中市场下跌亏了 700.00，净转入 6,300.00')
  assert.equal(insights.tradeSummary, '买入 6,300.00，全部是新投入的资金')
  assert.deepEqual(insights.drivers.map((driver) => driver.key), ['price', 'bought'])
  assert.equal(insights.drivers[0].title, '价格下跌')
  assert.deepEqual(insights.drivers[0].items.map((item) => item.label), ['Apple'])
})

test('comparison driver items only list contributors in the same direction as the total', () => {
  const result = comparePortfolios(
    {
      workspace: workspace([account([
        position({ quantity: 1000, price: 100 }),
        position({ id: 'p2', symbol: 'MSFT', name: 'Microsoft', quantity: 1000, price: 100 })
      ])]),
      rates: { USD: 1, CNY: 7 }
    },
    {
      workspace: workspace([account([
        position({ quantity: 2000, price: 100 }),
        position({ id: 'p2', symbol: 'MSFT', name: 'Microsoft', quantity: 900, price: 100 })
      ])]),
      rates: { USD: 1, CNY: 7 }
    },
    'CNY'
  )
  const insights = describeComparison(result)
  const bought = insights.drivers.find((driver) => driver.key === 'bought')!
  const sold = insights.drivers.find((driver) => driver.key === 'sold')!

  assertClose(bought.value, 1000 * 100 * 7)
  assertClose(sold.value, -100 * 100 * 7)
  assert.deepEqual(bought.items.map((item) => [item.label, item.detail]), [['Apple', '加仓']])
  assert.deepEqual(sold.items.map((item) => [item.label, item.detail]), [['Microsoft', '减仓']])
  assert.equal(insights.headline, '资产增加 63.00 万 CNY（+45.00%）')
  assertClose(result.rebalanceAmount, 100 * 100 * 7)
  assert.equal(
    insights.summary,
    '其中净转入 63.00 万（另有 7.00 万在持仓间调仓）'
  )
  assert.equal(
    insights.tradeSummary,
    '买入 70.00 万，其中 7.00 万来自卖出其他持仓（内部调仓），其余 63.00 万是新投入的资金'
  )
})

test('comparison report renders a markdown summary', () => {
  const result = comparePortfolios(
    { workspace: workspace([account([position()])]), rates: { USD: 1, CNY: 7 } },
    { workspace: workspace([account([position({ price: 120 })])]), rates: { USD: 1, CNY: 7 } },
    'CNY'
  )
  const report = formatComparisonReport(result, { from: '快照 A', to: '当前数据' })

  assert.match(report, /^# 资产对比报告/)
  assert.match(report, /快照 A → 当前数据，金额单位 CNY/)
  assert.match(report, /\*\*资产增加 1,400\.00 CNY（\+20\.00%）\*\*，其中市场上涨赚了 1,400\.00。/)
  assert.match(report, /- 价格上涨 \+1,400\.00 CNY：Apple \+1,400\.00/)
  assert.match(report, /\| Apple AAPL \| 富途 \| 未买卖 \| \+20\.00% \| \+1,400\.00 \| \+1,400\.00 \| 0\.00 \|/)
})

test('comparison driver items list every contributor and add up to the driver total', () => {
  const symbols = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN']
  const holdings = (prices: number[]) =>
    workspace([account(symbols.map((symbol, index) =>
      position({ id: symbol, symbol, name: symbol, price: prices[index] })
    ))])
  const result = comparePortfolios(
    { workspace: holdings([100, 100, 100, 100, 100]), rates: { USD: 1, CNY: 7 } },
    { workspace: holdings([90, 80, 70, 95, 101]), rates: { USD: 1, CNY: 7 } },
    'CNY'
  )
  const price = describeComparison(result).drivers.find((driver) => driver.key === 'price')!

  assert.deepEqual(price.items.map((item) => item.label), ['NVDA', 'MSFT', 'AAPL', 'TSLA', 'AMZN'])
  assertClose(price.items.at(-1)?.value, 10 * 7)
  assertClose(price.items.reduce((total, item) => total + item.value, 0), price.value)
})
