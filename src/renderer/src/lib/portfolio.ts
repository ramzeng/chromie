import { useEffect, useState } from 'react'

import type { ExchangeRateSnapshot } from '../../../shared/exchange-rates'
import {
  DEFAULT_FUTU_OPEND_HOST,
  DEFAULT_FUTU_OPEND_PORT
} from '../../../shared/futu'

export { DEFAULT_FUTU_OPEND_HOST, DEFAULT_FUTU_OPEND_PORT }

export type Market = 'CN' | 'HK' | 'US' | 'CC'
export type AnchorCurrency = 'CNY' | 'HKD' | 'USD'
export type AssetAccountType =
  | 'Futu'
  | 'Boci'
  | 'Okx'
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

export type WebSocketConfig = {
  host: string
  port: number
  key?: string
}

export type OkxApiConfig = {
  apiKey: string
  secretKey: string
  passphrase: string
}

export type SyncConfig = {
  interval: number
  websocket?: WebSocketConfig
  api?: OkxApiConfig
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
  holderId?: string
  sync?: SyncConfig
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
  version: 2
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
  'name' | 'anchorCurrency' | 'holders'
>
export type AssetAccountInput = Pick<
  AssetAccount,
  'name' | 'type' | 'holderId' | 'sync'
>
export type PositionInput = Omit<Position, 'id'>
export type PositionGroupInput = Pick<PositionGroup, 'name'>

export const DEFAULT_SYNC_INTERVAL = 30
export const ANCHOR_CURRENCIES: readonly AnchorCurrency[] = ['CNY', 'HKD', 'USD']
export const DEFAULT_ANCHOR_CURRENCY: AnchorCurrency = 'CNY'
export const assetAccountTypeLabels: Record<AssetAccountType, string> = {
  Futu: '富途牛牛',
  Boci: '中银国际',
  Okx: '欧易',
  Alipay: '支付宝',
  General: '通用',
  Cmb: '招商银行',
  Boc: '中国银行'
}

function normalizeAssetAccountName(
  value: string,
  type: AssetAccountType
): string {
  return type === 'General' ? value.trim() : assetAccountTypeLabels[type]
}

function isCurrencyCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z0-9]{2,12}$/.test(value.trim().toUpperCase())
}

function normalizeAnchorCurrency(value: unknown): AnchorCurrency {
  if (!isCurrencyCode(value)) return DEFAULT_ANCHOR_CURRENCY
  const currency = value.trim().toUpperCase()
  return currency === 'CNY' || currency === 'HKD' || currency === 'USD'
    ? currency
    : DEFAULT_ANCHOR_CURRENCY
}

function normalizeSyncInterval(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 5
    ? Math.min(Math.round(value), 3600)
    : DEFAULT_SYNC_INTERVAL
}

function normalizeSyncHost(value: unknown): string {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, 253)
    : DEFAULT_FUTU_OPEND_HOST
}

function normalizeSyncPort(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535
    ? value
    : DEFAULT_FUTU_OPEND_PORT
}

const STORAGE_KEY = 'chromie.data.v1'

const EMPTY_DATA: AppData = {
  version: 2,
  activeProductAccountId: null,
  productAccounts: [],
  snapshots: []
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

function createId(): string {
  return crypto.randomUUID()
}

function normalizePosition(input: PositionInput, id?: string): Position {
  return {
    id: id?.trim() || createId(),
    market: input.market,
    symbol: input.symbol.trim().toUpperCase(),
    name: input.name.trim(),
    currency: input.currency.trim().toUpperCase(),
    quantity: input.quantity,
    ...(input.price === undefined ? {} : { price: input.price })
  }
}

function normalizeStoredMarket(value: unknown): Market | null {
  if (typeof value !== 'string') return null
  const market = value.toUpperCase()
  return market === 'CN' || market === 'US' || market === 'HK' || market === 'CC'
    ? market
    : null
}

function normalizeAssetAccountType(value: unknown): AssetAccountType | null {
  if (typeof value !== 'string') return null
  const type = value.toLowerCase()
  if (type === 'futu') return 'Futu'
  if (type === 'boci') return 'Boci'
  if (type === 'okx') return 'Okx'
  if (type === 'alipay') return 'Alipay'
  if (type === 'general') return 'General'
  if (type === 'cmb') return 'Cmb'
  if (type === 'boc') return 'Boc'
  return null
}

function normalizeSyncConfig(
  value: unknown,
  type: AssetAccountType
): SyncConfig | undefined {
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
  const sync = value as {
    interval?: unknown
    websocket?: unknown
    api?: unknown
    lastSyncedAt?: unknown
  }
  const lastSyncedAt =
    typeof sync.lastSyncedAt === 'string' && Number.isFinite(Date.parse(sync.lastSyncedAt))
      ? sync.lastSyncedAt
      : undefined

  if (type === 'Okx') {
    if (!sync.api || typeof sync.api !== 'object') return undefined
    const api = sync.api as {
      apiKey?: unknown
      secretKey?: unknown
      passphrase?: unknown
    }
    if (
      typeof api.apiKey !== 'string' ||
      !api.apiKey.trim() ||
      typeof api.secretKey !== 'string' ||
      !api.secretKey ||
      typeof api.passphrase !== 'string' ||
      !api.passphrase
    ) {
      return undefined
    }
    return {
      interval: normalizeSyncInterval(sync.interval),
      api: {
        apiKey: api.apiKey.trim().slice(0, 256),
        secretKey: api.secretKey.slice(0, 512),
        passphrase: api.passphrase.slice(0, 256)
      },
      ...(lastSyncedAt ? { lastSyncedAt } : {})
    }
  }

  if (!sync.websocket || typeof sync.websocket !== 'object') return undefined
  const websocket = sync.websocket as { host?: unknown; port?: unknown; key?: unknown }
  return {
    interval: normalizeSyncInterval(sync.interval),
    websocket: {
      host: normalizeSyncHost(websocket.host),
      port: normalizeSyncPort(websocket.port),
      ...(typeof websocket.key === 'string' && websocket.key.trim()
        ? { key: websocket.key.trim() }
        : {})
    },
    ...(lastSyncedAt ? { lastSyncedAt } : {})
  }
}

function normalizeStoredPosition(value: unknown): Position | null {
  if (!value || typeof value !== 'object') return null
  const position = value as Partial<Position>
  const market = normalizeStoredMarket(position.market)
  if (
    !market ||
    typeof position.id !== 'string' ||
    !position.id.trim() ||
    typeof position.symbol !== 'string' ||
    typeof position.name !== 'string' ||
    typeof position.currency !== 'string' ||
    typeof position.quantity !== 'number' ||
    !Number.isFinite(position.quantity)
  ) {
    return null
  }
  const price =
    typeof position.price === 'number' && Number.isFinite(position.price)
      ? position.price
      : undefined
  return normalizePosition(
    {
      market,
      symbol: position.symbol,
      name: position.name,
      currency: position.currency,
      quantity: position.quantity,
      ...(price === undefined ? {} : { price })
    },
    position.id
  )
}

function normalizeStoredExchangeRates(value: unknown): ExchangeRateSnapshot | null {
  if (!value || typeof value !== 'object') return null
  const snapshot = value as Partial<ExchangeRateSnapshot>
  if (
    snapshot.provider !== 'coinbase' ||
    snapshot.baseCurrency !== 'USD' ||
    typeof snapshot.fetchedAt !== 'string' ||
    !Number.isFinite(Date.parse(snapshot.fetchedAt)) ||
    !snapshot.rates ||
    typeof snapshot.rates !== 'object' ||
    Array.isArray(snapshot.rates)
  ) {
    return null
  }

  const rates: Record<string, number> = { USD: 1 }
  Object.entries(snapshot.rates).forEach(([rawCurrency, rawRate]) => {
    const currency = rawCurrency.trim().toUpperCase()
    if (
      isCurrencyCode(currency) &&
      typeof rawRate === 'number' &&
      Number.isFinite(rawRate) &&
      rawRate > 0
    ) {
      rates[currency] = rawRate
    }
  })
  if (Object.keys(rates).length < 2) return null

  return {
    provider: 'coinbase',
    baseCurrency: 'USD',
    rates,
    fetchedAt: snapshot.fetchedAt
  }
}

function normalizeStoredData(input: unknown): AppData | null {
  if (!input || typeof input !== 'object') return null
  const value = input as {
    version?: unknown
    activeProductAccountId?: unknown
    productAccounts?: unknown
    snapshots?: unknown
  }
  if (
    (value.version !== 1 && value.version !== 2) ||
    !Array.isArray(value.productAccounts)
  ) {
    return null
  }

  const productAccounts = value.productAccounts.flatMap((account) => {
      if (!account || typeof account !== 'object') return []
      const storedAccount = account as {
        id?: unknown
        name?: unknown
        anchorCurrency?: unknown
        holders?: unknown
        assetAccounts?: unknown
        positionGroups?: unknown
      }
      if (
        typeof storedAccount.id !== 'string' ||
        typeof storedAccount.name !== 'string' ||
        !Array.isArray(storedAccount.assetAccounts)
      ) {
        return []
      }
      const usedHolderIds = new Set<string>()
      const holders = Array.isArray(storedAccount.holders)
        ? storedAccount.holders.flatMap((holder) => {
            if (!holder || typeof holder !== 'object') return []
            const storedHolder = holder as { id?: unknown; name?: unknown }
            if (
              typeof storedHolder.id !== 'string' ||
              !storedHolder.id.trim() ||
              usedHolderIds.has(storedHolder.id) ||
              typeof storedHolder.name !== 'string' ||
              !storedHolder.name.trim()
            ) {
              return []
            }
            usedHolderIds.add(storedHolder.id)
            return [{ id: storedHolder.id, name: storedHolder.name.trim() }]
          })
        : []
      const usedPositionIds = new Set<string>()
      const assetAccounts = storedAccount.assetAccounts.flatMap((assetAccount) => {
        if (!assetAccount || typeof assetAccount !== 'object') return []
        const storedAssetAccount = assetAccount as {
          id?: unknown
          name?: unknown
          type?: unknown
          holderId?: unknown
          sync?: unknown
          positions?: unknown
        }
        const type = normalizeAssetAccountType(storedAssetAccount.type)
        if (
          typeof storedAssetAccount.id !== 'string' ||
          typeof storedAssetAccount.name !== 'string' ||
          !type ||
          !Array.isArray(storedAssetAccount.positions)
        ) {
          return []
        }
        const sync = normalizeSyncConfig(storedAssetAccount.sync, type)
        return [
          {
            id: storedAssetAccount.id,
            name: normalizeAssetAccountName(storedAssetAccount.name, type),
            type,
            ...(typeof storedAssetAccount.holderId === 'string' &&
            usedHolderIds.has(storedAssetAccount.holderId)
              ? { holderId: storedAssetAccount.holderId }
              : {}),
            ...(sync ? { sync } : {}),
            positions: storedAssetAccount.positions.flatMap((position) => {
              const normalized = normalizeStoredPosition(position)
              if (!normalized) return []
              const uniquePosition = usedPositionIds.has(normalized.id)
                ? { ...normalized, id: createId() }
                : normalized
              usedPositionIds.add(uniquePosition.id)
              return [uniquePosition]
            })
          }
        ]
      })
      const availablePositionIds = new Set(
        assetAccounts.flatMap((assetAccount) =>
          assetAccount.positions.map((position) => position.id)
        )
      )
      const assignedPositionIds = new Set<string>()
      const positionGroups = Array.isArray(storedAccount.positionGroups)
        ? storedAccount.positionGroups.flatMap((group) => {
            if (!group || typeof group !== 'object') return []
            const storedGroup = group as {
              id?: unknown
              name?: unknown
              positionIds?: unknown
            }
            if (
              typeof storedGroup.id !== 'string' ||
              typeof storedGroup.name !== 'string' ||
              !Array.isArray(storedGroup.positionIds)
            ) {
              return []
            }
            const seenPositionIds = new Set<string>()
            const positionIds = storedGroup.positionIds.flatMap((positionId) => {
              if (
                typeof positionId !== 'string' ||
                !availablePositionIds.has(positionId) ||
                assignedPositionIds.has(positionId) ||
                seenPositionIds.has(positionId)
              ) {
                return []
              }
              seenPositionIds.add(positionId)
              assignedPositionIds.add(positionId)
              return [positionId]
            })
            return [
              {
                id: storedGroup.id,
                name: storedGroup.name,
                positionIds
              }
            ]
          })
        : []
      return [
        {
          id: storedAccount.id,
          name: storedAccount.name,
          anchorCurrency: normalizeAnchorCurrency(storedAccount.anchorCurrency),
          holders,
          assetAccounts,
          positionGroups
        }
      ]
  })
  const activeProductAccountId = productAccounts.some(
    (account) => account.id === value.activeProductAccountId
  )
    ? (value.activeProductAccountId as string)
    : (productAccounts[0]?.id ?? null)

  const productAccountIds = new Set(productAccounts.map((account) => account.id))
  const usedSnapshotIds = new Set<string>()
  const snapshots = value.version === 2 && Array.isArray(value.snapshots)
    ? value.snapshots.flatMap((snapshot) => {
        if (!snapshot || typeof snapshot !== 'object') return []
        const storedSnapshot = snapshot as {
          id?: unknown
          productAccountId?: unknown
          createdAt?: unknown
          account?: unknown
          exchangeRates?: unknown
        }
        if (
          typeof storedSnapshot.id !== 'string' ||
          !storedSnapshot.id.trim() ||
          usedSnapshotIds.has(storedSnapshot.id) ||
          typeof storedSnapshot.productAccountId !== 'string' ||
          !productAccountIds.has(storedSnapshot.productAccountId) ||
          typeof storedSnapshot.createdAt !== 'string' ||
          !Number.isFinite(Date.parse(storedSnapshot.createdAt))
        ) {
          return []
        }
        const normalizedAccountData = normalizeStoredData({
          version: 1,
          activeProductAccountId: storedSnapshot.productAccountId,
          productAccounts: [storedSnapshot.account]
        })
        const account = normalizedAccountData?.productAccounts[0]
        if (!account || account.id !== storedSnapshot.productAccountId) return []
        const exchangeRates = normalizeStoredExchangeRates(storedSnapshot.exchangeRates)
        usedSnapshotIds.add(storedSnapshot.id)
        return [{
          id: storedSnapshot.id,
          productAccountId: storedSnapshot.productAccountId,
          createdAt: storedSnapshot.createdAt,
          account,
          ...(exchangeRates ? { exchangeRates } : {})
        }]
      })
    : []

  snapshots.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
  return { version: 2, activeProductAccountId, productAccounts, snapshots }
}

function parseStoredData(raw: string): AppData | null {
  try {
    return normalizeStoredData(JSON.parse(raw))
  } catch {
    return null
  }
}

function loadData(): AppData {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  return raw ? (parseStoredData(raw) ?? EMPTY_DATA) : EMPTY_DATA
}

function isValidBackupPosition(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const position = value as Partial<Position>
  return (
    typeof position.id === 'string' &&
    Boolean(position.id.trim()) &&
    (position.market === 'CN' ||
      position.market === 'US' ||
      position.market === 'HK' ||
      position.market === 'CC') &&
    typeof position.symbol === 'string' &&
    Boolean(position.symbol.trim()) &&
    typeof position.name === 'string' &&
    Boolean(position.name.trim()) &&
    typeof position.currency === 'string' &&
    Boolean(position.currency.trim()) &&
    typeof position.quantity === 'number' &&
    Number.isFinite(position.quantity) &&
    (position.price === undefined ||
      (typeof position.price === 'number' && Number.isFinite(position.price)))
  )
}

function isValidBackupSync(value: unknown, type: AssetAccountType): boolean {
  if (
    type === 'Boci' ||
    type === 'Alipay' ||
    type === 'General' ||
    type === 'Cmb' ||
    type === 'Boc'
  ) {
    return false
  }
  if (!value || typeof value !== 'object') return false
  const sync = value as Partial<SyncConfig>
  if (
    !Number.isInteger(sync.interval) ||
    sync.interval === undefined ||
    sync.interval < 5 ||
    sync.interval > 3600 ||
    (sync.lastSyncedAt !== undefined &&
      (typeof sync.lastSyncedAt !== 'string' ||
        !Number.isFinite(Date.parse(sync.lastSyncedAt))))
  ) {
    return false
  }
  if (type === 'Futu') {
    return Boolean(
      sync.websocket &&
        typeof sync.websocket.host === 'string' &&
        sync.websocket.host.trim() &&
        Number.isInteger(sync.websocket.port) &&
        sync.websocket.port >= 1 &&
        sync.websocket.port <= 65535 &&
        (sync.websocket.key === undefined || typeof sync.websocket.key === 'string')
    )
  }
  return Boolean(
    sync.api &&
      typeof sync.api.apiKey === 'string' &&
      sync.api.apiKey.trim() &&
      typeof sync.api.secretKey === 'string' &&
      sync.api.secretKey &&
      typeof sync.api.passphrase === 'string' &&
      sync.api.passphrase
  )
}

function isValidBackupAccount(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const account = value as Partial<ProductAccount>
  if (
    typeof account.id !== 'string' ||
    !account.id ||
    typeof account.name !== 'string' ||
    !account.name.trim() ||
    (account.anchorCurrency !== undefined &&
      !isCurrencyCode(account.anchorCurrency)) ||
    !Array.isArray(account.holders) ||
    !Array.isArray(account.assetAccounts)
  ) {
    return false
  }

  const holderIds = new Set<string>()
  const validHolders = account.holders.every((holder) => {
    if (
      !holder ||
      typeof holder.id !== 'string' ||
      !holder.id.trim() ||
      holderIds.has(holder.id) ||
      typeof holder.name !== 'string' ||
      !holder.name.trim()
    ) {
      return false
    }
    holderIds.add(holder.id)
    return true
  })
  if (!validHolders) return false

  const assetAccountIds = new Set<string>()
  const positionIds = new Set<string>()
  const validAssetAccounts = account.assetAccounts.every((assetAccount) => {
    const type = normalizeAssetAccountType(assetAccount?.type)
    if (
      !assetAccount ||
      typeof assetAccount.id !== 'string' ||
      !assetAccount.id ||
      assetAccountIds.has(assetAccount.id) ||
      typeof assetAccount.name !== 'string' ||
      !assetAccount.name.trim() ||
      !type ||
      (assetAccount.holderId !== undefined &&
        (typeof assetAccount.holderId !== 'string' ||
          !holderIds.has(assetAccount.holderId))) ||
      !Array.isArray(assetAccount.positions) ||
      !assetAccount.positions.every((position) => {
        if (!isValidBackupPosition(position) || positionIds.has(position.id)) return false
        positionIds.add(position.id)
        return true
      }) ||
      (assetAccount.sync !== undefined && !isValidBackupSync(assetAccount.sync, type))
    ) {
      return false
    }
    assetAccountIds.add(assetAccount.id)
    return true
  })
  if (!validAssetAccounts) return false

  if (!Array.isArray(account.positionGroups)) return false

  const groupIds = new Set<string>()
  const assignedPositionIds = new Set<string>()
  return account.positionGroups.every((group) => {
    if (
      !group ||
      typeof group.id !== 'string' ||
      !group.id ||
      groupIds.has(group.id) ||
      typeof group.name !== 'string' ||
      !group.name.trim() ||
      !Array.isArray(group.positionIds)
    ) {
      return false
    }
    groupIds.add(group.id)
    const groupPositionIds = new Set<string>()
    return group.positionIds.every((positionId) => {
      if (
        typeof positionId !== 'string' ||
        !positionIds.has(positionId) ||
        assignedPositionIds.has(positionId) ||
        groupPositionIds.has(positionId)
      ) {
        return false
      }
      groupPositionIds.add(positionId)
      assignedPositionIds.add(positionId)
      return true
    })
  })
}

function isValidBackupSnapshot(
  value: unknown,
  productAccountId: string,
  usedIds: Set<string>
): value is PortfolioSnapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as Partial<PortfolioSnapshot>
  const snapshotAccount = snapshot.account
  if (
    typeof snapshot.id !== 'string' ||
    !snapshot.id.trim() ||
    usedIds.has(snapshot.id) ||
    snapshot.productAccountId !== productAccountId ||
    typeof snapshot.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(snapshot.createdAt)) ||
    !isValidBackupAccount(snapshotAccount) ||
    (snapshotAccount as ProductAccount).id !== productAccountId ||
    (snapshot.exchangeRates !== undefined &&
      !normalizeStoredExchangeRates(snapshot.exchangeRates))
  ) {
    return false
  }
  usedIds.add(snapshot.id)
  return true
}

export function createAccountBackup(
  account: ProductAccount,
  snapshots: PortfolioSnapshot[] = []
): string {
  return JSON.stringify(
    {
      format: 'chromie-account',
      version: 2,
      exportedAt: new Date().toISOString(),
      account,
      snapshots
    },
    null,
    2
  )
}

export function parseAccountBackup(raw: string): AccountBackup | null {
  try {
    const backup = JSON.parse(raw) as {
      format?: unknown
      version?: unknown
      exportedAt?: unknown
      account?: unknown
      snapshots?: unknown
    }
    if (
      backup.format !== 'chromie-account' ||
      (backup.version !== 1 && backup.version !== 2) ||
      typeof backup.exportedAt !== 'string' ||
      !Number.isFinite(Date.parse(backup.exportedAt)) ||
      !isValidBackupAccount(backup.account)
    ) {
      return null
    }
    const account = backup.account as ProductAccount
    const usedSnapshotIds = new Set<string>()
    const rawSnapshots = backup.version === 2 ? backup.snapshots : []
    if (
      !Array.isArray(rawSnapshots) ||
      !rawSnapshots.every((snapshot) =>
        isValidBackupSnapshot(snapshot, account.id, usedSnapshotIds)
      )
    ) {
      return null
    }
    const normalized = normalizeStoredData({
      version: 2,
      activeProductAccountId: account.id,
      productAccounts: [account],
      snapshots: rawSnapshots
    })
    const normalizedAccount = normalized?.productAccounts[0]
    if (!normalizedAccount || normalized.snapshots.length !== rawSnapshots.length) return null
    return { account: normalizedAccount, snapshots: normalized.snapshots }
  } catch {
    return null
  }
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

export function usePortfolio() {
  const [data, setData] = useState<AppData>(loadData)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  const activeProductAccount =
    data.productAccounts.find((account) => account.id === data.activeProductAccountId) ?? null
  const activeSnapshots = activeProductAccount
    ? data.snapshots.filter(
        (snapshot) => snapshot.productAccountId === activeProductAccount.id
      )
    : []

  function createSnapshot(
    productAccountId: string,
    exchangeRates?: ExchangeRateSnapshot | null
  ): string | null {
    const account = data.productAccounts.find((item) => item.id === productAccountId)
    if (!account) return null
    const snapshot: PortfolioSnapshot = {
      id: createId(),
      productAccountId,
      createdAt: new Date().toISOString(),
      account: structuredClone(account),
      ...(exchangeRates ? { exchangeRates: structuredClone(exchangeRates) } : {})
    }
    setData((current) => ({
      ...current,
      snapshots: [snapshot, ...current.snapshots]
    }))
    return snapshot.id
  }

  function deleteSnapshot(snapshotId: string): void {
    setData((current) => ({
      ...current,
      snapshots: current.snapshots.filter((snapshot) => snapshot.id !== snapshotId)
    }))
  }

  function setActiveProductAccount(id: string): void {
    if (!data.productAccounts.some((account) => account.id === id)) return
    setData((current) => ({ ...current, activeProductAccountId: id }))
  }

  function createProductAccount(input: ProductAccountInput): string {
    const account: ProductAccount = {
      id: createId(),
      name: input.name.trim(),
      anchorCurrency: normalizeAnchorCurrency(input.anchorCurrency),
      holders: [],
      assetAccounts: [],
      positionGroups: []
    }
    setData((current) => ({
      ...current,
      activeProductAccountId: account.id,
      productAccounts: [...current.productAccounts, account]
    }))
    return account.id
  }

  function updateProductAccount(id: string, input: ProductAccountSettingsInput): void {
    const usedHolderIds = new Set<string>()
    const holders = input.holders.flatMap((holder) => {
      const id = holder.id.trim()
      const name = holder.name.trim()
      if (!id || !name || usedHolderIds.has(id)) return []
      usedHolderIds.add(id)
      return [{ id, name }]
    })
    setData((current) => ({
      ...current,
      productAccounts: current.productAccounts.map((account) =>
        account.id === id
          ? {
              ...account,
              name: input.name.trim(),
              anchorCurrency: normalizeAnchorCurrency(input.anchorCurrency),
              holders,
              assetAccounts: account.assetAccounts.map((assetAccount) => ({
                ...assetAccount,
                holderId:
                  assetAccount.holderId && usedHolderIds.has(assetAccount.holderId)
                    ? assetAccount.holderId
                    : undefined
              }))
            }
          : account
      )
    }))
  }

  function deleteProductAccount(id: string): void {
    setData((current) => {
      const productAccounts = current.productAccounts.filter((account) => account.id !== id)
      return {
        ...current,
        activeProductAccountId:
          current.activeProductAccountId === id
            ? (productAccounts[0]?.id ?? null)
            : current.activeProductAccountId,
        productAccounts,
        snapshots: current.snapshots.filter(
          (snapshot) => snapshot.productAccountId !== id
        )
      }
    })
  }

  function createPositionGroup(
    productAccountId: string,
    input: PositionGroupInput
  ): string {
    const group: PositionGroup = {
      id: createId(),
      name: input.name.trim(),
      positionIds: []
    }
    setData((current) => ({
      ...current,
      productAccounts: current.productAccounts.map((account) =>
        account.id === productAccountId
          ? { ...account, positionGroups: [...account.positionGroups, group] }
          : account
      )
    }))
    return group.id
  }

  function updatePositionGroup(
    productAccountId: string,
    groupId: string,
    input: PositionGroupInput
  ): void {
    setData((current) => ({
      ...current,
      productAccounts: current.productAccounts.map((account) =>
        account.id === productAccountId
          ? {
              ...account,
              positionGroups: account.positionGroups.map((group) =>
                group.id === groupId ? { ...group, name: input.name.trim() } : group
              )
            }
          : account
      )
    }))
  }

  function deletePositionGroup(productAccountId: string, groupId: string): void {
    setData((current) => ({
      ...current,
      productAccounts: current.productAccounts.map((account) =>
        account.id === productAccountId
          ? {
              ...account,
              positionGroups: account.positionGroups.filter((group) => group.id !== groupId)
            }
          : account
      )
    }))
  }

  function setPositionGroupPositions(
    productAccountId: string,
    groupId: string,
    positionIds: string[]
  ): string | null {
    const productAccount = data.productAccounts.find(
      (account) => account.id === productAccountId
    )
    if (!productAccount) return '没有找到对应的账户'
    if (!productAccount.positionGroups.some((group) => group.id === groupId)) {
      return '没有找到对应的持仓分组'
    }

    const availablePositionIds = new Set(
      productAccount.assetAccounts.flatMap((account) =>
        account.positions.map((position) => position.id)
      )
    )
    const normalizedPositionIds = [...new Set(positionIds)]
    if (normalizedPositionIds.some((positionId) => !availablePositionIds.has(positionId))) {
      return '部分持仓已不存在，请重新选择'
    }
    const assignedGroupByPositionId = new Map(
      productAccount.positionGroups.flatMap((group) =>
        group.id === groupId
          ? []
          : group.positionIds.map((positionId) => [positionId, group.name] as const)
      )
    )
    const conflictingPositionId = normalizedPositionIds.find((positionId) =>
      assignedGroupByPositionId.has(positionId)
    )
    if (conflictingPositionId) {
      const position = productAccount.assetAccounts
        .flatMap((account) => account.positions)
        .find((item) => item.id === conflictingPositionId)
      return `${position?.symbol ?? '所选持仓'} 已属于“${assignedGroupByPositionId.get(conflictingPositionId)}”，一个持仓只能加入一个分组`
    }

    setData((current) => ({
      ...current,
      productAccounts: current.productAccounts.map((account) =>
        account.id === productAccountId
          ? {
              ...account,
              positionGroups: account.positionGroups.map((group) =>
                group.id === groupId
                  ? { ...group, positionIds: normalizedPositionIds }
                  : group
              )
            }
          : account
      )
    }))
    return null
  }

  function removePositionFromGroup(
    productAccountId: string,
    groupId: string,
    positionId: string
  ): void {
    setData((current) => ({
      ...current,
      productAccounts: current.productAccounts.map((account) =>
        account.id === productAccountId
          ? {
              ...account,
              positionGroups: account.positionGroups.map((group) =>
                group.id === groupId
                  ? {
                      ...group,
                      positionIds: group.positionIds.filter((id) => id !== positionId)
                    }
                  : group
              )
            }
          : account
      )
    }))
  }

  function createAssetAccount(productAccountId: string, input: AssetAccountInput): string {
    const type = normalizeAssetAccountType(input.type) ?? 'Futu'
    const sync = normalizeSyncConfig(input.sync, type)
    const holderId = data.productAccounts
      .find((account) => account.id === productAccountId)
      ?.holders.some((holder) => holder.id === input.holderId)
      ? input.holderId
      : undefined
    const assetAccount: AssetAccount = {
      id: createId(),
      name: normalizeAssetAccountName(input.name, type),
      type,
      ...(holderId ? { holderId } : {}),
      ...(sync ? { sync } : {}),
      positions: []
    }
    setData((current) => ({
      ...current,
      productAccounts: current.productAccounts.map((account) =>
        account.id === productAccountId
          ? { ...account, assetAccounts: [...account.assetAccounts, assetAccount] }
          : account
      )
    }))
    return assetAccount.id
  }

  function updateAssetAccount(
    productAccountId: string,
    assetAccountId: string,
    input: AssetAccountInput
  ): void {
    const type = normalizeAssetAccountType(input.type) ?? 'Futu'
    const sync = normalizeSyncConfig(input.sync, type)
    const holderId = data.productAccounts
      .find((account) => account.id === productAccountId)
      ?.holders.some((holder) => holder.id === input.holderId)
      ? input.holderId
      : undefined
    setData((current) => ({
      ...current,
      productAccounts: current.productAccounts.map((account) =>
        account.id === productAccountId
          ? {
              ...account,
              assetAccounts: account.assetAccounts.map((assetAccount) =>
                assetAccount.id === assetAccountId
                  ? {
                      ...assetAccount,
                      name: normalizeAssetAccountName(input.name, type),
                      type,
                      holderId,
                      sync
                    }
                  : assetAccount
              )
            }
          : account
      )
    }))
  }

  function deleteAssetAccount(productAccountId: string, assetAccountId: string): void {
    setData((current) => ({
      ...current,
      productAccounts: current.productAccounts.map((account) => {
        if (account.id !== productAccountId) return account
        const deletedPositionIds = new Set(
          account.assetAccounts
            .find((assetAccount) => assetAccount.id === assetAccountId)
            ?.positions.map((position) => position.id) ?? []
        )
        return {
          ...account,
          assetAccounts: account.assetAccounts.filter(
            (assetAccount) => assetAccount.id !== assetAccountId
          ),
          positionGroups: account.positionGroups.map((group) => ({
            ...group,
            positionIds: group.positionIds.filter(
              (positionId) => !deletedPositionIds.has(positionId)
            )
          }))
        }
      })
    }))
  }

  function savePosition(
    productAccountId: string,
    assetAccountId: string,
    input: PositionInput,
    positionId?: string
  ): string | null {
    const position = normalizePosition(input, positionId)
    const assetAccount = data.productAccounts
      .find((account) => account.id === productAccountId)
      ?.assetAccounts.find((account) => account.id === assetAccountId)
    if (!assetAccount) return '没有找到对应的资产账户'
    if (assetAccount.sync) return '自动同步账户不能手动修改持仓'
    if (positionId && !assetAccount.positions.some((item) => item.id === positionId)) {
      return '没有找到对应的持仓'
    }

    const duplicate = assetAccount.positions.some(
      (item) =>
        item.id !== position.id &&
        item.market === position.market &&
        item.symbol.toUpperCase() === position.symbol
    )
    if (duplicate) return `${marketMeta[position.market].label} ${position.symbol} 已存在`

    setData((current) => ({
      ...current,
      productAccounts: current.productAccounts.map((account) =>
        account.id === productAccountId
          ? {
              ...account,
              assetAccounts: account.assetAccounts.map((currentAssetAccount) =>
                currentAssetAccount.id === assetAccountId
                  ? {
                      ...currentAssetAccount,
                      positions: positionId
                        ? currentAssetAccount.positions.map((item) =>
                            item.id === positionId ? position : item
                          )
                        : [...currentAssetAccount.positions, position]
                    }
                  : currentAssetAccount
              )
            }
          : account
      )
    }))
    return null
  }

  function deletePosition(
    productAccountId: string,
    assetAccountId: string,
    positionId: string
  ): void {
    const assetAccount = data.productAccounts
      .find((account) => account.id === productAccountId)
      ?.assetAccounts.find((account) => account.id === assetAccountId)
    if (!assetAccount || assetAccount.sync) return
    setData((current) => ({
      ...current,
      productAccounts: current.productAccounts.map((account) =>
        account.id === productAccountId
          ? {
              ...account,
              assetAccounts: account.assetAccounts.map((assetAccount) =>
                assetAccount.id === assetAccountId && !assetAccount.sync
                  ? {
                      ...assetAccount,
                      positions: assetAccount.positions.filter(
                        (position) => position.id !== positionId
                      )
                    }
                  : assetAccount
              ),
              positionGroups: account.positionGroups.map((group) => ({
                ...group,
                positionIds: group.positionIds.filter((id) => id !== positionId)
              }))
            }
          : account
      )
    }))
  }

  function replacePositions(
    productAccountId: string,
    assetAccountId: string,
    positions: PositionInput[],
    lastSyncedAt?: string
  ): void {
    setData((current) => ({
      ...current,
      productAccounts: current.productAccounts.map((account) => {
        if (account.id !== productAccountId) return account
        const targetAccount = account.assetAccounts.find(
          (assetAccount) => assetAccount.id === assetAccountId
        )
        if (!targetAccount) return account

        const usedPositionIds = new Set<string>()
        const normalizedPositions = positions.map((input) => {
          const existing = targetAccount.positions.find(
            (position) =>
              !usedPositionIds.has(position.id) &&
              position.market === input.market &&
              position.symbol.toUpperCase() === input.symbol.trim().toUpperCase()
          )
          const position = normalizePosition(input, existing?.id)
          usedPositionIds.add(position.id)
          return position
        })
        const previousPositionIds = new Set(
          targetAccount.positions.map((position) => position.id)
        )
        const availablePositionIds = new Set(
          normalizedPositions.map((position) => position.id)
        )

        return {
          ...account,
          assetAccounts: account.assetAccounts.map((assetAccount) =>
            assetAccount.id === assetAccountId
              ? {
                  ...assetAccount,
                  positions: normalizedPositions,
                  ...(assetAccount.sync &&
                  typeof lastSyncedAt === 'string' &&
                  Number.isFinite(Date.parse(lastSyncedAt))
                    ? {
                        sync: {
                          ...assetAccount.sync,
                          lastSyncedAt
                        }
                      }
                    : {})
                }
              : assetAccount
          ),
          positionGroups: account.positionGroups.map((group) => ({
            ...group,
            positionIds: group.positionIds.filter(
              (positionId) =>
                !previousPositionIds.has(positionId) || availablePositionIds.has(positionId)
            )
          }))
        }
      })
    }))
  }

  function exportAccount(): string {
    if (!activeProductAccount) throw new Error('没有可导出的账户')
    return createAccountBackup(activeProductAccount, activeSnapshots)
  }

  function importAccount(
    input: ProductAccount,
    snapshots: PortfolioSnapshot[] = []
  ): string {
    const holderIdMap = new Map(
      input.holders.map((holder) => [holder.id, createId()] as const)
    )
    const positionIdMap = new Map(
      input.assetAccounts.flatMap((assetAccount) =>
        assetAccount.positions.map((position) => [position.id, createId()] as const)
      )
    )
    const account: ProductAccount = {
      ...input,
      id: createId(),
      holders: input.holders.map((holder) => ({
        ...holder,
        id: holderIdMap.get(holder.id)!
      })),
      assetAccounts: input.assetAccounts.map((assetAccount) => ({
        ...assetAccount,
        id: createId(),
        holderId: assetAccount.holderId
          ? holderIdMap.get(assetAccount.holderId)
          : undefined,
        positions: assetAccount.positions.map((position) => ({
          ...position,
          id: positionIdMap.get(position.id)!
        }))
      })),
      positionGroups: input.positionGroups.map((group) => ({
        ...group,
        id: createId(),
        positionIds: group.positionIds.flatMap((positionId) => {
          const importedPositionId = positionIdMap.get(positionId)
          return importedPositionId ? [importedPositionId] : []
        })
      }))
    }
    const importedSnapshots = snapshots.map((snapshot) => ({
      ...snapshot,
      id: createId(),
      productAccountId: account.id,
      account: {
        ...structuredClone(snapshot.account),
        id: account.id
      }
    }))
    setData((current) => ({
      ...current,
      activeProductAccountId: account.id,
      productAccounts: [...current.productAccounts, account],
      snapshots: [...importedSnapshots, ...current.snapshots]
    }))
    return account.id
  }

  return {
    productAccounts: data.productAccounts,
    activeProductAccount,
    activeSnapshots,
    setActiveProductAccount,
    createSnapshot,
    deleteSnapshot,
    createProductAccount,
    updateProductAccount,
    deleteProductAccount,
    createPositionGroup,
    updatePositionGroup,
    deletePositionGroup,
    setPositionGroupPositions,
    removePositionFromGroup,
    createAssetAccount,
    updateAssetAccount,
    deleteAssetAccount,
    savePosition,
    deletePosition,
    replacePositions,
    exportAccount,
    importAccount
  }
}
