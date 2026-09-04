import assert from 'node:assert/strict'
import test from 'node:test'

import {
  coinbaseAssetSymbol,
  eastMoneyDirectQuoteId,
  fetchAssetQuote,
  yahooAssetSymbol
} from '../src/main/infra/asset-quotes'
import {
  DesktopService,
  type DesktopServiceDependencies
} from '../src/main/service/desktop-service'
import type { AssetQuoteLookupInput } from '../src/shared/asset-quotes'

test('maps mainland and Hong Kong symbols to East Money quote ids', () => {
  assert.equal(
    eastMoneyDirectQuoteId({ market: 'CN', symbol: '600519' }),
    '1.600519'
  )
  assert.equal(
    eastMoneyDirectQuoteId({ market: 'CN', symbol: '000001' }),
    '0.000001'
  )
  assert.equal(
    eastMoneyDirectQuoteId({ market: 'CN', symbol: '920000' }),
    '0.920000'
  )
  assert.equal(
    eastMoneyDirectQuoteId({ market: 'HK', symbol: '700' }),
    '116.00700'
  )
  assert.equal(
    eastMoneyDirectQuoteId({ market: 'CN_OTC', symbol: '017641' }),
    undefined
  )
  assert.equal(eastMoneyDirectQuoteId({ market: 'US', symbol: 'AAPL' }), undefined)
})

test('extracts stock name, scaled price and market currency from East Money', async () => {
  const requestedUrls: string[] = []
  const quote = await fetchAssetQuote(
    { market: 'CN', symbol: '600519', provider: 'eastmoney' },
    async (input) => {
      requestedUrls.push(String(input))
      return new Response(JSON.stringify({
        data: {
          f43: 129_750,
          f57: '600519',
          f58: '贵州茅台',
          f59: 2
        }
      }), { status: 200 })
    }
  )

  assert.equal(requestedUrls.length, 1)
  assert.match(requestedUrls[0], /secid=1\.600519/)
  assert.deepEqual(quote && {
    market: quote.market,
    source: quote.source,
    name: quote.name,
    currency: quote.currency,
    price: quote.price
  }, {
    market: 'CN',
    source: 'eastmoney',
    name: '贵州茅台',
    currency: 'CNY',
    price: 1297.5
  })
})

test('resolves an East Money OTC fund and loads its latest net asset value', async () => {
  const requestedUrls: string[] = []
  let fundReferer: string | null = null
  const quote = await fetchAssetQuote(
    { market: 'CN_OTC', symbol: '017641', provider: 'eastmoney' },
    async (input, init) => {
      const url = String(input)
      requestedUrls.push(url)
      if (url.startsWith('https://searchapi.eastmoney.com/')) {
        return new Response(JSON.stringify({
          QuotationCodeTable: {
            Data: [{
              Code: '017641',
              Name: '摩根标普500指数(QDII)人民币A',
              Classify: 'OTCFUND',
              MktNum: '150',
              QuoteID: '150.017641'
            }]
          }
        }), { status: 200 })
      }
      fundReferer = new Headers(init?.headers).get('Referer')
      return new Response(JSON.stringify({
        Data: {
          LSJZList: [{ DWJZ: '1.7044' }]
        },
        ErrCode: 0
      }), { status: 200 })
    }
  )

  assert.equal(requestedUrls.length, 2)
  assert.equal(new URL(requestedUrls[0]).searchParams.has('token'), false)
  assert.match(requestedUrls[1], /api\.fund\.eastmoney\.com\/f10\/lsjz/)
  assert.match(requestedUrls[1], /fundCode=017641/)
  assert.equal(fundReferer, 'https://fundf10.eastmoney.com/')
  assert.equal(quote?.market, 'CN_OTC')
  assert.equal(quote?.name, '摩根标普500指数(QDII)人民币A')
  assert.equal(quote?.currency, 'CNY')
  assert.equal(quote?.price, 1.7044)
})

test('detects the currency of an East Money OTC fund share class', async () => {
  const quote = await fetchAssetQuote(
    { market: 'CN_OTC', symbol: '017642', provider: 'eastmoney' },
    async (input) => {
      const url = String(input)
      if (url.startsWith('https://searchapi.eastmoney.com/')) {
        return new Response(JSON.stringify({
          QuotationCodeTable: {
            Data: [{
              Code: '017642',
              Name: '摩根标普500指数(QDII)美钞',
              Classify: 'OTCFUND',
              MktNum: '150',
              QuoteID: '150.017642'
            }]
          }
        }), { status: 200 })
      }
      return new Response(JSON.stringify({
        Data: { LSJZList: [{ DWJZ: '0.2502' }] },
        ErrCode: 0
      }), { status: 200 })
    }
  )

  assert.equal(quote?.currency, 'USD')
  assert.equal(quote?.price, 0.2502)
})

test('rejects failed East Money OTC fund responses', async () => {
  await assert.rejects(
    fetchAssetQuote(
      { market: 'CN_OTC', symbol: '017641', provider: 'eastmoney' },
      async (input) => String(input).startsWith('https://searchapi.eastmoney.com/')
        ? new Response(JSON.stringify({
            QuotationCodeTable: {
              Data: [{
                Code: '017641',
                Name: '摩根标普500指数(QDII)人民币A',
                Classify: 'OTCFUND',
                MktNum: '150',
                QuoteID: '150.017641'
              }]
            }
          }), { status: 200 })
        : new Response(JSON.stringify({ Data: '', ErrCode: -999 }), { status: 200 })
    ),
    /基金行情请求失败/
  )
})

test('resolves a US exchange before loading its East Money quote', async () => {
  const requestedUrls: string[] = []
  const quote = await fetchAssetQuote(
    { market: 'US', symbol: 'BABA', provider: 'eastmoney' },
    async (input) => {
      const url = String(input)
      requestedUrls.push(url)
      if (url.startsWith('https://searchapi.eastmoney.com/')) {
        return new Response(JSON.stringify({
          QuotationCodeTable: {
            Data: [{
              Code: 'BABA',
              Name: '阿里巴巴',
              Classify: 'UsStock',
              MktNum: '106',
              QuoteID: '106.BABA'
            }]
          }
        }), { status: 200 })
      }
      return new Response(JSON.stringify({
        data: { f43: 155_120, f58: '阿里巴巴', f59: 3 }
      }), { status: 200 })
    }
  )

  assert.equal(requestedUrls.length, 2)
  assert.match(requestedUrls[1], /secid=106\.BABA/)
  assert.equal(quote?.name, '阿里巴巴')
  assert.equal(quote?.currency, 'USD')
  assert.equal(quote?.price, 155.12)
})

test('normalizes US class-share separators for East Money search', async () => {
  const requestedUrls: string[] = []
  await fetchAssetQuote(
    { market: 'US', symbol: 'BRK.B', provider: 'eastmoney' },
    async (input) => {
      const url = String(input)
      requestedUrls.push(url)
      if (url.startsWith('https://searchapi.eastmoney.com/')) {
        return new Response(JSON.stringify({ QuotationCodeTable: { Data: [] } }), {
          status: 200
        })
      }
      return new Response(JSON.stringify({ data: null }), { status: 200 })
    }
  )

  assert.match(requestedUrls[0], /input=BRK_B/)
})

test('loads crypto name and USD spot price from Coinbase', async () => {
  assert.equal(coinbaseAssetSymbol('btc-usdt'), 'BTC')
  const quote = await fetchAssetQuote(
    { market: 'CC', symbol: 'BTC', provider: 'coinbase' },
    async (input) => {
      const url = String(input)
      if (url.endsWith('/currencies/crypto')) {
        return new Response(JSON.stringify({
          data: [
            { code: 'BTC', name: 'Bitcoin' },
            { code: 'ETH', name: 'Ethereum' }
          ]
        }), { status: 200 })
      }
      return new Response(JSON.stringify({
        data: { amount: '76783.965', base: 'BTC', currency: 'USD' }
      }), { status: 200 })
    }
  )

  assert.deepEqual(quote && {
    source: quote.source,
    name: quote.name,
    currency: quote.currency,
    price: quote.price
  }, {
    source: 'coinbase',
    name: 'Bitcoin',
    currency: 'USD',
    price: 76783.965
  })
})

test('keeps a partial Coinbase result when one public endpoint is unavailable', async () => {
  const quote = await fetchAssetQuote(
    { market: 'CC', symbol: 'ETH', provider: 'coinbase' },
    async (input) => {
      const url = String(input)
      if (url.endsWith('/currencies/crypto')) {
        return new Response(JSON.stringify({ data: [{ code: 'ETH', name: 'Ethereum' }] }), {
          status: 200
        })
      }
      return new Response('temporarily unavailable', { status: 503 })
    }
  )

  assert.equal(quote?.name, 'Ethereum')
  assert.equal(quote?.currency, 'USD')
  assert.equal(quote?.price, undefined)
})

test('maps each market to the Yahoo Finance symbol format', () => {
  assert.equal(yahooAssetSymbol({ market: 'CN', symbol: '600519' }), '600519.SS')
  assert.equal(yahooAssetSymbol({ market: 'CN', symbol: '000001' }), '000001.SZ')
  assert.equal(yahooAssetSymbol({ market: 'HK', symbol: '01810' }), '1810.HK')
  assert.equal(yahooAssetSymbol({ market: 'US', symbol: 'BRK.B' }), 'BRK-B')
  assert.equal(yahooAssetSymbol({ market: 'CC', symbol: 'btc-usdt' }), 'BTC-USD')
  assert.equal(yahooAssetSymbol({ market: 'CN_OTC', symbol: '017641' }), undefined)
})

test('only allows East Money for mainland OTC funds', async () => {
  await assert.rejects(
    fetchAssetQuote(
      { market: 'CN_OTC', symbol: '017641', provider: 'yahoo' },
      async () => new Response('{}', { status: 200 })
    ),
    /行情数据源与市场不匹配/
  )
})

test('accepts mainland OTC fund lookups at the desktop boundary', async () => {
  let receivedMarket: string | undefined
  let receivedProvider: string | undefined
  const desktop = new DesktopService({
    lookupAssetQuote: async (input: AssetQuoteLookupInput) => {
      receivedMarket = input.market
      receivedProvider = input.provider
      return {
        market: input.market,
        symbol: input.symbol,
        source: input.provider,
        name: '摩根标普500指数(QDII)人民币A',
        currency: 'CNY',
        price: 1.7044,
        fetchedAt: '2026-09-03T00:00:00.000Z'
      }
    }
  } as unknown as DesktopServiceDependencies)

  const result = await desktop.lookupAssetQuote({
    market: 'CN_OTC',
    symbol: '017641',
    provider: 'eastmoney'
  })
  assert.equal(result.status, 'found')
  assert.equal(receivedMarket, 'CN_OTC')
  assert.equal(receivedProvider, 'eastmoney')
  await assert.rejects(
    desktop.lookupAssetQuote({
      market: 'CN_OTC',
      symbol: '017641',
      provider: 'yahoo'
    }),
    /行情查询请求无效/
  )
})

test('loads an editable quote from Yahoo Finance when selected', async () => {
  const requestedUrls: string[] = []
  const quote = await fetchAssetQuote(
    { market: 'HK', symbol: '01810', provider: 'yahoo' },
    async (input) => {
      requestedUrls.push(String(input))
      return new Response(JSON.stringify({
        chart: {
          result: [{
            meta: {
              currency: 'HKD',
              longName: 'Xiaomi Corporation',
              regularMarketPrice: 40.32
            }
          }]
        }
      }), { status: 200 })
    }
  )

  assert.match(requestedUrls[0], /1810\.HK/)
  assert.deepEqual(quote && {
    source: quote.source,
    name: quote.name,
    currency: quote.currency,
    price: quote.price
  }, {
    source: 'yahoo',
    name: 'Xiaomi Corporation',
    currency: 'HKD',
    price: 40.32
  })
})

test('keeps provider failures silent for manual entry fallback', async () => {
  const desktop = new DesktopService({
    lookupAssetQuote: async () => {
      throw new Error('HTTP 429')
    }
  } as unknown as DesktopServiceDependencies)

  assert.deepEqual(await desktop.lookupAssetQuote({
    market: 'US',
    symbol: 'AAPL',
    provider: 'yahoo'
  }), { status: 'unavailable' })
})
