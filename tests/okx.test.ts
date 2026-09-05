import assert from 'node:assert/strict'
import test from 'node:test'

import { syncOkxPositions } from '../src/main/infra/okx'

const credentials = {
  apiKey: 'api-key',
  secretKey: 'secret-key',
  passphrase: 'passphrase'
}

test('merges OKX trading, funding and Simple Earn Flexible balances', async () => {
  const requestedPaths: string[] = []
  let simpleEarnHeaders: Headers | undefined

  const result = await syncOkxPositions(credentials, async (input, init) => {
    const url = new URL(input)
    requestedPaths.push(`${url.pathname}${url.search}`)

    let data: unknown
    if (url.pathname === '/api/v5/account/balance') {
      data = [{
        details: [
          { ccy: 'BTC', eq: '1', eqUsd: '60000' },
          { ccy: 'USDT', eq: '25', eqUsd: '25' }
        ]
      }]
    } else if (url.pathname === '/api/v5/asset/balances') {
      data = [
        { ccy: 'BTC', bal: '0.25' },
        { ccy: 'ETH', bal: '2' }
      ]
    } else if (url.pathname === '/api/v5/finance/savings/balance') {
      simpleEarnHeaders = new Headers(init?.headers)
      data = [
        {
          ccy: 'BTC',
          amt: '0.5',
          loanAmt: '0.4',
          pendingAmt: '0.1',
          earnings: '0.01'
        },
        { ccy: 'ETH', amt: '1.5' },
        { ccy: 'USDT', amt: '100' },
        { ccy: 'ZERO', amt: '0' },
        { ccy: 'INVALID', amt: 'not-a-number' }
      ]
    } else if (url.pathname === '/api/v5/market/tickers') {
      data = [
        { instId: 'BTC-USDT', last: '60000' },
        { instId: 'ETH-USDC', last: '3000' }
      ]
    } else {
      throw new Error(`Unexpected OKX request: ${url.pathname}`)
    }

    return new Response(JSON.stringify({ code: '0', data, msg: '' }), { status: 200 })
  })

  assert.deepEqual(requestedPaths.sort(), [
    '/api/v5/account/balance',
    '/api/v5/asset/balances',
    '/api/v5/finance/savings/balance',
    '/api/v5/market/tickers?instType=SPOT'
  ])
  assert.equal(simpleEarnHeaders?.get('OK-ACCESS-KEY'), credentials.apiKey)
  assert.equal(simpleEarnHeaders?.get('OK-ACCESS-PASSPHRASE'), credentials.passphrase)
  assert.ok(simpleEarnHeaders?.get('OK-ACCESS-SIGN'))
  assert.ok(simpleEarnHeaders?.get('OK-ACCESS-TIMESTAMP'))
  assert.deepEqual(result.positions, [
    {
      market: 'CC',
      symbol: 'BTC',
      name: 'BTC',
      currency: 'USD',
      quantity: 1.75,
      price: 60000
    },
    {
      market: 'CC',
      symbol: 'ETH',
      name: 'ETH',
      currency: 'USD',
      quantity: 3.5,
      price: 3000
    },
    {
      market: 'CC',
      symbol: 'USDT',
      name: 'USDT',
      currency: 'USD',
      quantity: 125,
      price: 1
    }
  ])
  assert.ok(Number.isFinite(Date.parse(result.syncedAt)))
})
