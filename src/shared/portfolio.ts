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
  AssetAccountIntegrationInput,
  AssetAccountIntegrationView
} from './integrations'

export type Market = 'CN' | 'HK' | 'US' | 'CC'
export type BaseCurrency = 'CNY' | 'HKD' | 'USD'
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

export type AccountGroup = {
  id: string
  name: string
  assetAccountIds: string[]
}

export type AssetAccount = {
  id: string
  name: string
  type: AssetAccountType
  sync?: AssetAccountSync
  positions: Position[]
}

export type PositionGroup = {
  id: string
  name: string
  positionIds: string[]
}

export type Workspace = {
  id: string
  name: string
  baseCurrency: BaseCurrency
  exchangeRateProvider: ExchangeRateProvider
  exchangeRateRefreshIntervalMinutes: number
  accountGroups: AccountGroup[]
  assetAccounts: AssetAccount[]
  positionGroups: PositionGroup[]
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
}

export type WorkspaceInput = Pick<Workspace, 'name' | 'baseCurrency'>
export type WorkspaceSettingsInput = Pick<
  Workspace,
  | 'name'
  | 'baseCurrency'
  | 'exchangeRateProvider'
  | 'exchangeRateRefreshIntervalMinutes'
>
export type AssetAccountInput = Pick<
  AssetAccount,
  'name' | 'type' | 'sync'
> & {
  integration?: AssetAccountIntegrationInput
}
export type PositionInput = Omit<Position, 'id'>
export type AccountGroupInput = Pick<AccountGroup, 'name'>
export type PositionGroupInput = Pick<PositionGroup, 'name'>

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
      type: 'create-account-group'
      workspaceId: string
      input: AccountGroupInput
    }
  | {
      type: 'update-account-group'
      workspaceId: string
      groupId: string
      input: AccountGroupInput
    }
  | { type: 'delete-account-group'; workspaceId: string; groupId: string }
  | {
      type: 'set-account-group-accounts'
      workspaceId: string
      groupId: string
      assetAccountIds: string[]
    }
  | {
      type: 'remove-account-from-group'
      workspaceId: string
      groupId: string
      assetAccountId: string
    }
  | {
      type: 'create-position-group'
      workspaceId: string
      input: PositionGroupInput
    }
  | {
      type: 'update-position-group'
      workspaceId: string
      groupId: string
      input: PositionGroupInput
    }
  | { type: 'delete-position-group'; workspaceId: string; groupId: string }
  | {
      type: 'set-position-group-positions'
      workspaceId: string
      groupId: string
      positionIds: string[]
    }
  | {
      type: 'remove-position-from-group'
      workspaceId: string
      groupId: string
      positionId: string
    }
  | {
      type: 'create-asset-account'
      workspaceId: string
      input: AssetAccountInput
    }
  | {
      type: 'update-asset-account'
      workspaceId: string
      assetAccountId: string
      input: AssetAccountInput
    }
  | {
      type: 'delete-asset-account'
      workspaceId: string
      assetAccountId: string
    }
  | {
      type: 'save-position'
      workspaceId: string
      assetAccountId: string
      input: PositionInput
      positionId?: string
    }
  | {
      type: 'delete-position'
      workspaceId: string
      assetAccountId: string
      positionId: string
    }
  | {
      type: 'replace-positions'
      workspaceId: string
      assetAccountId: string
      positions: PositionInput[]
      lastSyncedAt?: string
    }
  | {
      type: 'import-workspace'
      workspace: Workspace
      snapshots?: WorkspaceSnapshot[]
    }

export type PortfolioCommandResponse = {
  data: AppData
  integrations: AssetAccountIntegration[]
  result?: string | null
}

export type PortfolioLoadResponse = {
  data: AppData
  integrations: AssetAccountIntegration[]
}

export type PortfolioClientCommandResponse = Omit<
  PortfolioCommandResponse,
  'integrations'
> & {
  integrations: AssetAccountIntegrationView[]
}

export type PortfolioClientLoadResponse = Omit<
  PortfolioLoadResponse,
  'integrations'
> & {
  integrations: AssetAccountIntegrationView[]
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
