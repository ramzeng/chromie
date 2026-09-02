import { createCipheriv } from 'node:crypto'
import { request as httpRequest } from 'node:http'

import {
  DEFAULT_HSTONG_GATEWAY_HOST,
  DEFAULT_HSTONG_GATEWAY_PORT,
  type HstongSyncedPosition,
  type HstongSyncOptions,
  type HstongSyncResult
} from '../../shared/hstong'

const REQUEST_TIMEOUT_MS = 10_000
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])
const TRADING_PASSWORD_AES_KEY = Buffer.from(
  'm+qS04/2CH1OweCnmXZ3TDZkCQS+hBzY',
  'base64'
)
const BASIC_QUOTE_TOPIC_ID = 11
const QUOTE_BATCH_SIZE = 200

type GatewayOptions = Required<Pick<HstongSyncOptions, 'host' | 'port'>> &
  Pick<HstongSyncOptions, 'tradingPassword'>

type GatewayEnvelope<T> = {
  ok?: unknown
  err?: unknown
  data?: T
}

type HstongHolding = {
  stockName?: unknown
  currentAmount?: unknown
  stockCode?: unknown
  stockType?: unknown
  exchangeType?: unknown
}

type HstongFunds = {
  enableBalance?: unknown
}

type HstongBasicQuote = {
  security?: {
    dataType?: unknown
    code?: unknown
  }
  lastPrice?: unknown
}

type MarketDefinition = {
  exchangeType: 'K' | 'P' | 'v' | 't'
  market: HstongSyncedPosition['market']
  currency: 'CNY' | 'HKD' | 'USD'
  stockDataType: 10000 | 20000 | 30000
  suffix?: 'HK' | 'SH' | 'SZ'
}

type HoldingWithMarket = {
  holding: HstongHolding
  definition: MarketDefinition
}

type QuoteSecurity = {
  dataType: number
  code: string
}

const MARKETS: readonly MarketDefinition[] = [
  {
    exchangeType: 'K',
    market: 'HK',
    currency: 'HKD',
    stockDataType: 10000,
    suffix: 'HK'
  },
  {
    exchangeType: 'P',
    market: 'US',
    currency: 'USD',
    stockDataType: 20000
  },
  {
    exchangeType: 'v',
    market: 'CN',
    currency: 'CNY',
    stockDataType: 30000,
    suffix: 'SZ'
  },
  {
    exchangeType: 't',
    market: 'CN',
    currency: 'CNY',
    stockDataType: 30000,
    suffix: 'SH'
  }
]

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === 'string' && !value.trim()) return undefined
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : undefined
}

function normalizeOptions(options: HstongSyncOptions = {}): GatewayOptions {
  const rawHost = typeof options.host === 'string' && options.host.trim()
    ? options.host.trim().toLowerCase()
    : DEFAULT_HSTONG_GATEWAY_HOST
  const host = rawHost.startsWith('[') && rawHost.endsWith(']')
    ? rawHost.slice(1, -1)
    : rawHost
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error('华盛 OpenAPI Gateway 仅允许连接本机地址')
  }
  const port = options.port ?? DEFAULT_HSTONG_GATEWAY_PORT
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('华盛 OpenAPI Gateway 端口无效')
  }
  const tradingPassword =
    typeof options.tradingPassword === 'string' && options.tradingPassword.length > 0
      ? options.tradingPassword.slice(0, 256)
      : undefined
  return { host, port, ...(tradingPassword ? { tradingPassword } : {}) }
}

function gatewayAddress(options: GatewayOptions): string {
  const host = options.host === '::1' ? '[::1]' : options.host
  return `${host}:${options.port}`
}

function gatewayErrorMessage(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (!value || typeof value !== 'object') return '未知错误'
  const error = value as { message?: unknown; error?: unknown }
  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message.trim()
  }
  if (typeof error.error === 'string' && error.error.trim()) {
    return error.error.trim()
  }
  return '未知错误'
}

function request<T>(
  path: string,
  params: Record<string, unknown>,
  options: GatewayOptions
): Promise<T> {
  const payload = JSON.stringify({ timeout_sec: 10, params })
  return new Promise<T>((resolve, reject) => {
    const gatewayRequest = httpRequest(
      {
        hostname: options.host,
        port: options.port,
        path,
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      (response) => {
        const chunks: Buffer[] = []
        let size = 0
        response.on('error', (error) => reject(error))
        response.on('data', (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
          size += buffer.length
          if (size > MAX_RESPONSE_BYTES) {
            response.destroy(new Error('华盛 Gateway 响应过大'))
            return
          }
          chunks.push(buffer)
        })
        response.on('end', () => {
          const status = response.statusCode ?? 0
          const rawBody = Buffer.concat(chunks).toString('utf8')
          let body: GatewayEnvelope<T>
          try {
            body = rawBody ? JSON.parse(rawBody) as GatewayEnvelope<T> : {}
          } catch {
            reject(new Error(`华盛 Gateway 返回异常（HTTP ${status || '未知'}）`))
            return
          }
          if (status < 200 || status >= 300) {
            reject(
              new Error(
                gatewayErrorMessage(body.err) === '未知错误'
                  ? `华盛 Gateway 请求失败（HTTP ${status}）`
                  : `华盛 Gateway 请求失败：${gatewayErrorMessage(body.err)}`
              )
            )
            return
          }
          if (body.ok !== true) {
            reject(new Error(`华盛 Gateway 请求失败：${gatewayErrorMessage(body.err)}`))
            return
          }
          resolve(body.data as T)
        })
      }
    )
    gatewayRequest.setTimeout(REQUEST_TIMEOUT_MS, () => {
      gatewayRequest.destroy(new Error('华盛 Gateway 请求超时'))
    })
    gatewayRequest.on('error', (error) => reject(error))
    gatewayRequest.end(payload)
  })
}

function encryptTradingPassword(password: string): string {
  const cipher = createCipheriv('aes-192-ecb', TRADING_PASSWORD_AES_KEY, null)
  cipher.setAutoPadding(true)
  return Buffer.concat([
    cipher.update(password, 'utf8'),
    cipher.final()
  ]).toString('base64')
}

function listFromData(value: unknown, key: string): unknown[] {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'object') return []
  const record = value as Record<string, unknown>
  if (Array.isArray(record[key])) return record[key]
  if (Array.isArray(record.data)) return record.data
  return typeof record.stockCode === 'string' ? [record] : []
}

function stockDataType(
  definition: MarketDefinition,
  stockType: unknown
): number {
  if (stockType === '1' || stockType === 1) return definition.stockDataType + 2
  if (definition.exchangeType === 'K') {
    if (stockType === 'D' || stockType === 'F') return 10003
    if (stockType === 'U') return 10005
  }
  return definition.stockDataType
}

function stripMarketSuffix(code: string): string {
  return code.replace(/\.(?:HK|SH|SZ|US)$/i, '').toUpperCase()
}

function quoteCode(code: string, definition: MarketDefinition): string {
  const normalized = code.trim().toUpperCase()
  if (!definition.suffix) return stripMarketSuffix(normalized)
  if (normalized.endsWith(`.${definition.suffix}`)) {
    return normalized
  }
  return `${stripMarketSuffix(normalized)}.${definition.suffix}`
}

function quoteKey(security: QuoteSecurity): string {
  return `${security.dataType}:${security.code.toUpperCase()}`
}

function holdingSecurity(item: HoldingWithMarket): QuoteSecurity | null {
  if (typeof item.holding.stockCode !== 'string' || !item.holding.stockCode.trim()) {
    return null
  }
  return {
    dataType: stockDataType(item.definition, item.holding.stockType),
    code: quoteCode(item.holding.stockCode, item.definition)
  }
}

async function queryPrices(
  securities: QuoteSecurity[],
  options: GatewayOptions
): Promise<Map<string, number>> {
  const prices = new Map<string, number>()
  const uniqueSecurities = [...new Map(
    securities.map((security) => [quoteKey(security), security] as const)
  ).values()]

  for (let index = 0; index < uniqueSecurities.length; index += QUOTE_BATCH_SIZE) {
    const batch = uniqueSecurities.slice(index, index + QUOTE_BATCH_SIZE)
    let subscribed = false
    try {
      await request('/hq/Subscribe', {
        topicId: BASIC_QUOTE_TOPIC_ID,
        security: batch
      }, options)
      subscribed = true
      const data = await request<unknown>('/hq/BasicQot', {
        security: batch,
        needDelayFlag: '1'
      }, options)
      listFromData(data, 'basicQot').forEach((value) => {
        if (!value || typeof value !== 'object') return
        const quote = value as HstongBasicQuote
        const dataType = finiteNumber(quote.security?.dataType)
        const code = quote.security?.code
        const price = finiteNumber(quote.lastPrice)
        if (
          dataType === undefined ||
          typeof code !== 'string' ||
          !code.trim() ||
          price === undefined ||
          price <= 0
        ) {
          return
        }
        prices.set(quoteKey({ dataType, code: code.trim() }), price)
      })
    } catch {
      // A missing market-data entitlement must not block position quantities.
    } finally {
      if (subscribed) {
        try {
          await request('/hq/Unsubscribe', {
            topicId: BASIC_QUOTE_TOPIC_ID,
            security: batch
          }, options)
        } catch {
          // The Gateway also clears subscriptions when its session ends.
        }
      }
    }
  }
  return prices
}

function normalizeHolding(
  item: HoldingWithMarket,
  prices: Map<string, number>
): HstongSyncedPosition | null {
  const quantity = finiteNumber(item.holding.currentAmount)
  const security = holdingSecurity(item)
  if (quantity === undefined || quantity === 0 || !security) return null
  const symbol = stripMarketSuffix(security.code)
  const name =
    typeof item.holding.stockName === 'string' && item.holding.stockName.trim()
      ? item.holding.stockName.trim()
      : symbol
  const price = prices.get(quoteKey(security))
  return {
    market: item.definition.market,
    symbol,
    name,
    currency: item.definition.currency,
    quantity,
    ...(price === undefined ? {} : { price })
  }
}

function mergePositions(
  positions: HstongSyncedPosition[]
): HstongSyncedPosition[] {
  const merged = new Map<string, HstongSyncedPosition>()
  positions.forEach((position) => {
    const key = `${position.market}:${position.currency}:${position.symbol}`
    const current = merged.get(key)
    if (!current) {
      merged.set(key, { ...position })
      return
    }
    current.quantity += position.quantity
    if (position.price !== undefined) current.price = position.price
  })
  return [...merged.values()]
    .filter((position) => Math.abs(position.quantity) > Number.EPSILON)
    .sort((left, right) => {
      const leftValue = Math.abs(left.quantity * (left.price ?? 0))
      const rightValue = Math.abs(right.quantity * (right.price ?? 0))
      return rightValue - leftValue || left.symbol.localeCompare(right.symbol)
    })
}

function needsTradingLogin(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes('1012') ||
    message.includes('1014') ||
    message.includes('未登录') ||
    message.includes('登录超时')
  )
}

function loadMarketData(options: GatewayOptions) {
  return Promise.all(MARKETS.map(async (definition) => {
    const [holdingData, fundData] = await Promise.all([
      request<unknown>('/trade/TradeQueryHoldsList', {
        exchangeType: definition.exchangeType
      }, options),
      request<unknown>('/trade/TradeQueryMarginFundInfo', {
        exchangeType: definition.exchangeType
      }, options)
    ])
    return { definition, holdingData, fundData }
  }))
}

function friendlyError(error: unknown, options: GatewayOptions): Error {
  const message = error instanceof Error ? error.message : String(error)
  if (needsTradingLogin(error)) {
    return new Error(
      '华盛 Gateway 尚未完成交易登录；请在 Gateway 执行 tradelogin，或在 Chromie 中配置交易密码'
    )
  }
  if (
    message.includes('ECONNREFUSED') ||
    message.includes('socket hang up') ||
    message.includes('ECONNRESET')
  ) {
    return new Error(`无法连接华盛 OpenAPI Gateway（${gatewayAddress(options)}）`)
  }
  return message.startsWith('华盛')
    ? new Error(message)
    : new Error(`华盛同步失败：${message}`)
}

export async function syncHstongPositions(
  rawOptions: HstongSyncOptions = {}
): Promise<HstongSyncResult> {
  const options = normalizeOptions(rawOptions)
  try {
    let marketData: Awaited<ReturnType<typeof loadMarketData>>
    try {
      marketData = await loadMarketData(options)
    } catch (error) {
      if (!options.tradingPassword || !needsTradingLogin(error)) throw error
      const login = await request<{ success?: unknown }>('/trade/TradeLogin', {
        password: encryptTradingPassword(options.tradingPassword)
      }, options)
      if (login?.success !== true) {
        throw new Error('华盛 Gateway 交易登录失败')
      }
      marketData = await loadMarketData(options)
    }

    const holdings = marketData.flatMap(({ definition, holdingData }) =>
      listFromData(holdingData, 'holdsList').map((holding) => ({
        definition,
        holding: holding as HstongHolding
      }))
    )
    const securities = holdings.flatMap((holding) => {
      const security = holdingSecurity(holding)
      return security ? [security] : []
    })
    const prices = await queryPrices(securities, options)
    const positions = holdings.flatMap((holding) => {
      const position = normalizeHolding(holding, prices)
      return position ? [position] : []
    })

    const cashByCurrency = new Map<string, HstongSyncedPosition>()
    marketData.forEach(({ definition, fundData }) => {
      if (!fundData || typeof fundData !== 'object') return
      const funds = fundData as HstongFunds
      const quantity = finiteNumber(funds.enableBalance)
      if (quantity === undefined || quantity === 0) return
      const current = cashByCurrency.get(definition.currency)
      if (current && current.quantity !== 0) return
      cashByCurrency.set(definition.currency, {
        market: definition.market,
        symbol: 'CASH',
        name: '现金',
        currency: definition.currency,
        quantity,
        price: 1
      })
    })

    return {
      positions: mergePositions([...positions, ...cashByCurrency.values()]),
      marketCount: MARKETS.length,
      syncedAt: new Date().toISOString()
    }
  } catch (error) {
    throw friendlyError(error, options)
  }
}
