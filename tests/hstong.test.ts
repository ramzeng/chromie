import assert from 'node:assert/strict'
import { createServer, type IncomingMessage } from 'node:http'
import test from 'node:test'

import { syncHstongPositions } from '../src/main/infra/hstong'

type GatewayRequest = {
  path: string
  body: {
    timeout_sec?: unknown
    params?: Record<string, unknown>
  }
}

async function readJson(request: IncomingMessage): Promise<GatewayRequest['body']> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as GatewayRequest['body']
}

test('syncs 华盛 holdings, cash and quotes through the local Gateway', async (context) => {
  const requests: GatewayRequest[] = []
  let loggedIn = false
  const server = createServer(async (request, response) => {
    const body = await readJson(request)
    const path = request.url ?? ''
    requests.push({ path, body })
    const exchangeType = body.params?.exchangeType
    let data: unknown = {}

    if (path === '/trade/TradeLogin') {
      assert.equal(body.params?.password, 'W1U8iZIppSE+mBMtzy9vZQ==')
      loggedIn = true
      data = { success: true }
    } else if (path.startsWith('/trade/') && !loggedIn) {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ ok: false, err: '1012 用户未登录', data: {} }))
      return
    } else if (path === '/trade/TradeQueryHoldsList') {
      const holdsList = exchangeType === 'K'
        ? [{
            stockName: '小米集团',
            currentAmount: '20',
            stockCode: '01810.HK',
            stockType: '0'
          }]
        : exchangeType === 'P'
          ? [{
              stockName: 'Apple',
              currentAmount: '2',
              stockCode: 'AAPL.US',
              stockType: '0'
            }]
          : exchangeType === 'v'
            ? [{
                stockName: '沪深 300 ETF',
                currentAmount: '100',
                stockCode: '159919',
                stockType: '1'
              }]
            : []
      data = { holdsList }
    } else if (path === '/trade/TradeQueryMarginFundInfo') {
      data = {
        enableBalance:
          exchangeType === 'K'
            ? '123.45'
            : exchangeType === 'P'
              ? '22'
              : '1000'
      }
    } else if (path === '/hq/BasicQot') {
      const securities = body.params?.security as Array<{
        dataType: number
        code: string
      }>
      data = {
        basicQot: securities.map((security) => ({
          security,
          lastPrice:
            security.code === '01810.HK'
              ? 35.5
              : security.code === 'AAPL'
                ? 250
                : 4.2
        }))
      }
    }

    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ ok: true, err: '', data }))
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  }))
  const address = server.address()
  assert.ok(address && typeof address === 'object')

  const result = await syncHstongPositions({
    host: '127.0.0.1',
    port: address.port,
    tradingPassword: '123456'
  })

  assert.equal(result.marketCount, 4)
  assert.ok(Number.isFinite(Date.parse(result.syncedAt)))
  assert.deepEqual(
    result.positions.find((position) => position.symbol === '01810'),
    {
      market: 'HK',
      symbol: '01810',
      name: '小米集团',
      currency: 'HKD',
      quantity: 20,
      price: 35.5
    }
  )
  assert.deepEqual(
    result.positions.find((position) => position.symbol === 'AAPL'),
    {
      market: 'US',
      symbol: 'AAPL',
      name: 'Apple',
      currency: 'USD',
      quantity: 2,
      price: 250
    }
  )
  assert.deepEqual(
    result.positions.find((position) => position.symbol === '159919'),
    {
      market: 'CN',
      symbol: '159919',
      name: '沪深 300 ETF',
      currency: 'CNY',
      quantity: 100,
      price: 4.2
    }
  )
  assert.equal(
    result.positions.filter(
      (position) => position.symbol === 'CASH' && position.currency === 'CNY'
    ).length,
    1
  )
  assert.equal(
    requests.filter((request) => request.path === '/trade/TradeQueryHoldsList').length,
    8
  )
  assert.equal(
    requests.filter((request) => request.path === '/trade/TradeQueryMarginFundInfo').length,
    8
  )
  assert.equal(
    requests.filter((request) => request.path === '/trade/TradeLogin').length,
    1
  )
  assert.ok(requests.some((request) => request.path === '/hq/Subscribe'))
  assert.ok(requests.some((request) => request.path === '/hq/Unsubscribe'))
})

test('rejects non-loopback 华盛 Gateway addresses', async () => {
  await assert.rejects(
    syncHstongPositions({ host: '192.0.2.1', port: 11111 }),
    /仅允许连接本机地址/
  )
})
