import { net } from 'electron'

import type {
  ExchangeRateProvider,
  ExchangeRateSnapshot
} from '../../shared/exchange-rates'

const EXCHANGE_RATES_URL = 'https://api.coinbase.com/v2/exchange-rates?currency=USD'
const REQUEST_TIMEOUT_MS = 10_000
const MAX_RATE_COUNT = 5_000

type CoinbaseExchangeRatesResponse = {
  data?: {
    currency?: unknown
    rates?: unknown
  }
}

function normalizeRates(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('汇率服务返回的数据无效')
  }

  const entries = Object.entries(value)
  if (!entries.length || entries.length > MAX_RATE_COUNT) {
    throw new Error('汇率服务返回的数据无效')
  }

  const rates: Record<string, number> = { USD: 1 }
  entries.forEach(([rawCurrency, rawRate]) => {
    const currency = rawCurrency.trim().toUpperCase()
    const rate = typeof rawRate === 'string' || typeof rawRate === 'number'
      ? Number(rawRate)
      : Number.NaN
    if (!/^[A-Z0-9]{2,12}$/.test(currency) || !Number.isFinite(rate) || rate <= 0) return
    rates[currency] = rate
  })

  if (Object.keys(rates).length < 2) throw new Error('汇率服务没有返回有效汇率')
  return rates
}

export async function fetchExchangeRates(
  provider: ExchangeRateProvider
): Promise<ExchangeRateSnapshot> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await net.fetch(EXCHANGE_RATES_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal
    })
    if (!response.ok) {
      throw new Error(`汇率请求失败（HTTP ${response.status}）`)
    }

    let body: CoinbaseExchangeRatesResponse
    try {
      body = await response.json() as CoinbaseExchangeRatesResponse
    } catch {
      throw new Error('汇率服务返回的数据无效')
    }
    if (body.data?.currency !== 'USD') {
      throw new Error('汇率服务返回的基准币种无效')
    }

    return {
      provider,
      baseCurrency: 'USD',
      rates: normalizeRates(body.data.rates),
      fetchedAt: new Date().toISOString()
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('汇率请求超时')
    }
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(message.startsWith('汇率') ? message : `汇率更新失败：${message}`)
  } finally {
    clearTimeout(timer)
  }
}
