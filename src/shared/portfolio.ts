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
import type {
  AssetAccountIntegration,
  AssetAccountIntegrationInput
} from './integrations'

export type Market = 'CN' | 'HK' | 'US' | 'CC'
export type AnchorCurrency = 'CNY' | 'HKD' | 'USD'
export type AssetAccountType =
  | 'Futu'
  | 'Boci'
  | 'Okx'
  | 'Ibkr'
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
}

export type AssetAccountSync = {
  interval: number
  lastSyncedAt?: string
}

export type Holder = {
  id: string
  name: string
}

export type AssetAccount = {
  id: string
  name: string
  type: AssetAccountType
  holderId: string
  sync?: AssetAccountSync
  positions: Position[]
}

export type PositionGroup = {
  id: string
  name: string
  positionIds: string[]
}

export type ProductAccount = {
  id: string
  name: string
  anchorCurrency: AnchorCurrency
  exchangeRateProvider: ExchangeRateProvider
  exchangeRateRefreshIntervalMinutes: number
  holders: Holder[]
  assetAccounts: AssetAccount[]
  positionGroups: PositionGroup[]
}

export type PortfolioSnapshot = {
  id: string
  productAccountId: string
  createdAt: string
  account: ProductAccount
  exchangeRates?: ExchangeRateSnapshot
}

export type AppData = {
  version: 1
  activeProductAccountId: string | null
  productAccounts: ProductAccount[]
  snapshots: PortfolioSnapshot[]
}

export type AccountBackup = {
  account: ProductAccount
  snapshots: PortfolioSnapshot[]
}

export type ProductAccountInput = Pick<ProductAccount, 'name' | 'anchorCurrency'>
export type ProductAccountSettingsInput = Pick<
  ProductAccount,
  | 'name'
  | 'anchorCurrency'
  | 'exchangeRateProvider'
  | 'exchangeRateRefreshIntervalMinutes'
  | 'holders'
>
export type AssetAccountInput = Pick<
  AssetAccount,
  'name' | 'type' | 'holderId' | 'sync'
> & {
  integration?: AssetAccountIntegrationInput
}
export type PositionInput = Omit<Position, 'id'>
export type PositionGroupInput = Pick<PositionGroup, 'name'>

export type PortfolioCommand =
  | { type: 'set-active-product-account'; id: string }
  | {
      type: 'create-snapshot'
      productAccountId: string
      exchangeRates?: ExchangeRateSnapshot | null
    }
  | { type: 'delete-snapshot'; snapshotId: string }
  | { type: 'create-product-account'; input: ProductAccountInput }
  | {
      type: 'update-product-account'
      id: string
      input: ProductAccountSettingsInput
    }
  | { type: 'delete-product-account'; id: string }
  | {
      type: 'create-position-group'
      productAccountId: string
      input: PositionGroupInput
    }
  | {
      type: 'update-position-group'
      productAccountId: string
      groupId: string
      input: PositionGroupInput
    }
  | { type: 'delete-position-group'; productAccountId: string; groupId: string }
  | {
      type: 'set-position-group-positions'
      productAccountId: string
      groupId: string
      positionIds: string[]
    }
  | {
      type: 'remove-position-from-group'
      productAccountId: string
      groupId: string
      positionId: string
    }
  | {
      type: 'create-asset-account'
      productAccountId: string
      input: AssetAccountInput
    }
  | {
      type: 'update-asset-account'
      productAccountId: string
      assetAccountId: string
      input: AssetAccountInput
    }
  | {
      type: 'delete-asset-account'
      productAccountId: string
      assetAccountId: string
    }
  | {
      type: 'save-position'
      productAccountId: string
      assetAccountId: string
      input: PositionInput
      positionId?: string
    }
  | {
      type: 'delete-position'
      productAccountId: string
      assetAccountId: string
      positionId: string
    }
  | {
      type: 'replace-positions'
      productAccountId: string
      assetAccountId: string
      positions: PositionInput[]
      lastSyncedAt?: string
    }
  | {
      type: 'import-account'
      account: ProductAccount
      snapshots?: PortfolioSnapshot[]
    }

export type PortfolioCommandResponse = {
  revision: string
  data: AppData
  integrations: AssetAccountIntegration[]
  result?: string | null
}

export type PortfolioLoadResponse = {
  revision: string
  data: AppData
  integrations: AssetAccountIntegration[]
}

export type PortfolioSyncResponse = {
  revision: string
  positionCount: number
  syncedAt: string
}

export const EMPTY_PORTFOLIO_DATA: AppData = {
  version: 1,
  activeProductAccountId: null,
  productAccounts: [],
  snapshots: []
}

export const DEFAULT_SYNC_INTERVAL = 30
export const ANCHOR_CURRENCIES: readonly AnchorCurrency[] = ['CNY', 'HKD', 'USD']
export const DEFAULT_ANCHOR_CURRENCY: AnchorCurrency = 'CNY'
export {
  DEFAULT_EXCHANGE_RATE_PROVIDER,
  DEFAULT_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  DEFAULT_FUTU_OPEND_HOST,
  DEFAULT_FUTU_OPEND_PORT,
  DEFAULT_IBKR_GATEWAY_HOST,
  DEFAULT_IBKR_GATEWAY_PORT,
  EXCHANGE_RATE_PROVIDERS,
  MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES
}
export type { ExchangeRateProvider }

export const exchangeRateProviderLabels: Record<ExchangeRateProvider, string> = {
  coinbase: 'Coinbase'
}

export const assetAccountTypeLabels: Record<AssetAccountType, string> = {
  Futu: '富途牛牛',
  Boci: '中银国际',
  Okx: '欧易',
  Ibkr: '盈透证券',
  Binance: '币安',
  Alipay: '支付宝',
  General: '通用',
  Cmb: '招商银行',
  Boc: '中国银行'
}

export const marketOrder: readonly Market[] = ['CN', 'HK', 'US', 'CC']

export const marketMeta: Record<Market, { label: string; shortLabel: string }> = {
  CN: { label: 'CN', shortLabel: 'CN' },
  HK: { label: 'HK', shortLabel: 'HK' },
  US: { label: 'US', shortLabel: 'US' },
  CC: { label: 'CC', shortLabel: 'CC' }
}

export const defaultCurrencyByMarket: Record<Market, string> = {
  CN: 'CNY',
  HK: 'HKD',
  US: 'USD',
  CC: 'USDT'
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
