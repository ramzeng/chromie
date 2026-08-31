import type { ExchangeRateState } from '@/lib/exchange-rates'
import {
  formatMoney,
  formatNumber,
  type AssetAccount,
  type Position,
  type PositionGroup,
  type ProductAccount
} from '@/lib/portfolio'
import { valuePositions } from '@/lib/valuation'

type OverviewMode = 'accounts' | 'groups'
type ExchangeRateView = Pick<ExchangeRateState, 'snapshot' | 'status' | 'error'>

export type ShareImageScope =
  | { kind: 'overview'; mode: OverviewMode }
  | { kind: 'asset-account'; account: AssetAccount }
  | { kind: 'position-group'; group: PositionGroup }

type DistributionRow = {
  id: string
  name: string
  holder: string
  marketValues: Record<string, number | undefined>
  anchoredValue?: number
  percentage?: number
}

type PositionRow = {
  position: Position
  accountName: string
  holder: string
  marketValue?: number
  anchoredValue?: number
  percentage?: number
}

const CANVAS_WIDTH = 1440
const PAGE_PADDING = 72
const CONTENT_WIDTH = CANVAS_WIDTH - PAGE_PADDING * 2
const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif'
const DISPLAY_CURRENCIES = ['USD', 'HKD', 'CNY'] as const

const palette = {
  background: '#f5f4ef',
  card: '#ffffff',
  foreground: '#23241f',
  muted: '#777970',
  faint: '#a5a79f',
  border: '#e2e1da',
  green: '#153f32',
  greenSoft: '#e9f0eb',
  greenMuted: '#557266',
  header: '#f8f8f5',
  rowAlt: '#fbfbf8'
} as const

function setFont(
  context: CanvasRenderingContext2D,
  size: number,
  weight: 400 | 500 | 600 | 700 = 400
): void {
  context.font = `${weight} ${size}px ${FONT_FAMILY}`
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + safeRadius, y)
  context.arcTo(x + width, y, x + width, y + height, safeRadius)
  context.arcTo(x + width, y + height, x, y + height, safeRadius)
  context.arcTo(x, y + height, x, y, safeRadius)
  context.arcTo(x, y, x + width, y, safeRadius)
  context.closePath()
}

function fillRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: string
): void {
  roundedRect(context, x, y, width, height, radius)
  context.fillStyle = color
  context.fill()
}

function strokeRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: string
): void {
  roundedRect(context, x, y, width, height, radius)
  context.strokeStyle = color
  context.lineWidth = 1
  context.stroke()
}

function drawText(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  color: string = palette.foreground,
  align: CanvasTextAlign = 'left'
): void {
  context.fillStyle = color
  context.textAlign = align
  context.textBaseline = 'middle'
  context.fillText(value, x, y)
}

function truncateText(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number
): string {
  if (context.measureText(value).width <= maxWidth) return value
  let left = 0
  let right = value.length
  while (left < right) {
    const middle = Math.ceil((left + right) / 2)
    if (context.measureText(`${value.slice(0, middle)}…`).width <= maxWidth) left = middle
    else right = middle - 1
  }
  return `${value.slice(0, left)}…`
}

function formatDecimal(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

function formatRate(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(value)
}

function formatDate(value: string | undefined): string {
  const date = value ? new Date(value) : new Date()
  const safeDate = Number.isFinite(date.getTime()) ? date : new Date()
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(safeDate)
}

function marketValuesFor(positions: Position[]): Record<string, number | undefined> {
  const values: Record<string, number | undefined> = {}
  DISPLAY_CURRENCIES.forEach((currency) => {
    let total = 0
    let hasValue = false
    positions.forEach((position) => {
      if (position.currency !== currency || position.price === undefined) return
      total += position.quantity * position.price
      hasValue = true
    })
    values[currency] = hasValue ? total : undefined
  })
  return values
}

function compareOptionalDescending(left: number | undefined, right: number | undefined): number {
  if (left === undefined) return right === undefined ? 0 : 1
  if (right === undefined) return -1
  return right - left
}

function distributionRows(
  account: ProductAccount,
  mode: OverviewMode,
  exchangeRates: ExchangeRateView
): DistributionRow[] {
  const rates = exchangeRates.snapshot?.rates
  const sourceRows = mode === 'accounts'
    ? account.assetAccounts.map((assetAccount) => ({
        id: assetAccount.id,
        name: assetAccount.name,
        holder:
          account.holders.find((holder) => holder.id === assetAccount.holderId)?.name ?? '-',
        positions: assetAccount.positions
      }))
    : account.positionGroups.map((group) => {
        const positionIds = new Set(group.positionIds)
        const ownerAccounts = account.assetAccounts.filter((assetAccount) =>
          assetAccount.positions.some((position) => positionIds.has(position.id))
        )
        const positions = ownerAccounts.flatMap((assetAccount) =>
          assetAccount.positions.filter((position) => positionIds.has(position.id))
        )
        const holders = [
          ...new Set(
            ownerAccounts.map(
              (assetAccount) =>
                account.holders.find((holder) => holder.id === assetAccount.holderId)?.name ?? '-'
            )
          )
        ]
        return {
          id: group.id,
          name: group.name,
          holder: holders.join('、') || '-',
          positions
        }
      })

  const valuedRows = sourceRows.map((row) => ({
    ...row,
    valuation: valuePositions(row.positions, account.anchorCurrency, rates)
  }))
  const hasMissingRate = valuedRows.some((row) => !row.valuation.isComplete)
  const total = valuedRows.reduce(
    (sum, row) => sum + (row.valuation.totalAnchoredMarketValue ?? 0),
    0
  )
  const canCalculatePercentage = !hasMissingRate && total !== 0

  return valuedRows
    .map((row) => ({
      id: row.id,
      name: row.name,
      holder: row.holder,
      marketValues: marketValuesFor(row.positions),
      anchoredValue: row.valuation.isComplete
        ? row.valuation.totalAnchoredMarketValue
        : undefined,
      percentage:
        canCalculatePercentage && row.valuation.totalAnchoredMarketValue !== undefined
          ? row.valuation.totalAnchoredMarketValue / total * 100
          : undefined
    }))
    .sort((left, right) =>
      compareOptionalDescending(left.anchoredValue, right.anchoredValue)
    )
}

function positionsForScope(account: ProductAccount, scope: ShareImageScope): Position[] {
  if (scope.kind === 'overview') {
    return account.assetAccounts.flatMap((assetAccount) => assetAccount.positions)
  }
  if (scope.kind === 'asset-account') return scope.account.positions

  const positionIds = new Set(scope.group.positionIds)
  return account.assetAccounts.flatMap((assetAccount) =>
    assetAccount.positions.filter((position) => positionIds.has(position.id))
  )
}

function positionRows(
  account: ProductAccount,
  scope: Exclude<ShareImageScope, { kind: 'overview' }>,
  exchangeRates: ExchangeRateView
): PositionRow[] {
  const items = scope.kind === 'asset-account'
    ? scope.account.positions.map((position) => ({
        position,
        account: scope.account
      }))
    : (() => {
        const positionIds = new Set(scope.group.positionIds)
        return account.assetAccounts.flatMap((assetAccount) =>
          assetAccount.positions.flatMap((position) =>
            positionIds.has(position.id) ? [{ position, account: assetAccount }] : []
          )
        )
      })()
  const valuation = valuePositions(
    items.map((item) => item.position),
    account.anchorCurrency,
    exchangeRates.snapshot?.rates
  )
  const canCalculatePercentage =
    valuation.isComplete &&
    valuation.totalAnchoredMarketValue !== undefined &&
    valuation.totalAnchoredMarketValue !== 0

  return items
    .map(({ position, account: assetAccount }) => {
      const positionValuation = valuation.byPositionId.get(position.id)
      return {
        position,
        accountName: assetAccount.name,
        holder:
          account.holders.find((holder) => holder.id === assetAccount.holderId)?.name ?? '-',
        marketValue: positionValuation?.marketValue,
        anchoredValue: positionValuation?.anchoredMarketValue,
        percentage:
          canCalculatePercentage && positionValuation?.anchoredMarketValue !== undefined
            ? positionValuation.anchoredMarketValue /
              valuation.totalAnchoredMarketValue! * 100
            : undefined
      }
    })
    .sort((left, right) =>
      compareOptionalDescending(left.anchoredValue, right.anchoredValue)
    )
}

function scopeTitle(account: ProductAccount, scope: ShareImageScope): string {
  if (scope.kind === 'asset-account') return scope.account.name
  if (scope.kind === 'position-group') return scope.group.name
  return account.name
}

function scopeLabel(scope: ShareImageScope): string {
  if (scope.kind === 'asset-account') return '资产账户'
  if (scope.kind === 'position-group') return '持仓分组'
  return scope.mode === 'accounts' ? '资产账户透视' : '持仓分组透视'
}

function drawSectionTitle(
  context: CanvasRenderingContext2D,
  index: string,
  title: string,
  y: number
): void {
  fillRoundedRect(context, PAGE_PADDING, y - 17, 36, 36, 10, palette.green)
  setFont(context, 17, 700)
  drawText(context, index, PAGE_PADDING + 18, y + 1, '#ffffff', 'center')
  setFont(context, 27, 600)
  drawText(context, title, PAGE_PADDING + 54, y, palette.foreground)
}

function renderShareImage(
  canvas: HTMLCanvasElement,
  account: ProductAccount,
  scope: ShareImageScope,
  exchangeRates: ExchangeRateView,
  masked: boolean,
  snapshotAt?: string
): void {
  const positions = positionsForScope(account, scope)
  const overviewRows = scope.kind === 'overview'
    ? distributionRows(account, scope.mode, exchangeRates)
    : []
  const holdingRows = scope.kind === 'overview'
    ? []
    : positionRows(account, scope, exchangeRates)
  const rowCount = scope.kind === 'overview' ? overviewRows.length : holdingRows.length
  const tableRowCount = Math.max(rowCount, 1)
  const tableY = 650
  const tableHeaderHeight = 72
  const tableRowHeight = scope.kind === 'overview' ? 76 : 84
  const tableHeight = tableHeaderHeight + tableRowCount * tableRowHeight
  const canvasHeight = Math.max(1080, tableY + tableHeight + 154)

  canvas.width = CANVAS_WIDTH
  canvas.height = canvasHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前环境无法生成分享图片')

  context.clearRect(0, 0, CANVAS_WIDTH, canvasHeight)
  const background = context.createLinearGradient(0, 0, CANVAS_WIDTH, canvasHeight)
  background.addColorStop(0, '#f1f5f0')
  background.addColorStop(0.42, palette.background)
  background.addColorStop(1, '#f8f1e8')
  context.fillStyle = background
  context.fillRect(0, 0, CANVAS_WIDTH, canvasHeight)

  const glow = context.createRadialGradient(1220, 80, 0, 1220, 80, 360)
  glow.addColorStop(0, 'rgba(202, 221, 207, 0.48)')
  glow.addColorStop(1, 'rgba(202, 221, 207, 0)')
  context.fillStyle = glow
  context.fillRect(840, 0, 600, 440)

  fillRoundedRect(context, PAGE_PADDING, 66, 58, 58, 17, palette.green)
  setFont(context, 28, 700)
  drawText(context, 'C', PAGE_PADDING + 29, 96, '#ffffff', 'center')
  setFont(context, 30, 700)
  drawText(context, 'Chromie', PAGE_PADDING + 78, 86)
  setFont(context, 18, 400)
  drawText(context, '资产分享', PAGE_PADDING + 80, 116, palette.muted)

  setFont(context, 24, 600)
  drawText(
    context,
    truncateText(context, scopeTitle(account, scope), 460),
    CANVAS_WIDTH - PAGE_PADDING,
    83,
    palette.foreground,
    'right'
  )
  setFont(context, 17, 400)
  const timeLabel = snapshotAt ? `历史快照 · ${formatDate(snapshotAt)}` : `生成于 ${formatDate(undefined)}`
  drawText(
    context,
    truncateText(
      context,
      `${scope.kind === 'overview' ? '' : `${account.name} · `}${scopeLabel(scope)} · ${timeLabel}`,
      660
    ),
    CANVAS_WIDTH - PAGE_PADDING,
    116,
    palette.muted,
    'right'
  )

  drawSectionTitle(context, '01', '市值 & 汇率', 194)

  const cardTop = 230
  const cardHeight = 170
  const cardGap = 16
  const cardWidth = (CONTENT_WIDTH - cardGap * 2) / 3
  DISPLAY_CURRENCIES.forEach((currency, index) => {
    const x = PAGE_PADDING + index * (cardWidth + cardGap)
    context.save()
    context.shadowColor = 'rgba(36, 39, 31, 0.055)'
    context.shadowBlur = 24
    context.shadowOffsetY = 8
    fillRoundedRect(context, x, cardTop, cardWidth, cardHeight, 22, palette.card)
    context.restore()
    strokeRoundedRect(context, x, cardTop, cardWidth, cardHeight, 22, palette.border)

    const valuation = valuePositions(positions, currency, exchangeRates.snapshot?.rates)
    const hasCompleteValue =
      valuation.isComplete && valuation.totalAnchoredMarketValue !== undefined
    setFont(context, 19, 500)
    drawText(context, `${currency} 市值`, x + 28, cardTop + 38, palette.muted)
    setFont(context, masked && hasCompleteValue ? 38 : 35, 600)
    const value = hasCompleteValue
      ? masked
        ? '••••••'
        : formatMoney(valuation.totalAnchoredMarketValue!, currency)
      : '-'
    drawText(
      context,
      truncateText(context, value, cardWidth - 56),
      x + 28,
      cardTop + 96,
      palette.foreground
    )
    if (!hasCompleteValue && valuation.missingCurrencies.length) {
      setFont(context, 15, 400)
      const hint = `缺少 ${valuation.missingCurrencies.join('、')} 汇率`
      drawText(context, hint, x + 28, cardTop + 137, palette.faint)
    }
  })

  const rateTop = 420
  fillRoundedRect(context, PAGE_PADDING, rateTop, CONTENT_WIDTH, 82, 18, palette.greenSoft)
  setFont(context, 17, 600)
  drawText(context, '参考汇率', PAGE_PADDING + 26, rateTop + 41, palette.green)
  let rateX = PAGE_PADDING + 132
  const cnyRate = exchangeRates.snapshot?.rates.CNY
  const hkdRate = exchangeRates.snapshot?.rates.HKD
  const rateItems: Array<{ label: string; value: number }> = []
  if (typeof cnyRate === 'number' && Number.isFinite(cnyRate) && cnyRate > 0) {
    rateItems.push({ label: 'USD/CNY', value: cnyRate })
  }
  if (typeof hkdRate === 'number' && Number.isFinite(hkdRate) && hkdRate > 0) {
    rateItems.push({ label: 'USD/HKD', value: hkdRate })
  }
  if (
    typeof cnyRate === 'number' && cnyRate > 0 &&
    typeof hkdRate === 'number' && hkdRate > 0
  ) {
    rateItems.push({ label: 'HKD/CNY', value: cnyRate / hkdRate })
  }
  rateItems.forEach((item) => {
    const label = `${item.label}  ${formatRate(item.value)}`
    setFont(context, 17, 500)
    const width = context.measureText(label).width + 30
    fillRoundedRect(context, rateX, rateTop + 22, width, 40, 12, '#ffffffb8')
    drawText(context, label, rateX + 15, rateTop + 42, palette.green)
    rateX += width + 10
  })
  setFont(context, 15, 400)
  const rateStatus = exchangeRates.snapshot
    ? `${exchangeRates.status === 'error' ? '缓存汇率' : '同步于'} ${formatDate(exchangeRates.snapshot.fetchedAt)}`
    : exchangeRates.status === 'loading'
      ? '正在获取汇率'
      : '暂无汇率'
  drawText(
    context,
    rateStatus,
    CANVAS_WIDTH - PAGE_PADDING - 26,
    rateTop + 42,
    palette.greenMuted,
    'right'
  )

  drawSectionTitle(context, '02', '持仓分布', 584)
  setFont(context, 16, 400)
  drawText(
    context,
    scope.kind === 'overview'
      ? `${overviewRows.length} 个${scope.mode === 'accounts' ? '资产账户' : '持仓分组'}`
      : `${holdingRows.length} 项持仓`,
    CANVAS_WIDTH - PAGE_PADDING,
    584,
    palette.muted,
    'right'
  )

  context.save()
  roundedRect(context, PAGE_PADDING, tableY, CONTENT_WIDTH, tableHeight, 22)
  context.clip()
  context.fillStyle = palette.card
  context.fillRect(PAGE_PADDING, tableY, CONTENT_WIDTH, tableHeight)
  context.fillStyle = palette.header
  context.fillRect(PAGE_PADDING, tableY, CONTENT_WIDTH, tableHeaderHeight)

  const columnWidths = scope.kind === 'overview'
    ? [250, 170, 145, 145, 145, 245, 132]
    : scope.kind === 'asset-account'
      ? [280, 110, 140, 160, 220, 220, 102]
      : [160, 110, 200, 110, 130, 180, 220, 122]
  const columnLabels = scope.kind === 'overview'
    ? [
        scope.mode === 'accounts' ? '资产账户' : '持仓分组',
        '持有人',
        'USD',
        'HKD',
        'CNY',
        `锚定市值 · ${account.anchorCurrency}`,
        '占比'
      ]
    : scope.kind === 'asset-account'
      ? [
          '名称代码',
          '币种',
          '数量',
          '当前价格',
          '市值',
          `锚定市值 · ${account.anchorCurrency}`,
          '占比'
        ]
      : [
          '资产账户',
          '持有人',
          '名称代码',
          '数量',
          '当前价格',
          '市值',
          `锚定市值 · ${account.anchorCurrency}`,
          '占比'
        ]
  const firstNumericColumn = scope.kind === 'overview'
    ? 2
    : scope.kind === 'asset-account'
      ? 2
      : 3
  let columnX = PAGE_PADDING + 32
  setFont(context, 15, 600)
  columnLabels.forEach((label, index) => {
    const numeric = index >= firstNumericColumn
    drawText(
      context,
      label,
      numeric ? columnX + columnWidths[index] - 8 : columnX,
      tableY + tableHeaderHeight / 2,
      palette.muted,
      numeric ? 'right' : 'left'
    )
    columnX += columnWidths[index]
  })

  if (!rowCount) {
    setFont(context, 20, 500)
    drawText(
      context,
      scope.kind === 'overview'
        ? `暂无${scope.mode === 'accounts' ? '资产账户' : '持仓分组'}`
        : '暂无持仓',
      CANVAS_WIDTH / 2,
      tableY + tableHeaderHeight + tableRowHeight / 2,
      palette.faint,
      'center'
    )
  }

  Array.from({ length: rowCount }).forEach((_, rowIndex) => {
    const rowY = tableY + tableHeaderHeight + rowIndex * tableRowHeight
    if (rowIndex % 2 === 1) {
      context.fillStyle = palette.rowAlt
      context.fillRect(PAGE_PADDING, rowY, CONTENT_WIDTH, tableRowHeight)
    }
    context.fillStyle = palette.border
    context.fillRect(PAGE_PADDING + 24, rowY, CONTENT_WIDTH - 48, 1)
  })

  overviewRows.forEach((row, rowIndex) => {
    const rowY = tableY + tableHeaderHeight + rowIndex * tableRowHeight

    let x = PAGE_PADDING + 32
    setFont(context, 17, 600)
    drawText(
      context,
      truncateText(context, row.name, columnWidths[0] - 26),
      x,
      rowY + tableRowHeight / 2
    )
    x += columnWidths[0]
    setFont(context, 16, 400)
    drawText(
      context,
      truncateText(context, row.holder, columnWidths[1] - 24),
      x,
      rowY + tableRowHeight / 2,
      palette.muted
    )
    x += columnWidths[1]

    DISPLAY_CURRENCIES.forEach((currency, currencyIndex) => {
      const value = row.marketValues[currency]
      const label = value === undefined ? '-' : masked ? '••••••' : formatDecimal(value)
      setFont(context, masked && value !== undefined ? 16 : 16, 500)
      drawText(
        context,
        label,
        x + columnWidths[currencyIndex + 2] - 8,
        rowY + tableRowHeight / 2,
        value === undefined ? palette.faint : palette.foreground,
        'right'
      )
      x += columnWidths[currencyIndex + 2]
    })

    const anchoredLabel = row.anchoredValue === undefined
      ? '-'
      : masked
        ? '••••••'
        : formatMoney(row.anchoredValue, account.anchorCurrency)
    setFont(context, 16, 600)
    drawText(
      context,
      truncateText(context, anchoredLabel, columnWidths[5] - 16),
      x + columnWidths[5] - 8,
      rowY + tableRowHeight / 2,
      row.anchoredValue === undefined ? palette.faint : palette.foreground,
      'right'
    )
    x += columnWidths[5]
    setFont(context, 16, 500)
    drawText(
      context,
      row.percentage === undefined ? '-' : `${formatDecimal(row.percentage)}%`,
      x + columnWidths[6] - 8,
      rowY + tableRowHeight / 2,
      palette.muted,
      'right'
    )
  })

  holdingRows.forEach((row, rowIndex) => {
    const rowY = tableY + tableHeaderHeight + rowIndex * tableRowHeight
    const centerY = rowY + tableRowHeight / 2
    const position = row.position
    const marketValueLabel = row.marketValue === undefined
      ? '-'
      : masked
        ? '••••••'
        : formatMoney(row.marketValue, position.currency)
    const anchoredValueLabel = row.anchoredValue === undefined
      ? '-'
      : masked
        ? '••••••'
        : formatMoney(row.anchoredValue, account.anchorCurrency)
    const quantityLabel = masked ? '••••••' : formatNumber(position.quantity)
    const priceLabel = position.price === undefined
      ? '-'
      : masked
        ? '••••••'
        : formatMoney(position.price, position.currency)
    let x = PAGE_PADDING + 32

    if (scope.kind === 'position-group') {
      setFont(context, 16, 500)
      drawText(
        context,
        truncateText(context, row.accountName, columnWidths[0] - 20),
        x,
        centerY
      )
      x += columnWidths[0]
      setFont(context, 15, 400)
      drawText(
        context,
        truncateText(context, row.holder, columnWidths[1] - 18),
        x,
        centerY,
        palette.muted
      )
      x += columnWidths[1]
    }

    const nameColumnIndex = scope.kind === 'asset-account' ? 0 : 2
    setFont(context, 16, 600)
    drawText(
      context,
      truncateText(
        context,
        `${position.market}.${position.symbol}`,
        columnWidths[nameColumnIndex] - 20
      ),
      x,
      centerY - 12
    )
    setFont(context, 13, 400)
    drawText(
      context,
      truncateText(context, position.name, columnWidths[nameColumnIndex] - 20),
      x,
      centerY + 15,
      palette.muted
    )
    x += columnWidths[nameColumnIndex]

    if (scope.kind === 'asset-account') {
      setFont(context, 15, 500)
      drawText(context, position.currency, x, centerY, palette.muted)
      x += columnWidths[1]
    }

    const remainingValues = [
      quantityLabel,
      priceLabel,
      marketValueLabel,
      anchoredValueLabel,
      row.percentage === undefined ? '-' : `${formatDecimal(row.percentage)}%`
    ]
    const valueStartIndex = scope.kind === 'asset-account' ? 2 : 3
    remainingValues.forEach((value, valueIndex) => {
      const columnIndex = valueStartIndex + valueIndex
      setFont(context, 15, valueIndex >= 2 && valueIndex <= 3 ? 600 : 500)
      drawText(
        context,
        truncateText(context, value, columnWidths[columnIndex] - 16),
        x + columnWidths[columnIndex] - 8,
        centerY,
        value === '-' || valueIndex === 4 ? palette.muted : palette.foreground,
        'right'
      )
      x += columnWidths[columnIndex]
    })
  })
  context.restore()
  strokeRoundedRect(context, PAGE_PADDING, tableY, CONTENT_WIDTH, tableHeight, 22, palette.border)

  setFont(context, 15, 400)
  drawText(context, '数据来自本地 Chromie 账户', PAGE_PADDING, canvasHeight - 64, palette.faint)
  drawText(
    context,
    masked ? '资产数值已遮蔽' : '市值仅供个人记录参考',
    CANVAS_WIDTH - PAGE_PADDING,
    canvasHeight - 64,
    palette.faint,
    'right'
  )
}

export async function createShareImageDataUrl({
  account,
  scope,
  exchangeRates,
  masked,
  snapshotAt
}: {
  account: ProductAccount
  scope: ShareImageScope
  exchangeRates: ExchangeRateView
  masked: boolean
  snapshotAt?: string
}): Promise<string> {
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  renderShareImage(canvas, account, scope, exchangeRates, masked, snapshotAt)
  return canvas.toDataURL('image/png')
}
