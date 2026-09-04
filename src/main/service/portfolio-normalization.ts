import {
  CRYPTO_QUOTE_PROVIDERS,
  DEFAULT_CRYPTO_QUOTE_PROVIDER,
  DEFAULT_STOCK_QUOTE_PROVIDER,
  STOCK_QUOTE_PROVIDERS,
  type CryptoQuoteProvider,
  type StockQuoteProvider
} from '../../shared/asset-quotes'
import {
  DEFAULT_EXCHANGE_RATE_PROVIDER,
  DEFAULT_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  EXCHANGE_RATE_PROVIDERS,
  MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  type ExchangeRateProvider
} from '../../shared/exchange-rates'
import { type AccountIntegration } from '../../shared/integrations'
import {
  DEFAULT_BASE_CURRENCY,
  DEFAULT_FUTU_OPEND_HOST,
  DEFAULT_FUTU_OPEND_PORT,
  DEFAULT_HSTONG_GATEWAY_HOST,
  DEFAULT_HSTONG_GATEWAY_PORT,
  DEFAULT_IBKR_GATEWAY_HOST,
  DEFAULT_IBKR_GATEWAY_PORT,
  DEFAULT_SYNC_INTERVAL,
  TAG_COLORS,
  type AccountInput,
  type AccountSync,
  type AccountType,
  type BaseCurrency,
  type Market,
  type Position,
  type PositionInput,
  type TagColor,
  type Workspace
} from '../../shared/portfolio'
export function normalizeAccountName(value: string): string {
  return value.trim()
}

export function normalizedAccountNameKey(value: string): string {
  return normalizeAccountName(value).toLocaleLowerCase()
}

export function uniqueAccountName(
  workspace: Workspace,
  value: string,
  excludedAccountId?: string
): string {
  const name = normalizeAccountName(value)
  const nameKey = normalizedAccountNameKey(name)
  if (
    workspace.accounts.some(
      (account) =>
        account.id !== excludedAccountId && normalizedAccountNameKey(account.name) === nameKey
    )
  )
    throw new Error(`账户“${name}”已存在`)
  return name
}

export function isCurrencyCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z0-9]{2,12}$/.test(value.trim().toUpperCase())
}

export function normalizeBaseCurrency(value: unknown): BaseCurrency {
  if (!isCurrencyCode(value)) return DEFAULT_BASE_CURRENCY
  const currency = value.trim().toUpperCase()
  return currency === 'CNY' || currency === 'HKD' || currency === 'USD'
    ? currency
    : DEFAULT_BASE_CURRENCY
}

export function normalizeExchangeRateProvider(value: unknown): ExchangeRateProvider {
  return EXCHANGE_RATE_PROVIDERS.includes(value as ExchangeRateProvider)
    ? (value as ExchangeRateProvider)
    : DEFAULT_EXCHANGE_RATE_PROVIDER
}

export function normalizeExchangeRateRefreshInterval(value: unknown): number {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES &&
    value <= MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES
    ? value
    : DEFAULT_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES
}

export function normalizeStockQuoteProvider(value: unknown): StockQuoteProvider {
  return STOCK_QUOTE_PROVIDERS.includes(value as StockQuoteProvider)
    ? (value as StockQuoteProvider)
    : DEFAULT_STOCK_QUOTE_PROVIDER
}

export function normalizeCryptoQuoteProvider(value: unknown): CryptoQuoteProvider {
  return CRYPTO_QUOTE_PROVIDERS.includes(value as CryptoQuoteProvider)
    ? (value as CryptoQuoteProvider)
    : DEFAULT_CRYPTO_QUOTE_PROVIDER
}

export function normalizeSyncInterval(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 5
    ? Math.min(Math.round(value), 3600)
    : DEFAULT_SYNC_INTERVAL
}

export function normalizeSyncHost(value: unknown): string {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, 253)
    : DEFAULT_FUTU_OPEND_HOST
}

export function normalizeSyncPort(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535
    ? value
    : DEFAULT_FUTU_OPEND_PORT
}

export function normalizeIbkrGatewayHost(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_IBKR_GATEWAY_HOST
  const host = value
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
  return host === '127.0.0.1' || host === 'localhost' || host === '::1'
    ? host
    : DEFAULT_IBKR_GATEWAY_HOST
}

export function normalizeIbkrGatewayPort(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535
    ? value
    : DEFAULT_IBKR_GATEWAY_PORT
}

export function normalizeHstongGatewayHost(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_HSTONG_GATEWAY_HOST
  const host = value
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
  return host === '127.0.0.1' || host === 'localhost' || host === '::1'
    ? host
    : DEFAULT_HSTONG_GATEWAY_HOST
}

export function normalizeHstongGatewayPort(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535
    ? value
    : DEFAULT_HSTONG_GATEWAY_PORT
}

export function createId(): string {
  return crypto.randomUUID()
}

export function normalizeTagIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value.flatMap((tagId) => (typeof tagId === 'string' && tagId.trim() ? [tagId.trim()] : []))
    )
  ]
}

export function normalizeStoredTagIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const tagIds = value.flatMap((tagId) =>
    typeof tagId === 'string' && tagId.trim() ? [tagId.trim()] : []
  )
  return tagIds.length === value.length && new Set(tagIds).size === tagIds.length ? tagIds : null
}

export function isTagColor(value: unknown): value is TagColor {
  return typeof value === 'string' && TAG_COLORS.includes(value as TagColor)
}

export function normalizePosition(input: PositionInput, id?: string): Position {
  return {
    id: id?.trim() || createId(),
    market: input.market,
    symbol: input.symbol.trim().toUpperCase(),
    name: input.name.trim(),
    currency: input.currency.trim().toUpperCase(),
    quantity: input.quantity,
    ...(input.price === undefined ? {} : { price: input.price }),
    tagIds: normalizeTagIds(input.tagIds)
  }
}

export function normalizeStoredMarket(value: unknown): Market | null {
  if (typeof value !== 'string') return null
  const market = value.toUpperCase()
  return market === 'CN' ||
    market === 'CN_OTC' ||
    market === 'US' ||
    market === 'HK' ||
    market === 'CC'
    ? market
    : null
}

export function normalizeAccountType(value: unknown): AccountType | null {
  if (typeof value !== 'string') return null
  const type = value.toLowerCase()
  if (type === 'futu') return 'Futu'
  if (type === 'boci') return 'Boci'
  if (type === 'okx') return 'Okx'
  if (type === 'ibkr') return 'Ibkr'
  if (type === 'hstong') return 'Hstong'
  if (type === 'binance') return 'Binance'
  if (type === 'alipay') return 'Alipay'
  if (type === 'general') return 'General'
  if (type === 'cmb') return 'Cmb'
  if (type === 'boc') return 'Boc'
  return null
}

export function normalizeAccountSync(value: unknown, type: AccountType): AccountSync | undefined {
  if (
    type === 'Boci' ||
    type === 'Alipay' ||
    type === 'General' ||
    type === 'Cmb' ||
    type === 'Boc'
  ) {
    return undefined
  }
  if (!value || typeof value !== 'object') return undefined
  const sync = value as { interval?: unknown; lastSyncedAt?: unknown }
  const lastSyncedAt =
    typeof sync.lastSyncedAt === 'string' && Number.isFinite(Date.parse(sync.lastSyncedAt))
      ? sync.lastSyncedAt
      : undefined
  return {
    interval: normalizeSyncInterval(sync.interval),
    ...(lastSyncedAt ? { lastSyncedAt } : {})
  }
}

export function normalizeIntegration(
  value: unknown,
  accountId?: string
): AccountIntegration | null {
  if (!value || typeof value !== 'object') return null
  const integration = value as {
    accountId?: unknown
    provider?: unknown
    websocket?: unknown
    gateway?: unknown
    api?: unknown
  }
  const normalizedAccountId =
    accountId ?? (typeof integration.accountId === 'string' ? integration.accountId.trim() : '')
  if (!normalizedAccountId) return null

  if (integration.provider === 'Futu') {
    if (!integration.websocket || typeof integration.websocket !== 'object') return null
    const websocket = integration.websocket as {
      host?: unknown
      port?: unknown
      key?: unknown
    }
    return {
      accountId: normalizedAccountId,
      provider: 'Futu',
      websocket: {
        host: normalizeSyncHost(websocket.host),
        port: normalizeSyncPort(websocket.port),
        ...(typeof websocket.key === 'string' && websocket.key.trim()
          ? { key: websocket.key.trim().slice(0, 512) }
          : {})
      }
    }
  }

  if (integration.provider === 'Ibkr') {
    if (!integration.gateway || typeof integration.gateway !== 'object') return null
    const gateway = integration.gateway as { host?: unknown; port?: unknown }
    return {
      accountId: normalizedAccountId,
      provider: 'Ibkr',
      gateway: {
        host: normalizeIbkrGatewayHost(gateway.host),
        port: normalizeIbkrGatewayPort(gateway.port)
      }
    }
  }

  if (integration.provider === 'Hstong') {
    if (!integration.gateway || typeof integration.gateway !== 'object') return null
    const gateway = integration.gateway as {
      host?: unknown
      port?: unknown
      tradingPassword?: unknown
    }
    return {
      accountId: normalizedAccountId,
      provider: 'Hstong',
      gateway: {
        host: normalizeHstongGatewayHost(gateway.host),
        port: normalizeHstongGatewayPort(gateway.port),
        ...(typeof gateway.tradingPassword === 'string' && gateway.tradingPassword
          ? { tradingPassword: gateway.tradingPassword.slice(0, 256) }
          : {})
      }
    }
  }

  if (integration.provider === 'Okx' || integration.provider === 'Binance') {
    if (!integration.api || typeof integration.api !== 'object') return null
    const api = integration.api as {
      apiKey?: unknown
      secretKey?: unknown
      passphrase?: unknown
    }
    if (
      typeof api.apiKey !== 'string' ||
      !api.apiKey.trim() ||
      typeof api.secretKey !== 'string' ||
      !api.secretKey ||
      (integration.provider === 'Okx' && (typeof api.passphrase !== 'string' || !api.passphrase))
    ) {
      return null
    }
    if (integration.provider === 'Okx') {
      return {
        accountId: normalizedAccountId,
        provider: 'Okx',
        api: {
          apiKey: api.apiKey.trim().slice(0, 256),
          secretKey: api.secretKey.slice(0, 512),
          passphrase: (api.passphrase as string).slice(0, 256)
        }
      }
    }
    return {
      accountId: normalizedAccountId,
      provider: 'Binance',
      api: {
        apiKey: api.apiKey.trim().slice(0, 256),
        secretKey: api.secretKey.slice(0, 512)
      }
    }
  }

  return null
}

export function resolveIntegrationInput(
  input: AccountInput['integration'],
  accountId: string,
  existing?: AccountIntegration
): AccountIntegration | null {
  if (!input) return null

  if (input.provider === 'Ibkr') {
    return normalizeIntegration(input, accountId)
  }

  if (input.provider === 'Futu') {
    const credential = input.websocket.credential
    if (credential.mode === 'keep' && existing?.provider !== 'Futu') {
      throw new Error('没有可保留的 Futu OpenD 密钥，请重新填写')
    }
    const key =
      credential.mode === 'keep'
        ? existing?.provider === 'Futu'
          ? existing.websocket.key
          : undefined
        : credential.mode === 'replace'
          ? credential.value.key
          : undefined
    return normalizeIntegration(
      {
        provider: 'Futu',
        websocket: {
          host: input.websocket.host,
          port: input.websocket.port,
          ...(key ? { key } : {})
        }
      },
      accountId
    )
  }

  if (input.provider === 'Hstong') {
    const credential = input.gateway.credential
    if (credential.mode === 'keep' && existing?.provider !== 'Hstong') {
      throw new Error('没有可保留的华盛交易密码，请重新填写')
    }
    const tradingPassword =
      credential.mode === 'keep'
        ? existing?.provider === 'Hstong'
          ? existing.gateway.tradingPassword
          : undefined
        : credential.mode === 'replace'
          ? credential.value.tradingPassword
          : undefined
    return normalizeIntegration(
      {
        provider: 'Hstong',
        gateway: {
          host: input.gateway.host,
          port: input.gateway.port,
          ...(tradingPassword ? { tradingPassword } : {})
        }
      },
      accountId
    )
  }

  if (input.api.credential.mode === 'keep') {
    if (existing?.provider !== input.provider) {
      throw new Error(`没有可保留的 ${input.provider} API 凭据，请重新填写`)
    }
    return structuredClone(existing)
  }

  return normalizeIntegration(
    {
      provider: input.provider,
      api: input.api.credential.value
    },
    accountId
  )
}
