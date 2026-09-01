export const EXCHANGE_RATE_PROVIDERS = ['coinbase'] as const
export const EXCHANGE_RATE_CURRENCIES = ['USD', 'CNY', 'HKD'] as const

export type ExchangeRateProvider = (typeof EXCHANGE_RATE_PROVIDERS)[number]
export type ExchangeRateCurrency = (typeof EXCHANGE_RATE_CURRENCIES)[number]

export function isExchangeRateCurrency(value: string): value is ExchangeRateCurrency {
  return EXCHANGE_RATE_CURRENCIES.includes(value as ExchangeRateCurrency)
}

export const DEFAULT_EXCHANGE_RATE_PROVIDER: ExchangeRateProvider = 'coinbase'
export const DEFAULT_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES = 15
export const MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES = 1
export const MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES = 24 * 60

export type ExchangeRateSnapshot = {
  provider: ExchangeRateProvider
  baseCurrency: 'USD'
  rates: Record<string, number>
  fetchedAt: string
}
