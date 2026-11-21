import { formatMoney, type Market, type Position, type Workspace } from './portfolio'
import { convertToBaseCurrency } from './valuation'

export type ComparisonPoint = {
  workspace: Workspace
  rates?: Record<string, number>
}

// 总变动 = 市场涨跌（价格 + 汇率）+ 买卖调仓（买入 + 卖出），各项之和严格等于总变动。
// 买入包含加仓和新开仓，卖出包含减仓和清仓，按终点价格估算金额。
export type ComparisonEffects = {
  price: number
  exchangeRate: number
  bought: number
  sold: number
}

export type ComparisonEffectKey = keyof ComparisonEffects

export const COMPARISON_EFFECT_KEYS: readonly ComparisonEffectKey[] = [
  'price',
  'exchangeRate',
  'bought',
  'sold'
]

export type PositionChangeKind =
  | 'opened'
  | 'closed'
  | 'increased'
  | 'decreased'
  | 'unchanged'

export const positionChangeKindLabels: Record<PositionChangeKind, string> = {
  opened: '新买入',
  closed: '已清仓',
  increased: '加仓',
  decreased: '减仓',
  unchanged: '未买卖'
}

export type ComparisonUnavailableReason = 'missing-price' | 'missing-rate'

export const comparisonUnavailableReasonLabels: Record<ComparisonUnavailableReason, string> = {
  'missing-price': '缺少价格',
  'missing-rate': '缺少汇率'
}

export type PositionComparison = {
  key: string
  accountId: string
  accountName: string
  market: Market
  symbol: string
  name: string
  currency: string
  kind: PositionChangeKind
  fromQuantity?: number
  toQuantity?: number
  fromPrice?: number
  toPrice?: number
  fromValue?: number
  toValue?: number
  change?: number
  priceChangePercent?: number
  effects?: ComparisonEffects
  unavailableReason?: ComparisonUnavailableReason
}

export type AccountComparison = {
  id: string
  name: string
  fromValue: number
  toValue: number
  change: number
  marketChange: number
  tradeChange: number
  effects: ComparisonEffects
  positionCount: number
  unavailableCount: number
}

export type CurrencyComparison = {
  currency: string
  fromRate?: number
  toRate?: number
  rateChangePercent?: number
  fromValue: number
  toValue: number
  exchangeRateEffect: number
}

export type ComparisonDirection = 'up' | 'down' | 'flat'

export type PortfolioComparison = {
  baseCurrency: string
  direction: ComparisonDirection
  fromValue: number
  toValue: number
  change: number
  changePercent?: number
  marketChange: number
  marketChangePercent?: number
  tradeChange: number
  effects: ComparisonEffects
  positions: PositionComparison[]
  accounts: AccountComparison[]
  currencies: CurrencyComparison[]
  unavailableCount: number
  isComplete: boolean
}

// 半分钱以内的差异视为没有变化，避免浮点误差产生“+0.00”的结论。
const EPSILON = 0.005

export function isMeaningfulChange(value: number | undefined): value is number {
  return value !== undefined && Math.abs(value) >= EPSILON
}

function emptyEffects(): ComparisonEffects {
  return { price: 0, exchangeRate: 0, bought: 0, sold: 0 }
}

function addEffects(target: ComparisonEffects, source: ComparisonEffects): void {
  COMPARISON_EFFECT_KEYS.forEach((key) => {
    target[key] += source[key]
  })
}

function percentChange(from: number | undefined, to: number | undefined): number | undefined {
  if (from === undefined || to === undefined || from === 0) return undefined
  return (to - from) / Math.abs(from) * 100
}

function sameQuantity(left: number, right: number): boolean {
  return Math.abs(left - right) <= Math.max(Math.abs(left), Math.abs(right), 1) * 1e-9
}

type PricedPosition = {
  rate?: number
  value?: number
  unavailableReason?: ComparisonUnavailableReason
}

function pricePosition(
  position: Position,
  baseCurrency: string,
  rates?: Record<string, number>
): PricedPosition {
  const rate = convertToBaseCurrency(1, position.currency, baseCurrency, rates)
  if (position.price === undefined) {
    return { rate, unavailableReason: 'missing-price' }
  }
  if (rate === undefined) return { unavailableReason: 'missing-rate' }
  return { rate, value: position.quantity * position.price * rate }
}

type KeyedPosition = {
  key: string
  accountId: string
  accountName: string
  position: Position
}

function positionKey(accountId: string, position: Position): string {
  return [
    accountId,
    position.market,
    position.symbol.trim().toUpperCase(),
    position.currency.trim().toUpperCase()
  ].join('|')
}

// 同步时持仓按账户、市场、代码和币种保留身份，这里用同样的规则跨时间点匹配，
// 同一账户中重复的代码按出现顺序配对。
function keyPositions(workspace: Workspace): Map<string, KeyedPosition> {
  const result = new Map<string, KeyedPosition>()
  workspace.accounts.forEach((account) => {
    const occurrences = new Map<string, number>()
    account.positions.forEach((position) => {
      const baseKey = positionKey(account.id, position)
      const index = occurrences.get(baseKey) ?? 0
      occurrences.set(baseKey, index + 1)
      const key = `${baseKey}#${index}`
      result.set(key, {
        key,
        accountId: account.id,
        accountName: account.name,
        position
      })
    })
  })
  return result
}

function comparePosition(
  key: string,
  from: KeyedPosition | undefined,
  to: KeyedPosition | undefined,
  baseCurrency: string,
  fromRates?: Record<string, number>,
  toRates?: Record<string, number>
): PositionComparison {
  const reference = (to ?? from)!
  const fromPosition = from?.position
  const toPosition = to?.position
  const fromPriced = fromPosition && pricePosition(fromPosition, baseCurrency, fromRates)
  const toPriced = toPosition && pricePosition(toPosition, baseCurrency, toRates)
  const kind: PositionChangeKind = !fromPosition
    ? 'opened'
    : !toPosition
      ? 'closed'
      : sameQuantity(fromPosition.quantity, toPosition.quantity)
        ? 'unchanged'
        : toPosition.quantity > fromPosition.quantity
          ? 'increased'
          : 'decreased'
  const base: PositionComparison = {
    key,
    accountId: reference.accountId,
    accountName: reference.accountName,
    market: reference.position.market,
    symbol: reference.position.symbol,
    name: reference.position.name,
    currency: reference.position.currency.trim().toUpperCase(),
    kind,
    ...(fromPosition ? { fromQuantity: fromPosition.quantity } : {}),
    ...(toPosition ? { toQuantity: toPosition.quantity } : {}),
    ...(fromPosition?.price === undefined ? {} : { fromPrice: fromPosition.price }),
    ...(toPosition?.price === undefined ? {} : { toPrice: toPosition.price }),
    ...(fromPriced?.value === undefined ? {} : { fromValue: fromPriced.value }),
    ...(toPriced?.value === undefined ? {} : { toValue: toPriced.value })
  }
  const priceChangePercent = percentChange(fromPosition?.price, toPosition?.price)
  if (priceChangePercent !== undefined) base.priceChangePercent = priceChangePercent

  const unavailableReason = fromPriced?.unavailableReason ?? toPriced?.unavailableReason
  if (unavailableReason) return { ...base, unavailableReason }

  const effects = emptyEffects()
  if (!fromPosition) {
    effects.bought = toPriced!.value!
  } else if (!toPosition) {
    effects.sold = -fromPriced!.value!
  } else {
    // 依次替换价格、汇率、数量，三项之和恰好等于市值差。
    const fromPrice = fromPosition.price!
    const toPrice = toPosition.price!
    const fromRate = fromPriced!.rate!
    const toRate = toPriced!.rate!
    effects.price = fromPosition.quantity * (toPrice - fromPrice) * fromRate
    effects.exchangeRate = fromPosition.quantity * toPrice * (toRate - fromRate)
    const traded = (toPosition.quantity - fromPosition.quantity) * toPrice * toRate
    if (traded > 0) effects.bought = traded
    else effects.sold = traded
  }
  return {
    ...base,
    change: (toPriced?.value ?? 0) - (fromPriced?.value ?? 0),
    effects
  }
}

export function marketEffect(effects: ComparisonEffects): number {
  return effects.price + effects.exchangeRate
}

export function tradeEffect(effects: ComparisonEffects): number {
  return effects.bought + effects.sold
}

export function comparePortfolios(
  from: ComparisonPoint,
  to: ComparisonPoint,
  baseCurrency: string
): PortfolioComparison {
  const normalizedBaseCurrency = baseCurrency.trim().toUpperCase()
  const fromPositions = keyPositions(from.workspace)
  const toPositions = keyPositions(to.workspace)
  const keys = [...new Set([...fromPositions.keys(), ...toPositions.keys()])]
  const positions = keys.map((key) =>
    comparePosition(
      key,
      fromPositions.get(key),
      toPositions.get(key),
      normalizedBaseCurrency,
      from.rates,
      to.rates
    )
  )

  const effects = emptyEffects()
  let fromValue = 0
  let toValue = 0
  const accounts = new Map<string, AccountComparison>()
  const currencies = new Map<string, CurrencyComparison>()
  const accountOrder = [
    ...to.workspace.accounts,
    ...from.workspace.accounts
  ]
  accountOrder.forEach((account) => {
    if (accounts.has(account.id)) return
    accounts.set(account.id, {
      id: account.id,
      name: account.name,
      fromValue: 0,
      toValue: 0,
      change: 0,
      marketChange: 0,
      tradeChange: 0,
      effects: emptyEffects(),
      positionCount: 0,
      unavailableCount: 0
    })
  })

  positions.forEach((position) => {
    const account = accounts.get(position.accountId)!
    account.positionCount += 1
    if (!position.effects) {
      account.unavailableCount += 1
      return
    }
    const positionFromValue = position.fromValue ?? 0
    const positionToValue = position.toValue ?? 0
    fromValue += positionFromValue
    toValue += positionToValue
    addEffects(effects, position.effects)
    account.fromValue += positionFromValue
    account.toValue += positionToValue
    addEffects(account.effects, position.effects)

    let currency = currencies.get(position.currency)
    if (!currency) {
      const fromRate = convertToBaseCurrency(1, position.currency, normalizedBaseCurrency, from.rates)
      const toRate = convertToBaseCurrency(1, position.currency, normalizedBaseCurrency, to.rates)
      currency = {
        currency: position.currency,
        ...(fromRate === undefined ? {} : { fromRate }),
        ...(toRate === undefined ? {} : { toRate }),
        fromValue: 0,
        toValue: 0,
        exchangeRateEffect: 0
      }
      const rateChangePercent = percentChange(fromRate, toRate)
      if (rateChangePercent !== undefined) currency.rateChangePercent = rateChangePercent
      currencies.set(position.currency, currency)
    }
    currency.fromValue += positionFromValue
    currency.toValue += positionToValue
    currency.exchangeRateEffect += position.effects.exchangeRate
  })

  accounts.forEach((account) => {
    account.change = account.toValue - account.fromValue
    account.marketChange = marketEffect(account.effects)
    account.tradeChange = tradeEffect(account.effects)
  })

  const change = toValue - fromValue
  const marketChange = marketEffect(effects)
  const unavailableCount = positions.filter((position) => !position.effects).length
  const changePercent = fromValue > 0 ? change / fromValue * 100 : undefined
  const marketChangePercent = fromValue > 0 ? marketChange / fromValue * 100 : undefined

  return {
    baseCurrency: normalizedBaseCurrency,
    direction: !isMeaningfulChange(change) ? 'flat' : change > 0 ? 'up' : 'down',
    fromValue,
    toValue,
    change,
    ...(changePercent === undefined ? {} : { changePercent }),
    marketChange,
    ...(marketChangePercent === undefined ? {} : { marketChangePercent }),
    tradeChange: tradeEffect(effects),
    effects,
    positions: positions.sort((left, right) => {
      if (!left.effects || !right.effects) {
        return left.effects ? -1 : right.effects ? 1 : 0
      }
      return Math.abs(right.change ?? 0) - Math.abs(left.change ?? 0)
    }),
    accounts: [...accounts.values()]
      .filter((account) => account.positionCount > 0)
      .sort((left, right) => Math.abs(right.change) - Math.abs(left.change)),
    currencies: [...currencies.values()].sort(
      (left, right) => Math.abs(right.exchangeRateEffect) - Math.abs(left.exchangeRateEffect)
    ),
    unavailableCount,
    isComplete: unavailableCount === 0
  }
}

function signPrefix(value: number): string {
  return value > 0 ? '+' : ''
}

export function formatSignedMoney(value: number, currency: string): string {
  const rounded = isMeaningfulChange(value) ? value : 0
  return `${signPrefix(rounded)}${formatMoney(rounded, currency)}`
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

export function formatSignedAmount(value: number): string {
  const rounded = isMeaningfulChange(value) ? value : 0
  return `${signPrefix(rounded)}${formatAmount(rounded)}`
}

export function formatSignedPercent(value: number): string {
  const rounded = Math.abs(value) < 0.005 ? 0 : value
  return `${signPrefix(rounded)}${rounded.toFixed(2)}%`
}

// 叙述中使用“万/亿”缩写，便于快速阅读；表格保留完整金额。
export function formatCompactAmount(value: number, options: { signed?: boolean } = {}): string {
  const rounded = isMeaningfulChange(value) ? value : 0
  const absolute = Math.abs(rounded)
  const sign = rounded < 0 ? '-' : options.signed && rounded > 0 ? '+' : ''
  if (absolute >= 1e8) return `${sign}${formatAmount(absolute / 1e8)} 亿`
  if (absolute >= 1e4) return `${sign}${formatAmount(absolute / 1e4)} 万`
  return `${sign}${formatAmount(absolute)}`
}

function formatRate(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(value)
}

export function positionComparisonLabel(position: PositionComparison): string {
  return position.name.trim() || position.symbol
}

export type ComparisonDriverItem = {
  label: string
  value: number
  detail?: string
}

export type ComparisonDriver = {
  key: ComparisonEffectKey
  title: string
  value: number
  description: string
  items: ComparisonDriverItem[]
}

export type ComparisonInsights = {
  headline: string
  summary: string
  drivers: ComparisonDriver[]
  notes: string[]
}

function driverTitle(key: ComparisonEffectKey, value: number): string {
  if (key === 'price') return value > 0 ? '价格上涨' : '价格下跌'
  if (key === 'exchangeRate') return value > 0 ? '外币升值' : '外币贬值'
  if (key === 'bought') return '买入加仓'
  return '卖出减仓'
}

function driverDescription(key: ComparisonEffectKey): string {
  if (key === 'price') return '持有的资产价格变化带来的盈亏'
  if (key === 'exchangeRate') return '外币资产折算成本位币时，汇率变化带来的盈亏'
  if (key === 'bought') return '加仓或新买入的持仓，属于资金投入，不是收益'
  return '减仓或清仓的持仓，属于资金取出，不是亏损'
}

// 列出全部有变化的项目，明细之和等于合计；与合计同方向、金额大的排在前面。
function driverItems(
  comparison: PortfolioComparison,
  key: ComparisonEffectKey,
  value: number
): ComparisonDriverItem[] {
  const contributors: ComparisonDriverItem[] = key === 'exchangeRate'
    ? comparison.currencies
        .filter((item) => isMeaningfulChange(item.exchangeRateEffect))
        .map((item) => ({
          label: `${item.currency}/${comparison.baseCurrency}`,
          value: item.exchangeRateEffect,
          ...(item.fromRate !== undefined && item.toRate !== undefined
            ? {
                detail: `${formatRate(item.fromRate)} → ${formatRate(item.toRate)}${item.rateChangePercent === undefined ? '' : `，${formatSignedPercent(item.rateChangePercent)}`}`
              }
            : {})
        }))
    : comparison.positions
        .filter((position) => position.effects && isMeaningfulChange(position.effects[key]))
        .map((position, _index, positions) => ({
          // 不同账户中的同名持仓附上账户名，便于区分。
          label: positions.some(
            (other) =>
              other !== position &&
              positionComparisonLabel(other) === positionComparisonLabel(position)
          )
            ? `${positionComparisonLabel(position)}（${position.accountName}）`
            : positionComparisonLabel(position),
          value: position.effects![key],
          ...(key !== 'price'
            ? { detail: positionChangeKindLabels[position.kind] }
            : position.priceChangePercent === undefined
              ? {}
              : { detail: `价格 ${formatSignedPercent(position.priceChangePercent)}` })
        }))
  const direction = value > 0 ? 1 : -1
  return contributors.sort((left, right) => right.value * direction - left.value * direction)
}

export function describeComparison(comparison: PortfolioComparison): ComparisonInsights {
  const currency = comparison.baseCurrency
  const { effects } = comparison
  const percent = comparison.changePercent === undefined
    ? ''
    : `（${formatSignedPercent(comparison.changePercent)}）`

  const headline = comparison.direction === 'flat'
    ? '资产总额基本持平'
    : `资产${comparison.direction === 'up' ? '增加' : '减少'} ${formatCompactAmount(Math.abs(comparison.change))} ${currency}${percent}`

  const parts: string[] = []
  if (isMeaningfulChange(comparison.marketChange)) {
    parts.push(
      `市场${comparison.marketChange > 0 ? '上涨赚了' : '下跌亏了'} ${formatCompactAmount(Math.abs(comparison.marketChange))}`
    )
  }
  if (isMeaningfulChange(comparison.tradeChange)) {
    parts.push(
      `买卖调仓${comparison.tradeChange > 0 ? '净投入' : '净取出'} ${formatCompactAmount(Math.abs(comparison.tradeChange))}`
    )
  }
  const summary = parts.length === 0
    ? '这段时间价格、汇率和持仓数量都没有明显变化'
    : `其中${parts.join('，')}`

  // 先讲市场（价格、汇率），再讲买卖，组内按金额大小排序。
  const group = (key: ComparisonEffectKey) =>
    key === 'price' || key === 'exchangeRate' ? 0 : 1
  const drivers = COMPARISON_EFFECT_KEYS
    .filter((key) => isMeaningfulChange(effects[key]))
    .sort((left, right) =>
      group(left) - group(right) || Math.abs(effects[right]) - Math.abs(effects[left])
    )
    .map((key) => ({
      key,
      title: driverTitle(key, effects[key]),
      value: effects[key],
      description: driverDescription(key),
      items: driverItems(comparison, key, effects[key])
    }))

  const notes: string[] = []
  if (comparison.unavailableCount > 0) {
    notes.push(`${comparison.unavailableCount} 项持仓缺少价格或汇率，未计入本次对比`)
  }
  if (isMeaningfulChange(effects.bought) || isMeaningfulChange(effects.sold)) {
    notes.push('买入和卖出金额按终点价格估算；卖出所得如果没有记为持仓，会体现为资金取出')
  }

  return { headline, summary, drivers, notes }
}

// 每条原因压缩成一句话，供报告和 MCP 使用。
export function comparisonReasons(
  insights: ComparisonInsights,
  currency: string
): string[] {
  const limit = 3
  return insights.drivers.map((driver) => {
    const shown = driver.items.slice(0, limit)
    const rest = driver.items.slice(limit)
    const items = [
      ...shown.map((item) => `${item.label} ${formatCompactAmount(item.value, { signed: true })}`),
      ...(rest.length > 0
        ? [`其他 ${rest.length} 项 ${formatCompactAmount(rest.reduce((total, item) => total + item.value, 0), { signed: true })}`]
        : [])
    ].join('、')
    return `${driver.title} ${formatCompactAmount(driver.value, { signed: true })} ${currency}` +
      (items ? `：${items}` : '')
  })
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

export function formatComparisonReport(
  comparison: PortfolioComparison,
  labels: { from: string; to: string },
  options: { positionLimit?: number } = {}
): string {
  const currency = comparison.baseCurrency
  const insights = describeComparison(comparison)
  const positionLimit = options.positionLimit ?? 10
  const lines = [
    '# 资产对比报告',
    '',
    `${labels.from} → ${labels.to}，金额单位 ${currency}`,
    '',
    '## 结论',
    '',
    `**${insights.headline}**，${insights.summary}。`,
    '',
    '| 项目 | 金额 |',
    '| --- | ---: |',
    `| 起点市值 | ${formatMoney(comparison.fromValue, currency)} |`,
    `| 市场涨跌 | ${formatSignedMoney(comparison.marketChange, currency)}${comparison.marketChangePercent === undefined ? '' : `（${formatSignedPercent(comparison.marketChangePercent)}）`} |`,
    `| 　价格涨跌 | ${formatSignedMoney(comparison.effects.price, currency)} |`,
    `| 　汇率变动 | ${formatSignedMoney(comparison.effects.exchangeRate, currency)} |`,
    `| 买卖调仓 | ${formatSignedMoney(comparison.tradeChange, currency)} |`,
    `| 　买入 | ${formatSignedMoney(comparison.effects.bought, currency)} |`,
    `| 　卖出 | ${formatSignedMoney(comparison.effects.sold, currency)} |`,
    `| 终点市值 | ${formatMoney(comparison.toValue, currency)} |`
  ]

  const reasons = comparisonReasons(insights, currency)
  if (reasons.length > 0) {
    lines.push('', '## 主要原因', '', ...reasons.map((reason) => `- ${reason}`))
  }

  const movers = comparison.positions
    .filter((position) => isMeaningfulChange(position.change))
    .slice(0, positionLimit)
  if (movers.length > 0) {
    lines.push(
      '',
      '## 变动最大的持仓',
      '',
      '| 持仓 | 账户 | 操作 | 价格涨跌 | 市值变动 | 其中市场 | 其中买卖 |',
      '| --- | --- | --- | ---: | ---: | ---: | ---: |',
      ...movers.map((position) =>
        `| ${markdownCell(`${positionComparisonLabel(position)} ${position.symbol}`)} | ${markdownCell(position.accountName)} | ${positionChangeKindLabels[position.kind]} | ${position.priceChangePercent === undefined ? '-' : formatSignedPercent(position.priceChangePercent)} | ${formatSignedAmount(position.change!)} | ${formatSignedAmount(marketEffect(position.effects!))} | ${formatSignedAmount(tradeEffect(position.effects!))} |`
      )
    )
  }

  if (comparison.accounts.length > 0) {
    lines.push(
      '',
      '## 账户',
      '',
      '| 账户 | 起点市值 | 终点市值 | 市值变动 | 其中市场 | 其中买卖 |',
      '| --- | ---: | ---: | ---: | ---: | ---: |',
      ...comparison.accounts.map((account) =>
        `| ${markdownCell(account.name)} | ${formatAmount(account.fromValue)} | ${formatAmount(account.toValue)} | ${formatSignedAmount(account.change)} | ${formatSignedAmount(account.marketChange)} | ${formatSignedAmount(account.tradeChange)} |`
      )
    )
  }

  if (insights.notes.length > 0) {
    lines.push('', '## 说明', '', ...insights.notes.map((note) => `- ${note}`))
  }

  const unavailable = comparison.positions.filter((position) => position.unavailableReason)
  if (unavailable.length > 0) {
    lines.push(
      '',
      '## 未计入的持仓',
      '',
      ...unavailable.map(
        (position) =>
          `- ${positionComparisonLabel(position)} ${position.symbol}（${position.accountName}）：${comparisonUnavailableReasonLabels[position.unavailableReason!]}`
      )
    )
  }

  return `${lines.join('\n')}\n`
}
