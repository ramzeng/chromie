import type { Position } from '@/lib/portfolio'

export const portfolioDisplayCurrencies = ['USD', 'HKD', 'CNY'] as const

export type PortfolioDisplayCurrency = typeof portfolioDisplayCurrencies[number]

export type CurrencyMarketValue = {
  value: number
  hasValue: boolean
}

export function createCurrencyMarketValues(
  positions: Position[]
): Map<PortfolioDisplayCurrency, CurrencyMarketValue> {
  const values = new Map<PortfolioDisplayCurrency, CurrencyMarketValue>(
    portfolioDisplayCurrencies.map((currency) => [
      currency,
      { value: 0, hasValue: false }
    ])
  )

  positions.forEach((position) => {
    if (position.price === undefined) return
    const currency = position.currency as PortfolioDisplayCurrency
    const current = values.get(currency)
    if (!current) return
    current.value += position.quantity * position.price
    current.hasValue = true
  })

  return values
}
