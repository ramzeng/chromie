export type ExchangeRateSnapshot = {
  provider: 'coinbase'
  baseCurrency: 'USD'
  rates: Record<string, number>
  fetchedAt: string
}
