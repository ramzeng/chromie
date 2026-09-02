import { request as httpsRequest } from 'node:https'

import {
  DEFAULT_IBKR_GATEWAY_HOST,
  DEFAULT_IBKR_GATEWAY_PORT,
  type IbkrSyncedPosition,
  type IbkrSyncOptions,
  type IbkrSyncResult
} from '../../shared/ibkr'

const REQUEST_TIMEOUT_MS = 10_000
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

type IbkrAccount = {
  id?: string
  accountId?: string
}

type IbkrPosition = {
  assetClass?: string
  secType?: string
  conid?: number
  currency?: string
  description?: string
  marketPrice?: number
  marketValue?: number
  position?: number
}

type IbkrLedgerEntry = {
  cashbalance?: number
  currency?: string
}

type MergedPosition = IbkrSyncedPosition & {
  marketValue: number
  hasCompleteValue: boolean
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === 'string' && !value.trim()) return undefined
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : undefined
}

function normalizeOptions(options: IbkrSyncOptions = {}): Required<IbkrSyncOptions> {
  const rawHost = typeof options.host === 'string' && options.host.trim()
    ? options.host.trim().toLowerCase()
    : DEFAULT_IBKR_GATEWAY_HOST
  const host = rawHost.startsWith('[') && rawHost.endsWith(']')
    ? rawHost.slice(1, -1)
    : rawHost
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error('IBKR Client Portal Gateway 仅允许连接本地地址')
  }
  const port = options.port ?? DEFAULT_IBKR_GATEWAY_PORT
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('IBKR Client Portal Gateway 端口无效')
  }
  return { host, port }
}

function getMessage(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const response = value as { error?: unknown; message?: unknown }
  if (typeof response.error === 'string' && response.error) return response.error
  if (typeof response.message === 'string' && response.message) return response.message
  return undefined
}

function request<T>(path: string, options: Required<IbkrSyncOptions>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const request = httpsRequest(
      {
        hostname: options.host,
        port: options.port,
        path,
        method: 'GET',
        headers: { Accept: 'application/json' },
        rejectUnauthorized: false
      },
      (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        })
        response.on('end', () => {
          const status = response.statusCode ?? 0
          const rawBody = Buffer.concat(chunks).toString('utf8')
          let body: unknown
          try {
            body = rawBody ? JSON.parse(rawBody) : null
          } catch {
            reject(new Error(`IBKR Gateway 返回异常（HTTP ${status || '未知'}）`))
            return
          }
          if (status < 200 || status >= 300) {
            if (status === 401) {
              reject(new Error('IBKR Gateway 尚未登录或会话已过期'))
              return
            }
            reject(
              new Error(getMessage(body) ?? `IBKR Gateway 请求失败（HTTP ${status}）`)
            )
            return
          }
          resolve(body as T)
        })
      }
    )
    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error('IBKR Gateway 请求超时'))
    })
    request.on('error', (error) => reject(error))
    request.end()
  })
}

function marketForPosition(
  currencyValue: unknown,
  assetClassValue: unknown
): IbkrSyncedPosition['market'] {
  const currency = typeof currencyValue === 'string' ? currencyValue.toUpperCase() : ''
  const assetClass =
    typeof assetClassValue === 'string' ? assetClassValue.toUpperCase() : ''
  if (assetClass === 'CRYPTO') return 'CC'
  if (currency === 'HKD') return 'HK'
  if (currency === 'CNY' || currency === 'CNH') return 'CN'
  return 'US'
}

function normalizePosition(value: unknown): IbkrSyncedPosition | null {
  if (!value || typeof value !== 'object') return null
  const position = value as IbkrPosition
  const quantity = finiteNumber(position.position)
  if (quantity === undefined || quantity === 0) return null
  const symbol =
    typeof position.description === 'string' && position.description.trim()
      ? position.description.trim().toUpperCase()
      : position.conid === undefined
        ? ''
        : `CONID ${position.conid}`
  if (!symbol) return null
  const currency =
    typeof position.currency === 'string' && position.currency.trim()
      ? position.currency.trim().toUpperCase()
      : 'USD'
  const marketValue = finiteNumber(position.marketValue)
  const marketPrice = finiteNumber(position.marketPrice)
  const price =
    marketValue !== undefined && quantity !== 0
      ? marketValue / quantity
      : marketPrice
  return {
    market: marketForPosition(currency, position.secType ?? position.assetClass),
    symbol,
    name: symbol,
    currency,
    quantity,
    ...(price === undefined ? {} : { price })
  }
}

function normalizeCash(
  currencyKey: string,
  value: unknown
): IbkrSyncedPosition | null {
  if (!value || typeof value !== 'object') return null
  const ledger = value as IbkrLedgerEntry
  const quantity = finiteNumber(ledger.cashbalance)
  if (quantity === undefined || quantity === 0) return null
  const currency =
    typeof ledger.currency === 'string' && ledger.currency.trim()
      ? ledger.currency.trim().toUpperCase()
      : currencyKey.trim().toUpperCase()
  if (!currency || currency === 'BASE') return null
  return {
    market: marketForPosition(currency, ''),
    symbol: 'CASH',
    name: '现金',
    currency,
    quantity,
    price: 1
  }
}

function mergePositions(positions: IbkrSyncedPosition[]): IbkrSyncedPosition[] {
  const merged = new Map<string, MergedPosition>()
  positions.forEach((position) => {
    const key = `${position.market}:${position.currency}:${position.symbol}`
    const current = merged.get(key) ?? {
      ...position,
      quantity: 0,
      marketValue: 0,
      hasCompleteValue: true
    }
    current.quantity += position.quantity
    current.hasCompleteValue &&= position.price !== undefined
    if (position.price !== undefined) {
      current.marketValue += position.quantity * position.price
    }
    merged.set(key, current)
  })

  return [...merged.values()]
    .filter((position) => Math.abs(position.quantity) > Number.EPSILON)
    .map(({ marketValue, hasCompleteValue, ...position }): IbkrSyncedPosition => ({
      ...position,
      ...(hasCompleteValue ? { price: marketValue / position.quantity } : {})
    }))
    .sort((left, right) => {
      const leftValue = Math.abs(left.quantity * (left.price ?? 0))
      const rightValue = Math.abs(right.quantity * (right.price ?? 0))
      return rightValue - leftValue || left.symbol.localeCompare(right.symbol)
    })
}

export async function syncIbkrPositions(
  rawOptions: IbkrSyncOptions = {}
): Promise<IbkrSyncResult> {
  const options = normalizeOptions(rawOptions)
  try {
    const accountsResponse = await request<unknown>('/v1/api/portfolio/accounts', options)
    if (!Array.isArray(accountsResponse)) {
      throw new Error(getMessage(accountsResponse) ?? 'IBKR Gateway 账户数据无效')
    }
    const accounts = accountsResponse as IbkrAccount[]
    const accountIds = [...new Set(accounts.flatMap((account) => {
      if (!account || typeof account !== 'object') return []
      const accountId = account.accountId ?? account.id
      return typeof accountId === 'string' && accountId.trim() ? [accountId.trim()] : []
    }))]
    if (!accountIds.length) throw new Error('没有找到可读取的 IBKR 账户')

    const positions: IbkrSyncedPosition[] = []
    await Promise.all(accountIds.map(async (accountId) => {
      const encodedAccountId = encodeURIComponent(accountId)
      const [accountPositionsResponse, ledgerResponse] = await Promise.all([
        request<unknown>(
          `/v1/api/portfolio2/${encodedAccountId}/positions`,
          options
        ),
        request<unknown>(
          `/v1/api/portfolio/${encodedAccountId}/ledger`,
          options
        )
      ])
      if (!Array.isArray(accountPositionsResponse)) {
        throw new Error(
          getMessage(accountPositionsResponse) ?? `IBKR Gateway 持仓数据无效（${accountId}）`
        )
      }
      if (
        !ledgerResponse ||
        typeof ledgerResponse !== 'object' ||
        Array.isArray(ledgerResponse)
      ) {
        throw new Error(
          getMessage(ledgerResponse) ?? `IBKR Gateway 现金数据无效（${accountId}）`
        )
      }
      const accountPositions = accountPositionsResponse as IbkrPosition[]
      const ledger = ledgerResponse as Record<string, IbkrLedgerEntry>
      accountPositions.forEach((position) => {
        const normalized = normalizePosition(position)
        if (normalized) positions.push(normalized)
      })
      Object.entries(ledger).forEach(([currency, entry]) => {
        const normalized = normalizeCash(currency, entry)
        if (normalized) positions.push(normalized)
      })
    }))

    return {
      positions: mergePositions(positions),
      accountCount: accountIds.length,
      syncedAt: new Date().toISOString()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.startsWith('IBKR')) throw new Error(message)
    const connectionErrors = ['ECONNREFUSED', 'socket hang up', 'certificate']
    if (connectionErrors.some((value) => message.includes(value))) {
      throw new Error(`无法连接 IBKR Client Portal Gateway（${options.host}:${options.port}）`)
    }
    throw new Error(`IBKR 同步失败：${message}`)
  }
}
