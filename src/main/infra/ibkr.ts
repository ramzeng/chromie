import { randomInt } from 'node:crypto'

import {
  ErrorCode,
  EventName,
  IBApi,
  isNonFatalError,
  type Contract
} from '@stoqey/ib'

import {
  DEFAULT_IBKR_GATEWAY_HOST,
  DEFAULT_IBKR_GATEWAY_PORT,
  type IbkrSyncedPosition,
  type IbkrSyncOptions,
  type IbkrSyncResult
} from '../../shared/ibkr'

const REQUEST_TIMEOUT_MS = 10_000
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])
const CASH_VALUE_PRIORITIES: Readonly<Record<string, number>> = {
  totalcashvalue: 1,
  totalcashbalance: 2,
  cashbalance: 3
}

type GatewayOptions = Required<IbkrSyncOptions>

export type IbkrGatewayContract = Pick<
  Contract,
  'conId' | 'currency' | 'description' | 'localSymbol' | 'secType' | 'symbol'
>

/** @internal Testable boundary around the event-based IB Gateway client. */
export type IbkrGatewayClient = {
  connect: (clientId: number) => void
  disconnect: () => void
  requestManagedAccounts: () => void
  requestAccountUpdates: (subscribe: boolean, account?: string) => void
  onConnected: (listener: () => void) => void
  onDisconnected: (listener: () => void) => void
  onError: (listener: (error: Error, code: number) => void) => void
  onManagedAccounts: (listener: (accounts: string) => void) => void
  onPortfolioUpdate: (
    listener: (
      contract: IbkrGatewayContract,
      position: unknown,
      marketPrice: unknown,
      marketValue: unknown,
      accountName?: string
    ) => void
  ) => void
  onAccountValue: (
    listener: (key: string, value: unknown, currency: string, accountName: string) => void
  ) => void
  onAccountDownloadEnd: (listener: (accountName: string) => void) => void
  dispose: () => void
}

export type CreateIbkrGatewayClient = (options: GatewayOptions) => IbkrGatewayClient

type MergedPosition = IbkrSyncedPosition & {
  marketValue: number
  hasCompleteValue: boolean
}

type CashValue = {
  account: string
  currency: string
  quantity: number
  priority: number
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === 'string' && !value.trim()) return undefined
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : undefined
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function normalizeOptions(options: IbkrSyncOptions = {}): GatewayOptions {
  const rawHost = typeof options.host === 'string' && options.host.trim()
    ? options.host.trim().toLowerCase()
    : DEFAULT_IBKR_GATEWAY_HOST
  const host = rawHost.startsWith('[') && rawHost.endsWith(']')
    ? rawHost.slice(1, -1)
    : rawHost
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error('IB Gateway 仅允许连接本地地址')
  }
  const port = options.port ?? DEFAULT_IBKR_GATEWAY_PORT
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('IB Gateway 端口无效')
  }
  return { host, port }
}

function gatewayAddress(options: GatewayOptions): string {
  const host = options.host === '::1' ? '[::1]' : options.host
  return `${host}:${options.port}`
}

function marketForPosition(
  currencyValue: unknown,
  assetClassValue: unknown
): IbkrSyncedPosition['market'] {
  const currency = typeof currencyValue === 'string' ? currencyValue.toUpperCase() : ''
  const assetClass = String(assetClassValue ?? '').toUpperCase()
  if (assetClass === 'CRYPTO') return 'CC'
  if (currency === 'HKD') return 'HK'
  if (currency === 'CNY' || currency === 'CNH') return 'CN'
  return 'US'
}

function normalizeSymbol(symbolValue: string, market: IbkrSyncedPosition['market']): string {
  const symbol = symbolValue.trim().toUpperCase()
  return market === 'HK' && /^\d{1,5}$/.test(symbol) ? symbol.padStart(5, '0') : symbol
}

function normalizePosition(
  contract: IbkrGatewayContract,
  positionValue: unknown,
  marketPriceValue: unknown,
  marketValueValue: unknown
): IbkrSyncedPosition | null {
  const quantity = finiteNumber(positionValue)
  if (quantity === undefined || quantity === 0) return null
  const currency = contract.currency?.trim().toUpperCase() || 'USD'
  const market = marketForPosition(currency, contract.secType)
  const rawSymbol = contract.localSymbol?.trim() || contract.symbol?.trim()
  const symbol = rawSymbol
    ? normalizeSymbol(rawSymbol, market)
    : contract.conId === undefined
      ? ''
      : `CONID ${contract.conId}`
  if (!symbol) return null
  const marketValue = finiteNumber(marketValueValue)
  const marketPrice = finiteNumber(marketPriceValue)
  const price = marketValue !== undefined ? marketValue / quantity : marketPrice
  return {
    market,
    symbol,
    name: contract.description?.trim() || contract.symbol?.trim() || symbol,
    currency,
    quantity,
    ...(price === undefined ? {} : { price })
  }
}

function positionKey(account: string, contract: IbkrGatewayContract): string {
  if (contract.conId !== undefined) return `${account}:conid:${contract.conId}`
  return [
    account,
    String(contract.secType ?? ''),
    contract.currency?.trim().toUpperCase() ?? '',
    contract.localSymbol?.trim().toUpperCase() || contract.symbol?.trim().toUpperCase() || ''
  ].join(':')
}

function normalizeCash(value: CashValue): IbkrSyncedPosition | null {
  if (!value.currency || value.currency === 'BASE' || value.quantity === 0) return null
  return {
    market: marketForPosition(value.currency, ''),
    symbol: 'CASH',
    name: '现金',
    currency: value.currency,
    quantity: value.quantity,
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

function createProductionGatewayClient(options: GatewayOptions): IbkrGatewayClient {
  const api = new IBApi(options)
  return {
    connect: (clientId) => {
      api.connect(clientId)
    },
    disconnect: () => {
      api.disconnect()
    },
    requestManagedAccounts: () => {
      api.reqManagedAccts()
    },
    requestAccountUpdates: (subscribe, account) => {
      api.reqAccountUpdates(subscribe, account)
    },
    onConnected: (listener) => {
      api.on(EventName.connected, listener)
    },
    onDisconnected: (listener) => {
      api.on(EventName.disconnected, listener)
    },
    onError: (listener) => {
      api.on(EventName.error, (error, code) => listener(error, Number(code)))
    },
    onManagedAccounts: (listener) => {
      api.on(EventName.managedAccounts, listener)
    },
    onPortfolioUpdate: (listener) => {
      api.on(
        EventName.updatePortfolio,
        (
          contract,
          position,
          marketPrice,
          marketValue,
          _averageCost,
          _unrealizedPnl,
          _realizedPnl,
          accountName
        ) => {
          listener(contract, position, marketPrice, marketValue, accountName)
        }
      )
    },
    onAccountValue: (listener) => {
      api.on(EventName.updateAccountValue, listener)
    },
    onAccountDownloadEnd: (listener) => {
      api.on(EventName.accountDownloadEnd, listener)
    },
    dispose: () => {
      api.removeAllListeners()
    }
  }
}

function connectionError(options: GatewayOptions): Error {
  return new Error(
    `无法连接 IB Gateway（${gatewayAddress(options)}）；请确认 Gateway 已登录，并已启用 ActiveX and Socket Clients`
  )
}

function gatewayError(error: Error, code: number, options: GatewayOptions): Error | undefined {
  if (code === ErrorCode.CONNECT_FAIL) return connectionError(options)
  if (code === 326) return new Error('IB Gateway 客户端 ID 冲突，请稍后重试')
  if (code === ErrorCode.CONNECTIVITY_RESTORED_DATA_LOST) {
    return new Error('IB Gateway 连接已恢复，但账户订阅需要重试')
  }
  if (code === ErrorCode.CONNECTIVITY_RESTORED_DATA_MAINTAINED) return undefined
  if (isNonFatalError(code as ErrorCode, error)) return undefined
  const codeLabel = Number.isFinite(code) ? `（${code}）` : ''
  return new Error(`IB Gateway 错误${codeLabel}：${error.message || '未知错误'}`)
}

/** @internal Allows the socket transport to be replaced by a deterministic fake in tests. */
export function createIbkrPositionsSync(
  createClient: CreateIbkrGatewayClient,
  timeoutMs = REQUEST_TIMEOUT_MS
): (options?: IbkrSyncOptions) => Promise<IbkrSyncResult> {
  return async (rawOptions: IbkrSyncOptions = {}): Promise<IbkrSyncResult> => {
    const options = normalizeOptions(rawOptions)

    try {
      return await new Promise<IbkrSyncResult>((resolve, reject) => {
        const client = createClient(options)
        const positions = new Map<string, IbkrSyncedPosition>()
        const cashValues = new Map<string, CashValue>()
        const accountReady = new Map<string, boolean>()
        let accounts: string[] = []
        let currentAccount: string | undefined
        let accountIndex = -1
        let accountDownloadStarted = false
        let settled = false
        let timer: ReturnType<typeof setTimeout> | undefined

        const clearPhaseTimeout = (): void => {
          if (timer) clearTimeout(timer)
          timer = undefined
        }

        const stopCurrentAccount = (): void => {
          if (!currentAccount) return
          const account = currentAccount
          currentAccount = undefined
          try {
            client.requestAccountUpdates(false, account)
          } catch {
            // The socket may already have closed while cleaning up.
          }
        }

        const cleanup = (): void => {
          clearPhaseTimeout()
          stopCurrentAccount()
          try {
            client.disconnect()
          } catch {
            // The client may not have completed its connection handshake.
          }
          try {
            client.dispose()
          } catch {
            // Listener cleanup is best effort after the result has settled.
          }
        }

        const finish = (result: { value: IbkrSyncResult } | { error: Error }): void => {
          if (settled) return
          settled = true
          cleanup()
          if ('error' in result) reject(result.error)
          else resolve(result.value)
        }

        const runClientAction = (action: () => void, errorPrefix: string): boolean => {
          try {
            action()
            return true
          } catch (error) {
            finish({ error: new Error(`${errorPrefix}：${errorMessage(error)}`) })
            return false
          }
        }

        const armTimeout = (message: string): void => {
          clearPhaseTimeout()
          timer = setTimeout(() => finish({ error: new Error(message) }), timeoutMs)
        }

        const finishSuccessfully = (): void => {
          const normalizedCash = [...cashValues.values()].flatMap((value) => {
            const position = normalizeCash(value)
            return position ? [position] : []
          })
          finish({
            value: {
              positions: mergePositions([...positions.values(), ...normalizedCash]),
              accountCount: accounts.length,
              syncedAt: new Date().toISOString()
            }
          })
        }

        const requestNextAccount = (): void => {
          stopCurrentAccount()
          accountIndex += 1
          if (accountIndex >= accounts.length) {
            finishSuccessfully()
            return
          }
          currentAccount = accounts[accountIndex]
          armTimeout(`IB Gateway 读取账户超时（${currentAccount}）`)
          runClientAction(
            () => client.requestAccountUpdates(true, currentAccount),
            `IB Gateway 无法读取账户（${currentAccount}）`
          )
        }

        client.onConnected(() => {
          if (accountDownloadStarted || settled) return
          armTimeout('IB Gateway 读取账户列表超时')
          runClientAction(
            () => client.requestManagedAccounts(),
            'IB Gateway 无法读取账户列表'
          )
        })
        client.onDisconnected(() => {
          if (!settled) finish({ error: connectionError(options) })
        })
        client.onError((error, code) => {
          const fatalError = gatewayError(error, code, options)
          if (fatalError) finish({ error: fatalError })
        })
        client.onManagedAccounts((accountsList) => {
          if (accountDownloadStarted || settled) return
          accounts = [
            ...new Set(
              accountsList
                .split(',')
                .map((account) => account.trim())
                .filter(Boolean)
            )
          ]
          if (!accounts.length) {
            finish({ error: new Error('IB Gateway 没有找到可读取的账户') })
            return
          }
          accountDownloadStarted = true
          requestNextAccount()
        })
        client.onPortfolioUpdate(
          (contract, positionValue, marketPrice, marketValue, accountName) => {
            const account = accountName?.trim() || currentAccount
            if (!account || !accounts.includes(account)) return
            const key = positionKey(account, contract)
            const quantity = finiteNumber(positionValue)
            if (quantity === undefined) return
            if (quantity === 0) {
              positions.delete(key)
              return
            }
            const position = normalizePosition(
              contract,
              quantity,
              marketPrice,
              marketValue
            )
            if (position) positions.set(key, position)
          }
        )
        client.onAccountValue((key, value, currencyValue, accountName) => {
          const account = accountName.trim() || currentAccount
          if (!account || !accounts.includes(account)) return
          const normalizedKey = key.trim().toLowerCase()
          if (normalizedKey === 'accountready') {
            accountReady.set(account, String(value).trim().toLowerCase() === 'true')
            return
          }
          const priority = CASH_VALUE_PRIORITIES[normalizedKey]
          const quantity = finiteNumber(value)
          const currency = currencyValue.trim().toUpperCase()
          if (!priority || quantity === undefined || !currency || currency === 'BASE') return
          const cashKey = `${account}:${currency}`
          const existing = cashValues.get(cashKey)
          if (!existing || existing.priority <= priority) {
            cashValues.set(cashKey, { account, currency, quantity, priority })
          }
        })
        client.onAccountDownloadEnd((accountName) => {
          if (settled || accountName.trim() !== currentAccount) return
          if (accountReady.get(currentAccount) === false) {
            finish({
              error: new Error(
                `IB Gateway 账户数据尚未就绪（${currentAccount}），请稍后重试`
              )
            })
            return
          }
          requestNextAccount()
        })

        armTimeout(connectionError(options).message)
        try {
          client.connect(randomInt(1, 32_768))
        } catch {
          finish({ error: connectionError(options) })
        }
      })
    } catch (error) {
      const message = errorMessage(error)
      if (message.startsWith('IB Gateway') || message.startsWith('无法连接 IB Gateway')) {
        throw new Error(message)
      }
      throw new Error(`IBKR 同步失败：${message}`)
    }
  }
}

export const syncIbkrPositions = createIbkrPositionsSync(createProductionGatewayClient)
