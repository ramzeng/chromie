import FutuWebSocket from 'futu-api'

import {
  DEFAULT_FUTU_OPEND_HOST,
  DEFAULT_FUTU_OPEND_PORT,
  type FutuSyncedPosition,
  type FutuSyncOptions,
  type FutuSyncResult
} from '../shared/futu'

const FutuClient =
  (FutuWebSocket as typeof FutuWebSocket & { default?: typeof FutuWebSocket }).default ??
  FutuWebSocket

type FutuLong = string | number | { toString(): string }

type FutuAccount = {
  trdEnv: number
  accID: FutuLong
  trdMarketAuthList?: number[]
}

type FutuPosition = {
  positionSide?: number
  code: string
  name: string
  qty: number
  price?: number
  secMarket?: number
  currency?: number
}

type FutuCashInfo = {
  currency?: number
  cash?: number
}

type FutuFunds = {
  cash?: number
  currency?: number
  cashInfoList?: FutuCashInfo[]
  hkCash?: number
  usCash?: number
}

type AccountListPayload = { accList?: FutuAccount[] }
type PositionListPayload = { positionList?: FutuPosition[] }
type FundsPayload = { funds?: FutuFunds }

const TRADING_ENV_REAL = 1
const TRADING_CATEGORY_SECURITY = 1
const MARKET_HK = 1
const MARKET_US = 2
const POSITION_SIDE_SHORT = 1

const connection = {
  host: process.env.FUTU_OPEND_WS_HOST || DEFAULT_FUTU_OPEND_HOST,
  port: Number(process.env.FUTU_OPEND_WS_PORT || DEFAULT_FUTU_OPEND_PORT),
  ssl: process.env.FUTU_OPEND_WS_SSL === 'true',
  key: process.env.FUTU_OPEND_WS_KEY || ''
}

function closeClient(client: FutuWebSocket): void {
  try {
    client.stop()
    client.websock?.close()
  } catch {
    // The connection may already be closed by the SDK.
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const response = error as { retMsg?: unknown; errmsg?: unknown }
    if (typeof response.retMsg === 'string' && response.retMsg) return response.retMsg
    if (typeof response.errmsg === 'string' && response.errmsg) return response.errmsg
  }
  return 'Futu OpenD 返回未知错误'
}

async function withClient<T>(
  task: (client: FutuWebSocket) => Promise<T>,
  options: FutuSyncOptions
): Promise<T> {
  const client = new FutuClient()
  const host = typeof options.host === 'string' && options.host.trim()
    ? options.host.trim().slice(0, 253)
    : connection.host
  const port = options.port ?? connection.port
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Futu OpenD 端口无效')
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false
    const finish = (result: { value: T } | { error: Error }): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      closeClient(client)
      if ('error' in result) reject(result.error)
      else resolve(result.value)
    }
    const timer = setTimeout(() => {
      finish({ error: new Error(`无法连接 Futu OpenD（${host}:${port}）`) })
    }, 10_000)

    client.onlogin = (success, message) => {
      if (!success) {
        const detail = getErrorMessage(message)
        finish({
          error: new Error(
            detail.includes('connID')
              ? 'Futu OpenD 鉴权失败，请检查 WebSocket 密钥'
              : `Futu OpenD 连接失败：${detail}`
          )
        })
        return
      }
      void task(client)
        .then((value) => finish({ value }))
        .catch((error: unknown) =>
          finish({ error: new Error(`富途牛牛同步失败：${getErrorMessage(error)}`) })
        )
    }

    const key = typeof options.key === 'string' ? options.key.slice(0, 256) : connection.key
    client.start(host, port, connection.ssl, key)
    if (client.websock) {
      client.websock.onerror = () => {
        finish({ error: new Error(`无法连接 Futu OpenD（${host}:${port}）`) })
      }
    }
  })
}

function currencyFromFutu(value: number | undefined, market: 'US' | 'HK'): string {
  if (value === 1) return 'HKD'
  if (value === 2) return 'USD'
  if (value === 3) return 'CNH'
  return market === 'HK' ? 'HKD' : 'USD'
}

function normalizePosition(position: FutuPosition, fallbackMarket: number): FutuSyncedPosition | null {
  const marketValue = position.secMarket ?? fallbackMarket
  const market = marketValue === MARKET_HK ? 'HK' : marketValue === MARKET_US ? 'US' : null
  if (!market || !position.code || !position.name || !Number.isFinite(position.qty)) return null

  const quantity =
    position.positionSide === POSITION_SIDE_SHORT
      ? -Math.abs(Number(position.qty))
      : Number(position.qty)
  const price = Number(position.price)
  return {
    market,
    symbol: position.code.toUpperCase(),
    name: position.name,
    currency: currencyFromFutu(position.currency, market),
    quantity,
    ...(Number.isFinite(price) ? { price } : {})
  }
}

function mergePositions(positions: FutuSyncedPosition[]): FutuSyncedPosition[] {
  const merged = new Map<string, FutuSyncedPosition>()
  positions.forEach((position) => {
    const key = `${position.market}:${position.symbol}`
    const current = merged.get(key)
    if (!current) {
      merged.set(key, { ...position })
      return
    }
    current.quantity += position.quantity
    if (position.price !== undefined) current.price = position.price
  })
  return [...merged.values()].filter((position) => position.quantity !== 0)
}

function collectCashBalances(
  funds: FutuFunds,
  fallbackMarket: number
): Array<{ market: 'US' | 'HK'; currency: 'USD' | 'HKD'; cash: number }> {
  const balances = new Map<'USD' | 'HKD', number>()
  const setBalance = (currency: 'USD' | 'HKD', value: unknown): void => {
    const cash = Number(value)
    if (Number.isFinite(cash)) balances.set(currency, cash)
  }

  setBalance('HKD', funds.hkCash)
  setBalance('USD', funds.usCash)
  ;(funds.cashInfoList ?? []).forEach((item) => {
    if (item.currency === 1) setBalance('HKD', item.cash)
    if (item.currency === 2) setBalance('USD', item.cash)
  })

  if (!balances.size) {
    const currency = funds.currency ?? (fallbackMarket === MARKET_HK ? 1 : 2)
    if (currency === 1) setBalance('HKD', funds.cash)
    if (currency === 2) setBalance('USD', funds.cash)
  }

  return [...balances.entries()].map(([currency, cash]) => ({
    market: currency === 'HKD' ? 'HK' : 'US',
    currency,
    cash
  }))
}

export async function syncFutuPositions(options: FutuSyncOptions = {}): Promise<FutuSyncResult> {
  return withClient(async (client) => {
    const accountResponse = await client.GetAccList({
      c2s: {
        userID: 0,
        trdCategory: TRADING_CATEGORY_SECURITY,
        needGeneralSecAccount: true
      }
    })
    const payload = accountResponse.s2c as AccountListPayload | undefined
    const accounts = (payload?.accList ?? []).filter(
      (account) => account.trdEnv === TRADING_ENV_REAL
    )
    if (!accounts.length) throw new Error('没有找到富途牛牛真实证券账户')

    const positions: FutuSyncedPosition[] = []
    const cashByAccount = new Map<
      string,
      { market: 'US' | 'HK'; currency: 'USD' | 'HKD'; cash: number }
    >()
    const queriedAccounts = new Set<string>()
    const queriedFundAccounts = new Set<string>()
    const queries: Promise<void>[] = []

    accounts.forEach((account) => {
      const markets = (account.trdMarketAuthList ?? []).filter(
        (market) => market === MARKET_HK || market === MARKET_US
      )
      const accountId = account.accID.toString()
      const fundsMarket = markets[0]
      if (fundsMarket && !queriedFundAccounts.has(accountId)) {
        queriedFundAccounts.add(accountId)
        queries.push(
          client
            .GetFunds({
              c2s: {
                header: {
                  trdEnv: TRADING_ENV_REAL,
                  accID: account.accID,
                  trdMarket: fundsMarket
                },
                refreshCache: false,
                currency: fundsMarket === MARKET_HK ? 1 : 2
              }
            })
            .then((response) => {
              const fundsPayload = response.s2c as FundsPayload | undefined
              if (!fundsPayload?.funds) return
              collectCashBalances(fundsPayload.funds, fundsMarket).forEach((balance) => {
                cashByAccount.set(`${accountId}:${balance.currency}`, balance)
              })
            })
        )
      }
      markets.forEach((market) => {
        const queryKey = `${account.accID.toString()}:${market}`
        if (queriedAccounts.has(queryKey)) return
        queriedAccounts.add(queryKey)
        queries.push(
          client
            .GetPositionList({
              c2s: {
                header: {
                  trdEnv: TRADING_ENV_REAL,
                  accID: account.accID,
                  trdMarket: market
                },
                refreshCache: false
              }
            })
            .then((response) => {
              const positionPayload = response.s2c as PositionListPayload | undefined
              ;(positionPayload?.positionList ?? []).forEach((position) => {
                const normalized = normalizePosition(position, market)
                if (normalized) positions.push(normalized)
              })
            })
        )
      })
    })

    await Promise.all(queries)
    const cashTotals = new Map<'USD' | 'HKD', number>()
    cashByAccount.forEach(({ currency, cash }) => {
      cashTotals.set(currency, (cashTotals.get(currency) ?? 0) + cash)
    })
    cashTotals.forEach((cash, currency) => {
      if (cash === 0) return
      positions.push({
        market: currency === 'HKD' ? 'HK' : 'US',
        symbol: 'CASH',
        name: '现金',
        currency,
        quantity: cash,
        price: 1
      })
    })
    return {
      positions: mergePositions(positions),
      accountCount: new Set(accounts.map((account) => account.accID.toString())).size,
      syncedAt: new Date().toISOString()
    }
  }, options)
}
