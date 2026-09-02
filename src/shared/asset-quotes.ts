import type { Market } from './portfolio'

export const STOCK_QUOTE_PROVIDERS = ['eastmoney', 'yahoo'] as const
export const CRYPTO_QUOTE_PROVIDERS = ['coinbase', 'yahoo'] as const

export type StockQuoteProvider = (typeof STOCK_QUOTE_PROVIDERS)[number]
export type CryptoQuoteProvider = (typeof CRYPTO_QUOTE_PROVIDERS)[number]
export type AssetQuoteProvider = StockQuoteProvider | CryptoQuoteProvider

export const DEFAULT_STOCK_QUOTE_PROVIDER: StockQuoteProvider = 'eastmoney'
export const DEFAULT_CRYPTO_QUOTE_PROVIDER: CryptoQuoteProvider = 'coinbase'

export const stockQuoteProviderLabels: Record<StockQuoteProvider, string> = {
  eastmoney: '东方财富',
  yahoo: 'Yahoo Finance'
}

export const cryptoQuoteProviderLabels: Record<CryptoQuoteProvider, string> = {
  coinbase: 'Coinbase',
  yahoo: 'Yahoo Finance'
}

export type AssetQuoteQuery = {
  market: Market
  symbol: string
}

export type AssetQuoteLookupInput = AssetQuoteQuery & {
  provider: AssetQuoteProvider
}

export type AssetQuote = AssetQuoteQuery & {
  source: AssetQuoteProvider
  name?: string
  currency?: string
  price?: number
  fetchedAt: string
}

export type AssetQuoteLookupResult =
  | { status: 'found'; quote: AssetQuote }
  | { status: 'not-found' }
  | { status: 'unavailable' }
