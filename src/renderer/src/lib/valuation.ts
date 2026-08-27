import type { Position } from '@/lib/portfolio'

export type PositionValuation = {
  marketValue?: number
  anchoredMarketValue?: number
}

export type PositionValuationSummary = {
  byPositionId: Map<string, PositionValuation>
  totalAnchoredMarketValue?: number
  missingCurrencies: string[]
  isComplete: boolean
}

function normalizedCurrency(value: string): string {
  return value.trim().toUpperCase()
}

function hasRate(currency: string, usdRates?: Record<string, number>): boolean {
  if (currency === 'USD') return true
  const rate = usdRates?.[currency]
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0
}

export function convertToAnchorCurrency(
  amount: number,
  sourceCurrency: string,
  anchorCurrency: string,
  usdRates?: Record<string, number>
): number | undefined {
  const source = normalizedCurrency(sourceCurrency)
  const anchor = normalizedCurrency(anchorCurrency)
  if (!Number.isFinite(amount) || !source || !anchor) return undefined
  if (source === anchor) return amount

  const sourceRate = source === 'USD' ? 1 : usdRates?.[source]
  const anchorRate = anchor === 'USD' ? 1 : usdRates?.[anchor]
  if (
    typeof sourceRate !== 'number' ||
    !Number.isFinite(sourceRate) ||
    sourceRate <= 0 ||
    typeof anchorRate !== 'number' ||
    !Number.isFinite(anchorRate) ||
    anchorRate <= 0
  ) {
    return undefined
  }
  return amount * anchorRate / sourceRate
}

export function valuePositions(
  positions: Position[],
  anchorCurrency: string,
  usdRates?: Record<string, number>
): PositionValuationSummary {
  const byPositionId = new Map<string, PositionValuation>()
  const missingCurrencies = new Set<string>()
  let total = 0
  let hasAnchoredValue = false

  positions.forEach((position) => {
    if (position.price === undefined) {
      byPositionId.set(position.id, {})
      return
    }
    const marketValue = position.quantity * position.price
    const anchoredMarketValue = convertToAnchorCurrency(
      marketValue,
      position.currency,
      anchorCurrency,
      usdRates
    )
    byPositionId.set(position.id, {
      marketValue,
      ...(anchoredMarketValue === undefined ? {} : { anchoredMarketValue })
    })
    if (anchoredMarketValue === undefined) {
      const sourceCurrency = normalizedCurrency(position.currency)
      const normalizedAnchorCurrency = normalizedCurrency(anchorCurrency)
      if (sourceCurrency && !hasRate(sourceCurrency, usdRates)) {
        missingCurrencies.add(sourceCurrency)
      }
      if (normalizedAnchorCurrency && !hasRate(normalizedAnchorCurrency, usdRates)) {
        missingCurrencies.add(normalizedAnchorCurrency)
      }
      return
    }
    total += anchoredMarketValue
    hasAnchoredValue = true
  })

  const missing = [...missingCurrencies].sort()
  return {
    byPositionId,
    ...(hasAnchoredValue ? { totalAnchoredMarketValue: total } : {}),
    missingCurrencies: missing,
    isComplete: missing.length === 0
  }
}
