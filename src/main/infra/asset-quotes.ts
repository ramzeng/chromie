import type {
  AssetQuote,
  AssetQuoteLookupInput,
  AssetQuoteQuery
} from '../../shared/asset-quotes'

const EASTMONEY_QUOTE_URL = 'https://push2.eastmoney.com/api/qt/stock/get'
const EASTMONEY_SEARCH_URL = 'https://searchapi.eastmoney.com/api/suggest/get'
const EASTMONEY_FUND_NAV_URL = 'https://api.fund.eastmoney.com/f10/lsjz'
const EASTMONEY_FUND_REFERER = 'https://fundf10.eastmoney.com/'
const EASTMONEY_SEARCH_TOKEN = 'D43BF722C8E33CBF33964D1D6CFAE909D'
const COINBASE_API_URL = 'https://api.coinbase.com/v2'
const REQUEST_TIMEOUT_MS = 8_000

type FetchLike = (
  input: string | Request,
  init?: RequestInit
) => Promise<Response>

type EastMoneyQuoteResponse = {
  data?: {
    f43?: unknown
    f57?: unknown
    f58?: unknown
    f59?: unknown
  } | null
}

type EastMoneySearchItem = {
  Code?: unknown
  Name?: unknown
  Classify?: unknown
  MktNum?: unknown
  QuoteID?: unknown
}

type EastMoneySearchResponse = {
  QuotationCodeTable?: {
    Data?: EastMoneySearchItem[] | null
  }
}

type EastMoneyFundNavResponse = {
  Data?: {
    LSJZList?: Array<{
      DWJZ?: unknown
    }> | null
  } | string | null
  ErrCode?: unknown
}

type CoinbaseCurrency = {
  code?: unknown
  name?: unknown
}

type CoinbaseCurrenciesResponse = {
  data?: CoinbaseCurrency[]
}

type CoinbaseSpotPriceResponse = {
  data?: {
    amount?: unknown
    base?: unknown
    currency?: unknown
  }
}

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        currency?: unknown
        longName?: unknown
        regularMarketPrice?: unknown
        shortName?: unknown
      }
    }> | null
  }
}

function textValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  return text || undefined
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined
  if (typeof value === 'string' && !value.trim()) return undefined
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : undefined
}

async function fetchJson<T>(
  url: string,
  fetchImpl: FetchLike,
  signal: AbortSignal,
  notFoundStatuses: readonly number[] = [404],
  headers: HeadersInit = {}
): Promise<T | null> {
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { Accept: 'application/json', ...headers },
    signal
  })
  if (notFoundStatuses.includes(response.status)) return null
  if (!response.ok) throw new Error(`行情请求失败（HTTP ${response.status}）`)
  try {
    return await response.json() as T
  } catch {
    throw new Error('行情服务返回的数据无效')
  }
}

function normalizedStockSymbol(input: AssetQuoteQuery): string {
  let symbol = input.symbol.trim().toUpperCase()
  if (input.market === 'CN') {
    symbol = symbol
      .replace(/^(?:SH|SZ|BJ)[.:]?/, '')
      .replace(/\.(?:SH|SS|SZ|BJ)$/, '')
  }
  if (input.market === 'HK') {
    symbol = symbol.replace(/\.HK$/, '')
    if (/^[0-9]+$/.test(symbol)) symbol = symbol.padStart(5, '0')
  }
  if (input.market === 'US') {
    symbol = symbol.replace(/^US[.:]/, '').replace(/\.US$/, '')
    symbol = symbol.replace(/[.-]/g, '_')
  }
  return symbol
}

export function eastMoneyDirectQuoteId(
  input: AssetQuoteQuery
): string | undefined {
  const symbol = normalizedStockSymbol(input)
  if (!symbol) return undefined
  if (input.market === 'HK') return `116.${symbol}`
  if (input.market !== 'CN' || !/^[0-9]+$/.test(symbol)) return undefined

  const explicitlyShanghai = /^(?:SH)[.:]?/i.test(input.symbol) || /\.(?:SH|SS)$/i.test(input.symbol)
  const explicitlyShenzhen = /^(?:SZ|BJ)[.:]?/i.test(input.symbol) || /\.(?:SZ|BJ)$/i.test(input.symbol)
  const isBeijing = explicitlyShenzhen || /^(?:4|8|92)/.test(symbol)
  const isShanghai = explicitlyShanghai || (!isBeijing && /^(?:5|6|9)/.test(symbol))
  return `${isShanghai ? '1' : '0'}.${symbol}`
}

function eastMoneyMarketMatch(
  item: EastMoneySearchItem,
  market: AssetQuoteQuery['market']
): boolean {
  const classify = textValue(item.Classify)
  const marketNumber = textValue(item.MktNum)
  if (market === 'CN') {
    return marketNumber === '0' ||
      marketNumber === '1' ||
      marketNumber === '150' ||
      classify === 'OTCFUND'
  }
  if (market === 'HK') return marketNumber === '116' || classify === 'HK'
  return market === 'US' && (
    classify === 'UsStock' ||
    marketNumber === '105' ||
    marketNumber === '106' ||
    marketNumber === '107'
  )
}

function comparableSymbol(value: string): string {
  return value.toUpperCase().replace(/[._-]/g, '')
}

async function findEastMoneyQuoteId(
  input: AssetQuoteQuery,
  fetchImpl: FetchLike,
  signal: AbortSignal
): Promise<{
  quoteId: string
  code: string
  name?: string
  isOtcFund: boolean
} | null> {
  const symbol = normalizedStockSymbol(input)
  const url = new URL(EASTMONEY_SEARCH_URL)
  url.searchParams.set('input', symbol)
  url.searchParams.set('type', '14')
  url.searchParams.set('token', EASTMONEY_SEARCH_TOKEN)
  url.searchParams.set('count', '20')
  const response = await fetchJson<EastMoneySearchResponse>(
    url.toString(),
    fetchImpl,
    signal
  )
  const match = response?.QuotationCodeTable?.Data?.find((item) => {
    const code = textValue(item.Code)
    return Boolean(
      code &&
      comparableSymbol(code) === comparableSymbol(symbol) &&
      eastMoneyMarketMatch(item, input.market)
    )
  })
  const quoteId = textValue(match?.QuoteID)
  const code = textValue(match?.Code)
  return quoteId && code ? {
    quoteId,
    code,
    name: textValue(match?.Name),
    isOtcFund: textValue(match?.Classify) === 'OTCFUND' ||
      textValue(match?.MktNum) === '150'
  } : null
}

async function fetchEastMoneyFundQuote(
  input: AssetQuoteQuery,
  code: string,
  fallbackName: string | undefined,
  fetchImpl: FetchLike,
  signal: AbortSignal
): Promise<AssetQuote | null> {
  const url = new URL(EASTMONEY_FUND_NAV_URL)
  url.searchParams.set('fundCode', code)
  url.searchParams.set('pageIndex', '1')
  url.searchParams.set('pageSize', '1')
  const response = await fetchJson<EastMoneyFundNavResponse>(
    url.toString(),
    fetchImpl,
    signal,
    [404],
    { Referer: EASTMONEY_FUND_REFERER }
  )
  const data = response?.Data
  const price = typeof data === 'object' && data
    ? finiteNumber(data.LSJZList?.[0]?.DWJZ)
    : undefined
  if (!fallbackName && price === undefined) return null

  return {
    market: input.market,
    symbol: input.symbol.trim().toUpperCase(),
    source: 'eastmoney',
    ...(fallbackName ? { name: fallbackName } : {}),
    currency: 'CNY',
    ...(price !== undefined ? { price } : {}),
    fetchedAt: new Date().toISOString()
  }
}

async function fetchEastMoneyQuote(
  input: AssetQuoteQuery,
  quoteId: string,
  fallbackName: string | undefined,
  fetchImpl: FetchLike,
  signal: AbortSignal
): Promise<AssetQuote | null> {
  const url = new URL(EASTMONEY_QUOTE_URL)
  url.searchParams.set('secid', quoteId)
  url.searchParams.set('fields', 'f43,f57,f58,f59')
  const response = await fetchJson<EastMoneyQuoteResponse>(
    url.toString(),
    fetchImpl,
    signal
  )
  const data = response?.data
  if (!data) return null

  const name = textValue(data.f58) ?? fallbackName
  const rawPrice = finiteNumber(data.f43)
  const precision = finiteNumber(data.f59)
  const price = rawPrice !== undefined && precision !== undefined
    ? rawPrice / 10 ** precision
    : undefined
  if (!name && price === undefined) return null

  return {
    market: input.market,
    symbol: input.symbol.trim().toUpperCase(),
    source: 'eastmoney',
    ...(name ? { name } : {}),
    currency: input.market === 'CN' ? 'CNY' : input.market === 'HK' ? 'HKD' : 'USD',
    ...(price !== undefined ? { price } : {}),
    fetchedAt: new Date().toISOString()
  }
}

async function fetchEastMoneyAssetQuote(
  input: AssetQuoteQuery,
  fetchImpl: FetchLike,
  signal: AbortSignal
): Promise<AssetQuote | null> {
  const directQuoteId = eastMoneyDirectQuoteId(input)
  if (directQuoteId) {
    try {
      const directQuote = await fetchEastMoneyQuote(
        input,
        directQuoteId,
        undefined,
        fetchImpl,
        signal
      )
      if (directQuote) return directQuote
    } catch {
      // A numeric fund code can look like a mainland stock code. East Money may
      // close the invalid stock request, so continue with the security search.
    }
  }

  const match = await findEastMoneyQuoteId(input, fetchImpl, signal)
  if (!match) return null
  return match.isOtcFund
    ? fetchEastMoneyFundQuote(
        input,
        match.code,
        match.name,
        fetchImpl,
        signal
      )
    : fetchEastMoneyQuote(input, match.quoteId, match.name, fetchImpl, signal)
}

export function coinbaseAssetSymbol(symbol: string): string {
  return symbol
    .trim()
    .toUpperCase()
    .replace(/[-/.](?:USD|USDT|USDC)$/, '')
}

async function fetchCoinbaseName(
  symbol: string,
  fetchImpl: FetchLike,
  signal: AbortSignal
): Promise<string | undefined> {
  const response = await fetchJson<CoinbaseCurrenciesResponse | CoinbaseCurrency[]>(
    `${COINBASE_API_URL}/currencies/crypto`,
    fetchImpl,
    signal
  )
  const currencies = Array.isArray(response) ? response : response?.data
  return textValue(currencies?.find(
    (currency) => textValue(currency.code)?.toUpperCase() === symbol
  )?.name)
}

async function fetchCoinbasePrice(
  symbol: string,
  fetchImpl: FetchLike,
  signal: AbortSignal
): Promise<{ price: number; currency: string } | null> {
  const response = await fetchJson<CoinbaseSpotPriceResponse>(
    `${COINBASE_API_URL}/prices/${encodeURIComponent(`${symbol}-USD`)}/spot`,
    fetchImpl,
    signal,
    [400, 404]
  )
  const price = finiteNumber(response?.data?.amount)
  if (price === undefined) return null
  return {
    price,
    currency: textValue(response?.data?.currency)?.toUpperCase() ?? 'USD'
  }
}

async function fetchCoinbaseAssetQuote(
  input: AssetQuoteQuery,
  fetchImpl: FetchLike,
  signal: AbortSignal
): Promise<AssetQuote | null> {
  const symbol = coinbaseAssetSymbol(input.symbol)
  const [nameResult, priceResult] = await Promise.allSettled([
    fetchCoinbaseName(symbol, fetchImpl, signal),
    fetchCoinbasePrice(symbol, fetchImpl, signal)
  ])
  const name = nameResult.status === 'fulfilled' ? nameResult.value : undefined
  const price = priceResult.status === 'fulfilled' ? priceResult.value : null
  if (!name && !price) {
    const rejected = nameResult.status === 'rejected' ? nameResult.reason
      : priceResult.status === 'rejected' ? priceResult.reason
        : undefined
    if (rejected) throw rejected
    return null
  }

  return {
    market: 'CC',
    symbol: input.symbol.trim().toUpperCase(),
    source: 'coinbase',
    ...(name ? { name } : {}),
    currency: price?.currency ?? 'USD',
    ...(price ? { price: price.price } : {}),
    fetchedAt: new Date().toISOString()
  }
}

export function yahooAssetSymbol(input: AssetQuoteQuery): string | undefined {
  const rawSymbol = input.symbol.trim().toUpperCase()
  if (!rawSymbol) return undefined

  if (input.market === 'CC') return `${coinbaseAssetSymbol(rawSymbol)}-USD`
  if (input.market === 'HK') {
    const symbol = rawSymbol.replace(/\.HK$/, '').replace(/^HK[.:]?/, '')
    if (!/^[0-9]+$/.test(symbol)) return undefined
    return `${Number(symbol)}.HK`
  }
  if (input.market === 'CN') {
    const symbol = rawSymbol
      .replace(/^(?:SH|SZ|BJ)[.:]?/, '')
      .replace(/\.(?:SH|SS|SZ|BJ)$/, '')
    if (!/^[0-9]+$/.test(symbol)) return undefined
    if (/^(?:4|8|92)/.test(symbol)) return `${symbol}.BJ`
    return `${symbol}.${/^(?:5|6|9)/.test(symbol) ? 'SS' : 'SZ'}`
  }

  return rawSymbol
    .replace(/^US[.:]/, '')
    .replace(/\.US$/, '')
    .replace(/\./g, '-')
}

async function fetchYahooAssetQuote(
  input: AssetQuoteQuery,
  fetchImpl: FetchLike,
  signal: AbortSignal
): Promise<AssetQuote | null> {
  const yahooSymbol = yahooAssetSymbol(input)
  if (!yahooSymbol) return null
  const response = await fetchJson<YahooChartResponse>(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`,
    fetchImpl,
    signal
  )
  const meta = response?.chart?.result?.[0]?.meta
  const name = textValue(meta?.longName) ?? textValue(meta?.shortName)
  const currency = textValue(meta?.currency)?.toUpperCase()
  const price = finiteNumber(meta?.regularMarketPrice)
  if (!name && !currency && price === undefined) return null

  return {
    market: input.market,
    symbol: input.symbol.trim().toUpperCase(),
    source: 'yahoo',
    ...(name ? { name } : {}),
    ...(currency ? { currency } : {}),
    ...(price !== undefined ? { price } : {}),
    fetchedAt: new Date().toISOString()
  }
}

export async function fetchAssetQuote(
  input: AssetQuoteLookupInput,
  fetchImpl: FetchLike = fetch
): Promise<AssetQuote | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    if (input.provider === 'yahoo') {
      return await fetchYahooAssetQuote(input, fetchImpl, controller.signal)
    }
    if (input.market === 'CC' && input.provider === 'coinbase') {
      return await fetchCoinbaseAssetQuote(input, fetchImpl, controller.signal)
    }
    if (input.market !== 'CC' && input.provider === 'eastmoney') {
      return await fetchEastMoneyAssetQuote(input, fetchImpl, controller.signal)
    }
    throw new Error('行情数据源与市场不匹配')
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('行情请求超时')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}
