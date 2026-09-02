import assert from 'node:assert/strict'
import test from 'node:test'

import type { Position } from '../src/shared/portfolio'
import { valuePositions } from '../src/shared/valuation'

function position(overrides: Partial<Position> = {}): Position {
  return {
    id: 'position-1',
    market: 'US',
    symbol: 'AAPL',
    name: 'Apple',
    currency: 'USD',
    quantity: 2,
    price: 100,
    tagIds: [],
    ...overrides
  }
}

test('valuation is incomplete when any position has no price', () => {
  const result = valuePositions([
    position(),
    position({ id: 'position-2', symbol: 'MSFT', price: undefined })
  ], 'USD')

  assert.equal(result.totalConvertedMarketValue, 200)
  assert.equal(result.missingPriceCount, 1)
  assert.equal(result.isComplete, false)
})

test('valuation reports missing prices separately from missing exchange rates', () => {
  const result = valuePositions([
    position({ currency: 'EUR' }),
    position({ id: 'position-2', price: undefined })
  ], 'CNY')

  assert.deepEqual(result.missingCurrencies, ['CNY', 'EUR'])
  assert.equal(result.missingPriceCount, 1)
  assert.equal(result.isComplete, false)
})
