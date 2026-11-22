import { comparePortfolios, type ComparisonPoint } from './portfolio-comparison'
import { valuePositions } from './valuation'

export type TrendPointInput = {
  id: string
  time: number
  point: ComparisonPoint
}

export type TrendPoint = {
  id: string
  time: number
  value?: number
  isComplete: boolean
  cumulativeReturnPercent: number
}

export type TrendPeriod = {
  fromId: string
  toId: string
  fromTime: number
  toTime: number
  fromValue: number
  toValue: number
  change: number
  marketChange: number
  returnPercent?: number
  tradeChange: number
  rebalanceAmount: number
  isComplete: boolean
}

export type PortfolioTrend = {
  baseCurrency: string
  points: TrendPoint[]
  periods: TrendPeriod[]
  totalChange: number
  totalMarketChange: number
  totalTradeChange: number
  totalRebalanceAmount: number
  cumulativeReturnPercent?: number
  isComplete: boolean
}

// 相邻两个时间点逐段对比，再把每段剔除买卖后的收益率连乘，得到时间加权收益率。
// 买卖按终点价格估算，相当于假设资金在区间末尾进出，因此每段收益率 = 市场涨跌 / 起点市值。
export function buildPortfolioTrend(
  inputs: TrendPointInput[],
  baseCurrency: string
): PortfolioTrend {
  const sorted = [...inputs].sort((left, right) => left.time - right.time)
  const periods: TrendPeriod[] = []
  const growth = [1]
  for (let index = 1; index < sorted.length; index += 1) {
    const from = sorted[index - 1]
    const to = sorted[index]
    const comparison = comparePortfolios(from.point, to.point, baseCurrency)
    const returnPercent = comparison.marketChangePercent
    periods.push({
      fromId: from.id,
      toId: to.id,
      fromTime: from.time,
      toTime: to.time,
      fromValue: comparison.fromValue,
      toValue: comparison.toValue,
      change: comparison.change,
      marketChange: comparison.marketChange,
      ...(returnPercent === undefined ? {} : { returnPercent }),
      tradeChange: comparison.tradeChange,
      rebalanceAmount: comparison.rebalanceAmount,
      isComplete: comparison.isComplete
    })
    growth.push(growth[index - 1] * (1 + (returnPercent ?? 0) / 100))
  }

  const points = sorted.map((input, index) => {
    const valuation = valuePositions(
      input.point.workspace.accounts.flatMap((account) => account.positions),
      baseCurrency,
      input.point.rates
    )
    return {
      id: input.id,
      time: input.time,
      ...(valuation.totalConvertedMarketValue === undefined
        ? {}
        : { value: valuation.totalConvertedMarketValue }),
      isComplete: valuation.isComplete,
      cumulativeReturnPercent: (growth[index] - 1) * 100
    }
  })

  const sum = (pick: (period: TrendPeriod) => number) =>
    periods.reduce((total, period) => total + pick(period), 0)

  return {
    baseCurrency: baseCurrency.trim().toUpperCase(),
    points,
    periods,
    totalChange: sum((period) => period.change),
    totalMarketChange: sum((period) => period.marketChange),
    totalTradeChange: sum((period) => period.tradeChange),
    totalRebalanceAmount: sum((period) => period.rebalanceAmount),
    ...(periods.length > 0
      ? { cumulativeReturnPercent: points.at(-1)!.cumulativeReturnPercent }
      : {}),
    isComplete:
      points.every((point) => point.isComplete) &&
      periods.every((period) => period.isComplete)
  }
}
