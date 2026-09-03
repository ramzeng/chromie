import type { Position } from './portfolio'

export type PositionValuation = {
  marketValue?: number
  convertedMarketValue?: number
}

export type PositionValuationSummary = {
  byPositionId: Map<string, PositionValuation>
  totalConvertedMarketValue?: number
  missingCurrencies: string[]
  missingPriceCount: number
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

export function convertToBaseCurrency(
  amount: number,
  sourceCurrency: string,
  baseCurrency: string,
  usdRates?: Record<string, number>
): number | undefined {
  const source = normalizedCurrency(sourceCurrency)
  const base = normalizedCurrency(baseCurrency)
  if (!Number.isFinite(amount) || !source || !base) return undefined
  if (source === base) return amount

  const sourceRate = source === 'USD' ? 1 : usdRates?.[source]
  const baseRate = base === 'USD' ? 1 : usdRates?.[base]
  if (
    typeof sourceRate !== 'number' ||
    !Number.isFinite(sourceRate) ||
    sourceRate <= 0 ||
    typeof baseRate !== 'number' ||
    !Number.isFinite(baseRate) ||
    baseRate <= 0
  ) {
    return undefined
  }
  return amount * baseRate / sourceRate
}

export function valuePositions(
  positions: Position[],
  baseCurrency: string,
  usdRates?: Record<string, number>
): PositionValuationSummary {
  const byPositionId = new Map<string, PositionValuation>()
  const missingCurrencies = new Set<string>()
  let total = 0
  let hasConvertedValue = false
  let missingPriceCount = 0

  positions.forEach((position) => {
    if (position.price === undefined) {
      missingPriceCount += 1
      byPositionId.set(position.id, {})
      return
    }
    const marketValue = position.quantity * position.price
    const convertedMarketValue = convertToBaseCurrency(
      marketValue,
      position.currency,
      baseCurrency,
      usdRates
    )
    byPositionId.set(position.id, {
      marketValue,
      ...(convertedMarketValue === undefined ? {} : { convertedMarketValue })
    })
    if (convertedMarketValue === undefined) {
      const sourceCurrency = normalizedCurrency(position.currency)
      const normalizedBaseCurrency = normalizedCurrency(baseCurrency)
      if (sourceCurrency && !hasRate(sourceCurrency, usdRates)) {
        missingCurrencies.add(sourceCurrency)
      }
      if (normalizedBaseCurrency && !hasRate(normalizedBaseCurrency, usdRates)) {
        missingCurrencies.add(normalizedBaseCurrency)
      }
      return
    }
    total += convertedMarketValue
    hasConvertedValue = true
  })

  const missing = [...missingCurrencies].sort()
  return {
    byPositionId,
    ...(hasConvertedValue ? { totalConvertedMarketValue: total } : {}),
    missingCurrencies: missing,
    missingPriceCount,
    isComplete: missing.length === 0 && missingPriceCount === 0
  }
}
