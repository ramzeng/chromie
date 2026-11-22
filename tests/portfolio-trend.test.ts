import assert from 'node:assert/strict'
import test from 'node:test'

import type { Position, Workspace } from '../src/shared/portfolio'
import { buildPortfolioTrend } from '../src/shared/portfolio-trend'

function workspace(positions: Array<Partial<Position>>): Workspace {
  return {
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
      name: '富途',
      type: 'Futu',
      tagIds: [],
      positions: positions.map((overrides, index) => ({
        id: `position-${index}`,
        market: 'CN',
        symbol: `00000${index}`,
        name: `基金 ${index}`,
        currency: 'CNY',
        quantity: 100,
        price: 10,
        tagIds: [],
        ...overrides
      }))
    }]
  }
}

function assertClose(actual: number | undefined, expected: number): void {
  assert.ok(actual !== undefined, 'expected a value')
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} !== ${expected}`)
}

test('trend chains period returns without counting deposits as gains', () => {
  const trend = buildPortfolioTrend([
    // 输入顺序打乱，结果按时间排序。
    { id: 'c', time: 3, point: { workspace: workspace([{ quantity: 200, price: 9.9 }]) } },
    { id: 'a', time: 1, point: { workspace: workspace([{ quantity: 100, price: 10 }]) } },
    { id: 'b', time: 2, point: { workspace: workspace([{ quantity: 100, price: 11 }]) } }
  ], 'CNY')

  assert.deepEqual(trend.points.map((point) => point.id), ['a', 'b', 'c'])
  assert.deepEqual(trend.points.map((point) => point.value), [1000, 1100, 1980])
  assertClose(trend.periods[0].returnPercent, 10)
  // 第二段：价格 11 → 9.9 下跌 10%，同时加仓 100 份。
  assertClose(trend.periods[1].returnPercent, -10)
  assertClose(trend.periods[1].tradeChange, 100 * 9.9)
  assertClose(trend.points[2].cumulativeReturnPercent, (1.1 * 0.9 - 1) * 100)
  assertClose(trend.cumulativeReturnPercent, -1)
  assertClose(trend.totalChange, 980)
  assertClose(trend.totalMarketChange + trend.totalTradeChange, trend.totalChange)
  assert.equal(trend.isComplete, true)
})

test('trend reports rebalancing between positions separately from net flows', () => {
  const trend = buildPortfolioTrend([
    { id: 'a', time: 1, point: { workspace: workspace([{ quantity: 100 }, { quantity: 100 }]) } },
    { id: 'b', time: 2, point: { workspace: workspace([{ quantity: 50 }, { quantity: 120 }]) } }
  ], 'CNY')

  assertClose(trend.totalTradeChange, -300)
  assertClose(trend.totalRebalanceAmount, 200)
  assertClose(trend.cumulativeReturnPercent, 0)
})

test('trend with a single point has no periods or return', () => {
  const trend = buildPortfolioTrend([
    { id: 'a', time: 1, point: { workspace: workspace([{ price: undefined }]) } }
  ], 'CNY')

  assert.equal(trend.periods.length, 0)
  assert.equal(trend.cumulativeReturnPercent, undefined)
  assert.equal(trend.isComplete, false)
})
