import { createHmac } from 'node:crypto'

import type {
  OkxSyncedPosition,
  OkxSyncOptions,
  OkxSyncResult
} from '../../shared/okx'
import type { FetchLike } from './proxy-http'

const OKX_BASE_URL = 'https://www.okx.com'
const REQUEST_TIMEOUT_MS = 10_000

type OkxResponse<T> = {
  code?: string
  msg?: string
  data?: T
}

type TradingBalance = {
  details?: Array<{
    ccy?: string
    eq?: string
    eqUsd?: string
  }>
}

type FundingBalance = {
  ccy?: string
  bal?: string
}

type SpotTicker = {
  instId?: string
  last?: string
}

type MergedBalance = {
  symbol: string
  quantity: number
  value: number
  hasCompleteValue: boolean
}

function requireOptions(options?: OkxSyncOptions): OkxSyncOptions {
  if (
    !options ||
    typeof options.apiKey !== 'string' ||
    !options.apiKey.trim() ||
    typeof options.secretKey !== 'string' ||
    !options.secretKey ||
    typeof options.passphrase !== 'string' ||
    !options.passphrase
  ) {
    throw new Error('请填写 OKX API 配置')
  }
  return {
    apiKey: options.apiKey.trim(),
    secretKey: options.secretKey,
    passphrase: options.passphrase
  }
}

function getMessage(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const response = value as { msg?: unknown; message?: unknown }
  if (typeof response.msg === 'string' && response.msg) return response.msg
  if (typeof response.message === 'string' && response.message) return response.message
  return undefined
}

async function request<T>(fetchImpl: FetchLike, path: string, init?: RequestInit): Promise<OkxResponse<T>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetchImpl(`${OKX_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal
    })
    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw new Error(`OKX 返回异常（HTTP ${response.status}）`)
    }
    if (!response.ok) {
      throw new Error(getMessage(body) ?? `OKX 请求失败（HTTP ${response.status}）`)
    }
    return body as OkxResponse<T>
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OKX 请求超时')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

async function privateGet<T>(fetchImpl: FetchLike, path: string, options: OkxSyncOptions): Promise<T> {
  const timestamp = new Date().toISOString()
  const signature = createHmac('sha256', options.secretKey)
    .update(`${timestamp}GET${path}`)
    .digest('base64')
  const response = await request<T>(fetchImpl, path, {
    method: 'GET',
    headers: {
      'OK-ACCESS-KEY': options.apiKey,
      'OK-ACCESS-SIGN': signature,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': options.passphrase
    }
  })
  if (response.code !== '0' || !response.data) {
    throw new Error(response.msg || `OKX 返回错误（${response.code || '未知代码'}）`)
  }
  return response.data
}

async function publicGet<T>(fetchImpl: FetchLike, path: string): Promise<T> {
  const response = await request<T>(fetchImpl, path)
  if (response.code !== '0' || !response.data) {
    throw new Error(response.msg || `OKX 返回错误（${response.code || '未知代码'}）`)
  }
  return response.data
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === 'string' && !value.trim()) return undefined
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : undefined
}

function buildUsdPrices(tickers: SpotTicker[]): Map<string, number> {
  const prices = new Map<string, { price: number; priority: number }>()
  const quotes = [
    { suffix: '-USD', priority: 0 },
    { suffix: '-USDT', priority: 1 },
    { suffix: '-USDC', priority: 2 }
  ]

  tickers.forEach((ticker) => {
    if (!ticker.instId) return
    const match = quotes.find(({ suffix }) => ticker.instId?.endsWith(suffix))
    if (!match) return
    const symbol = ticker.instId.slice(0, -match.suffix.length).toUpperCase()
    const price = finiteNumber(ticker.last)
    if (!symbol || price === undefined || price < 0) return
    const current = prices.get(symbol)
    if (!current || match.priority < current.priority) {
      prices.set(symbol, { price, priority: match.priority })
    }
  })

  const result = new Map<string, number>()
  prices.forEach(({ price }, symbol) => result.set(symbol, price))
  result.set('USD', 1)
  result.set('USDT', 1)
  result.set('USDC', 1)
  return result
}

function addBalance(
  balances: Map<string, MergedBalance>,
  symbolValue: unknown,
  quantityValue: unknown,
  price: number | undefined
): void {
  if (typeof symbolValue !== 'string') return
  const symbol = symbolValue.trim().toUpperCase()
  const quantity = finiteNumber(quantityValue)
  if (!symbol || quantity === undefined || quantity === 0) return

  const current = balances.get(symbol) ?? {
    symbol,
    quantity: 0,
    value: 0,
    hasCompleteValue: true
  }
  current.quantity += quantity
  current.hasCompleteValue &&= price !== undefined
  if (price !== undefined) current.value += quantity * price
  balances.set(symbol, current)
}

function toPositions(
  tradingBalances: TradingBalance[],
  fundingBalances: FundingBalance[],
  prices: Map<string, number>
): OkxSyncedPosition[] {
  const balances = new Map<string, MergedBalance>()

  tradingBalances.forEach((account) => {
    ;(account.details ?? []).forEach((detail) => {
      const quantity = finiteNumber(detail.eq)
      const value = finiteNumber(detail.eqUsd)
      const derivedPrice =
        quantity !== undefined && quantity !== 0 && value !== undefined
          ? value / quantity
          : undefined
      const fallbackPrice =
        typeof detail.ccy === 'string' ? prices.get(detail.ccy.toUpperCase()) : undefined
      addBalance(
        balances,
        detail.ccy,
        quantity,
        derivedPrice !== undefined && derivedPrice >= 0 ? derivedPrice : fallbackPrice
      )
    })
  })

  fundingBalances.forEach((balance) => {
    const symbol = balance.ccy?.toUpperCase()
    addBalance(balances, symbol, balance.bal, symbol ? prices.get(symbol) : undefined)
  })

  return [...balances.values()]
    .filter((balance) => Math.abs(balance.quantity) > Number.EPSILON)
    .filter((balance) => !balance.hasCompleteValue || Math.abs(balance.value) >= 1)
    .map((balance): OkxSyncedPosition => ({
      market: 'CC',
      symbol: balance.symbol,
      name: balance.symbol,
      currency: 'USD',
      quantity: balance.quantity,
      ...(balance.hasCompleteValue
        ? { price: balance.value / balance.quantity }
        : {})
    }))
    .sort((left, right) => {
      const leftValue = Math.abs(left.quantity * (left.price ?? 0))
      const rightValue = Math.abs(right.quantity * (right.price ?? 0))
      return rightValue - leftValue || left.symbol.localeCompare(right.symbol)
    })
}

export async function syncOkxPositions(
  options: OkxSyncOptions | undefined,
  fetchImpl: FetchLike
): Promise<OkxSyncResult> {
  const credentials = requireOptions(options)
  try {
    const [tradingBalances, fundingBalances, tickers] = await Promise.all([
      privateGet<TradingBalance[]>(fetchImpl, '/api/v5/account/balance', credentials),
      privateGet<FundingBalance[]>(fetchImpl, '/api/v5/asset/balances', credentials),
      publicGet<SpotTicker[]>(fetchImpl, '/api/v5/market/tickers?instType=SPOT')
    ])
    return {
      positions: toPositions(tradingBalances, fundingBalances, buildUsdPrices(tickers)),
      syncedAt: new Date().toISOString()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(message.startsWith('OKX ') ? message : `OKX 同步失败：${message}`)
  }
}
