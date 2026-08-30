import { createHmac } from 'node:crypto'

import { net } from 'electron'

import type {
  BinanceSyncedPosition,
  BinanceSyncOptions,
  BinanceSyncResult
} from '../../shared/binance'

const BINANCE_BASE_URL = 'https://api.binance.com'
const REQUEST_TIMEOUT_MS = 10_000
const STABLE_ASSETS = new Set(['USD', 'USDT', 'USDC', 'FDUSD'])

type BinanceError = {
  code?: number
  msg?: string
}

type BinanceAccount = {
  balances?: Array<{
    asset?: string
    free?: string
    locked?: string
  }>
}

type BinanceFundingBalance = {
  asset?: string
  free?: string
  locked?: string
  freeze?: string
  withdrawing?: string
}

type BinanceTicker = {
  symbol?: string
  price?: string
}

type MergedBalance = {
  symbol: string
  quantity: number
}

function requireOptions(options?: BinanceSyncOptions): BinanceSyncOptions {
  if (
    !options ||
    typeof options.apiKey !== 'string' ||
    !options.apiKey.trim() ||
    typeof options.secretKey !== 'string' ||
    !options.secretKey
  ) {
    throw new Error('请填写币安 API 配置')
  }
  return {
    apiKey: options.apiKey.trim(),
    secretKey: options.secretKey
  }
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === 'string' && !value.trim()) return undefined
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : undefined
}

function getMessage(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const response = value as BinanceError & { message?: unknown }
  if (typeof response.msg === 'string' && response.msg) return response.msg
  if (typeof response.message === 'string' && response.message) return response.message
  return undefined
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await net.fetch(`${BINANCE_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal
    })
    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw new Error(`币安返回异常（HTTP ${response.status}）`)
    }
    if (!response.ok) {
      throw new Error(getMessage(body) ?? `币安请求失败（HTTP ${response.status}）`)
    }
    return body as T
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('币安请求超时')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

function signedParameters(timestamp: number, secretKey: string): string {
  const parameters = new URLSearchParams({
    timestamp: String(timestamp),
    recvWindow: '10000'
  }).toString()
  const signature = createHmac('sha256', secretKey).update(parameters).digest('hex')
  return `${parameters}&signature=${signature}`
}

async function signedGet<T>(
  path: string,
  timestamp: number,
  options: BinanceSyncOptions
): Promise<T> {
  const parameters = signedParameters(timestamp, options.secretKey)
  return request<T>(`${path}?${parameters}`, {
    headers: { 'X-MBX-APIKEY': options.apiKey }
  })
}

async function signedPost<T>(
  path: string,
  timestamp: number,
  options: BinanceSyncOptions
): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-MBX-APIKEY': options.apiKey
    },
    body: signedParameters(timestamp, options.secretKey)
  })
}

function addBalance(
  balances: Map<string, MergedBalance>,
  symbolValue: unknown,
  ...quantityValues: unknown[]
): void {
  if (typeof symbolValue !== 'string') return
  const symbol = symbolValue.trim().toUpperCase()
  if (!symbol) return
  const quantity = quantityValues.reduce<number>((total, value) => {
    return total + (finiteNumber(value) ?? 0)
  }, 0)
  if (!Number.isFinite(quantity) || quantity === 0) return
  const current = balances.get(symbol) ?? { symbol, quantity: 0 }
  current.quantity += quantity
  balances.set(symbol, current)
}

function buildPrices(tickers: BinanceTicker[]): Map<string, number> {
  const tickersBySymbol = new Map<string, number>()
  tickers.forEach((ticker) => {
    if (typeof ticker.symbol !== 'string') return
    const price = finiteNumber(ticker.price)
    if (price === undefined || price < 0) return
    tickersBySymbol.set(ticker.symbol.toUpperCase(), price)
  })

  const prices = new Map<string, number>()
  STABLE_ASSETS.forEach((asset) => prices.set(asset, 1))
  const btcUsdPrice =
    tickersBySymbol.get('BTCUSDT') ??
    tickersBySymbol.get('BTCUSDC') ??
    tickersBySymbol.get('BTCFDUSD')

  const assets = new Set<string>()
  tickersBySymbol.forEach((_price, pair) => {
    for (const quote of STABLE_ASSETS) {
      if (pair.endsWith(quote) && pair.length > quote.length) {
        assets.add(pair.slice(0, -quote.length))
      }
    }
    if (pair.endsWith('BTC') && pair.length > 3) assets.add(pair.slice(0, -3))
  })

  assets.forEach((asset) => {
    const directPrice =
      tickersBySymbol.get(`${asset}USDT`) ??
      tickersBySymbol.get(`${asset}USDC`) ??
      tickersBySymbol.get(`${asset}FDUSD`) ??
      tickersBySymbol.get(`${asset}USD`)
    if (directPrice !== undefined) {
      prices.set(asset, directPrice)
      return
    }
    const btcPrice = tickersBySymbol.get(`${asset}BTC`)
    if (btcPrice !== undefined && btcUsdPrice !== undefined) {
      prices.set(asset, btcPrice * btcUsdPrice)
    }
  })
  return prices
}

function toPositions(
  account: BinanceAccount,
  fundingBalances: BinanceFundingBalance[],
  prices: Map<string, number>
): BinanceSyncedPosition[] {
  const balances = new Map<string, MergedBalance>()
  ;(account.balances ?? []).forEach((balance) => {
    addBalance(balances, balance.asset, balance.free, balance.locked)
  })
  fundingBalances.forEach((balance) => {
    addBalance(
      balances,
      balance.asset,
      balance.free,
      balance.locked,
      balance.freeze,
      balance.withdrawing
    )
  })

  return [...balances.values()]
    .filter((balance) => Math.abs(balance.quantity) > Number.EPSILON)
    .flatMap((balance): BinanceSyncedPosition[] => {
      const price = prices.get(balance.symbol)
      if (price !== undefined && Math.abs(balance.quantity * price) < 1) return []
      return [{
        market: 'CC',
        symbol: balance.symbol,
        name: balance.symbol,
        currency: 'USD',
        quantity: balance.quantity,
        ...(price === undefined ? {} : { price })
      }]
    })
    .sort((left, right) => {
      const leftValue = Math.abs(left.quantity * (left.price ?? 0))
      const rightValue = Math.abs(right.quantity * (right.price ?? 0))
      return rightValue - leftValue || left.symbol.localeCompare(right.symbol)
    })
}

export async function syncBinancePositions(
  options?: BinanceSyncOptions
): Promise<BinanceSyncResult> {
  const credentials = requireOptions(options)
  try {
    const time = await request<{ serverTime?: unknown }>('/api/v3/time')
    const serverTime = finiteNumber(time.serverTime)
    if (serverTime === undefined) throw new Error('币安服务器时间无效')

    const [account, fundingBalances, tickers] = await Promise.all([
      signedGet<BinanceAccount>('/api/v3/account', serverTime, credentials),
      signedPost<BinanceFundingBalance[]>(
        '/sapi/v1/asset/get-funding-asset',
        serverTime,
        credentials
      ),
      request<BinanceTicker[]>('/api/v3/ticker/price')
    ])
    return {
      positions: toPositions(account, fundingBalances, buildPrices(tickers)),
      syncedAt: new Date().toISOString()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(message.startsWith('币安') ? message : `币安同步失败：${message}`)
  }
}
