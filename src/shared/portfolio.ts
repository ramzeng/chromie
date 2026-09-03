import {
  DEFAULT_EXCHANGE_RATE_PROVIDER,
  DEFAULT_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  EXCHANGE_RATE_PROVIDERS,
  MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  type ExchangeRateProvider,
  type ExchangeRateSnapshot
} from './exchange-rates'
import { DEFAULT_FUTU_OPEND_HOST, DEFAULT_FUTU_OPEND_PORT } from './futu'
import { DEFAULT_IBKR_GATEWAY_HOST, DEFAULT_IBKR_GATEWAY_PORT } from './ibkr'
import {
  DEFAULT_HSTONG_GATEWAY_HOST,
  DEFAULT_HSTONG_GATEWAY_PORT
} from './hstong'
import {
  DEFAULT_CRYPTO_QUOTE_PROVIDER,
  DEFAULT_STOCK_QUOTE_PROVIDER,
  type CryptoQuoteProvider,
  type StockQuoteProvider
} from './asset-quotes'
import type {
  AccountIntegration,
  AccountIntegrationInput,
  AccountIntegrationView
} from './integrations'

export type Market = 'CN' | 'CN_OTC_FUND' | 'HK' | 'US' | 'CC'
export type BaseCurrency = 'CNY' | 'HKD' | 'USD'
export type AccountType =
  | 'Futu'
  | 'Boci'
  | 'Okx'
  | 'Ibkr'
  | 'Hstong'
  | 'Binance'
  | 'Alipay'
  | 'General'
  | 'Cmb'
  | 'Boc'

export type Position = {
  id: string
  market: Market
  symbol: string
  name: string
  currency: string
  quantity: number
  price?: number
  tagIds: string[]
}

export type AccountSync = {
  interval: number
  lastSyncedAt?: string
}

export const TAG_COLORS = [
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'gray'
] as const

export type TagColor = (typeof TAG_COLORS)[number]

export const DEFAULT_TAG_COLOR: TagColor = 'gray'

export const tagColorLabels: Record<TagColor, string> = {
  gray: '灰色',
  red: '红色',
  orange: '橙色',
  yellow: '黄色',
  green: '绿色',
  blue: '蓝色',
  purple: '紫色'
}

export type Tag = {
  id: string
  name: string
  color: TagColor
}

export type Account = {
  id: string
  name: string
  type: AccountType
  sync?: AccountSync
  tagIds: string[]
  positions: Position[]
}

export type Workspace = {
  id: string
  name: string
  baseCurrency: BaseCurrency
  exchangeRateProvider: ExchangeRateProvider
  exchangeRateRefreshIntervalMinutes: number
  stockQuoteProvider: StockQuoteProvider
  cryptoQuoteProvider: CryptoQuoteProvider
  tags: Tag[]
  accounts: Account[]
}

export type WorkspaceSnapshot = {
  id: string
  workspaceId: string
  createdAt: string
  workspace: Workspace
  exchangeRates?: ExchangeRateSnapshot
}

export type AppData = {
  version: 1
  activeWorkspaceId: string | null
  workspaces: Workspace[]
  snapshots: WorkspaceSnapshot[]
}

export type WorkspaceBackup = {
  workspace: Workspace
  snapshots: WorkspaceSnapshot[]
  integrations: AccountIntegration[]
}

export type WorkspaceInput = Pick<Workspace, 'name' | 'baseCurrency'>
export type WorkspaceSettingsInput = Pick<
  Workspace,
  | 'name'
  | 'baseCurrency'
  | 'exchangeRateProvider'
  | 'exchangeRateRefreshIntervalMinutes'
  | 'stockQuoteProvider'
  | 'cryptoQuoteProvider'
>
export type AccountInput = Pick<
  Account,
  'name' | 'type' | 'sync'
> & {
  tagIds?: string[]
  integration?: AccountIntegrationInput
}
export type PositionInput = Omit<Position, 'id' | 'tagIds'> & { tagIds?: string[] }
export type TagInput = Pick<Tag, 'name' | 'color'>

export type PortfolioCommand =
  | { type: 'set-active-workspace'; id: string }
  | {
      type: 'create-snapshot'
      workspaceId: string
      exchangeRates?: ExchangeRateSnapshot | null
    }
  | { type: 'delete-snapshot'; snapshotId: string }
  | { type: 'create-workspace'; input: WorkspaceInput }
  | {
      type: 'update-workspace'
      id: string
      input: WorkspaceSettingsInput
    }
  | { type: 'delete-workspace'; id: string }
  | {
      type: 'create-tag'
      workspaceId: string
      input: TagInput
    }
  | {
      type: 'update-tag'
      workspaceId: string
      tagId: string
      input: TagInput
    }
  | { type: 'delete-tag'; workspaceId: string; tagId: string }
  | {
      type: 'set-account-tags'
      workspaceId: string
      accountId: string
      tagIds: string[]
    }
  | {
      type: 'set-position-tags'
      workspaceId: string
      accountId: string
      positionId: string
      tagIds: string[]
    }
  | {
      type: 'create-account'
      workspaceId: string
      input: AccountInput
    }
  | {
      type: 'update-account'
      workspaceId: string
      accountId: string
      input: AccountInput
    }
  | {
      type: 'delete-account'
      workspaceId: string
      accountId: string
    }
  | {
      type: 'save-position'
      workspaceId: string
      accountId: string
      input: PositionInput
      positionId?: string
    }
  | {
      type: 'delete-position'
      workspaceId: string
      accountId: string
      positionId: string
    }

export type PortfolioCommandResponse = {
  data: AppData
  integrations: AccountIntegration[]
  result?: string
}

export type PortfolioLoadResponse = {
  data: AppData
  integrations: AccountIntegration[]
}

export type PortfolioClientCommandResponse = Omit<
  PortfolioCommandResponse,
  'integrations'
> & {
  integrations: AccountIntegrationView[]
}

export type PortfolioClientLoadResponse = Omit<
  PortfolioLoadResponse,
  'integrations'
> & {
  integrations: AccountIntegrationView[]
}

export type PortfolioSyncResponse = {
  positionCount: number
  syncedAt: string
}

export const EMPTY_PORTFOLIO_DATA: AppData = {
  version: 1,
  activeWorkspaceId: null,
  workspaces: [],
  snapshots: []
}

export const DEFAULT_SYNC_INTERVAL = 30
export const BASE_CURRENCIES: readonly BaseCurrency[] = ['CNY', 'HKD', 'USD']
export const DEFAULT_BASE_CURRENCY: BaseCurrency = 'CNY'
export {
  DEFAULT_EXCHANGE_RATE_PROVIDER,
  DEFAULT_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  DEFAULT_CRYPTO_QUOTE_PROVIDER,
  DEFAULT_FUTU_OPEND_HOST,
  DEFAULT_FUTU_OPEND_PORT,
  DEFAULT_HSTONG_GATEWAY_HOST,
  DEFAULT_HSTONG_GATEWAY_PORT,
  DEFAULT_IBKR_GATEWAY_HOST,
  DEFAULT_IBKR_GATEWAY_PORT,
  DEFAULT_STOCK_QUOTE_PROVIDER,
  EXCHANGE_RATE_PROVIDERS,
  MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES
}
export type { ExchangeRateProvider }
export type { CryptoQuoteProvider, StockQuoteProvider }

export const exchangeRateProviderLabels: Record<ExchangeRateProvider, string> = {
  coinbase: 'Coinbase'
}

export const accountTypeLabels: Record<AccountType, string> = {
  Futu: '富途牛牛',
  Boci: '中银国际',
  Okx: '欧易',
  Ibkr: '盈透证券',
  Hstong: '华盛通',
  Binance: '币安',
  Alipay: '支付宝',
  General: '通用',
  Cmb: '招商银行',
  Boc: '中国银行'
}

export const marketOrder: readonly Market[] = ['CN', 'CN_OTC_FUND', 'HK', 'US', 'CC']

export const marketMeta: Record<Market, { label: string; shortLabel: string }> = {
  CN: { label: 'CN', shortLabel: 'CN' },
  CN_OTC_FUND: { label: '场外基金', shortLabel: '基金' },
  HK: { label: 'HK', shortLabel: 'HK' },
  US: { label: 'US', shortLabel: 'US' },
  CC: { label: 'CC', shortLabel: 'CC' }
}

export const defaultCurrencyByMarket: Record<Market, string> = {
  CN: 'CNY',
  CN_OTC_FUND: 'CNY',
  HK: 'HKD',
  US: 'USD',
  CC: 'USD'
}

export function formatNumber(value: number, maximumFractionDigits = 6): string {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits,
    minimumFractionDigits: 0
  }).format(value)
}

export function formatMoney(value: number, currency: string): string {
  const amount = new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
  return `${amount} ${currency}`
}
