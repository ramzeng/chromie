import {
  DEFAULT_EXCHANGE_RATE_PROVIDER,
  DEFAULT_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  EXCHANGE_RATE_PROVIDERS,
  MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  type ExchangeRateProvider,
  type ExchangeRateSnapshot
} from '../../shared/exchange-rates'
import {
  DEFAULT_ANCHOR_CURRENCY,
  DEFAULT_FUTU_OPEND_HOST,
  DEFAULT_FUTU_OPEND_PORT,
  DEFAULT_IBKR_GATEWAY_HOST,
  DEFAULT_IBKR_GATEWAY_PORT,
  DEFAULT_SYNC_INTERVAL,
  EMPTY_PORTFOLIO_DATA,
  marketMeta,
  type AccountBackup,
  type AnchorCurrency,
  type AppData,
  type AssetAccount,
  type AssetAccountInput,
  type AssetAccountSync,
  type AssetAccountType,
  type Market,
  type PortfolioCommand,
  type PortfolioCommandResponse,
  type PortfolioLoadResponse,
  type PortfolioSnapshot,
  type Position,
  type PositionGroup,
  type PositionGroupInput,
  type PositionInput,
  type ProductAccount,
  type ProductAccountInput,
  type ProductAccountSettingsInput
} from '../../shared/portfolio'
import {
  EMPTY_INTEGRATION_DATA,
  type AssetAccountIntegration,
  type IntegrationData
} from '../../shared/integrations'
import type { IntegrationRepository } from '../repository/integration-repository'
import type { PortfolioRepository } from '../repository/portfolio-repository'

function normalizeAssetAccountName(value: string): string {
  return value.trim()
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

function normalizeExchangeRateProvider(value: unknown): ExchangeRateProvider {
  return EXCHANGE_RATE_PROVIDERS.includes(value as ExchangeRateProvider)
    ? (value as ExchangeRateProvider)
    : DEFAULT_EXCHANGE_RATE_PROVIDER
}

function normalizeExchangeRateRefreshInterval(value: unknown): number {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES &&
    value <= MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES
    ? value
    : DEFAULT_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES
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

function normalizeIbkrGatewayHost(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_IBKR_GATEWAY_HOST
  const host = value.trim().toLowerCase().replace(/^\[|\]$/g, '')
  return host === '127.0.0.1' || host === 'localhost' || host === '::1'
    ? host
    : DEFAULT_IBKR_GATEWAY_HOST
}

function normalizeIbkrGatewayPort(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535
    ? value
    : DEFAULT_IBKR_GATEWAY_PORT
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
  if (type === 'ibkr') return 'Ibkr'
  if (type === 'binance') return 'Binance'
  if (type === 'alipay') return 'Alipay'
  if (type === 'general') return 'General'
  if (type === 'cmb') return 'Cmb'
  if (type === 'boc') return 'Boc'
  return null
}

function normalizeAssetAccountSync(
  value: unknown,
  type: AssetAccountType
): AssetAccountSync | undefined {
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

function normalizeIntegration(
  value: unknown,
  assetAccountId?: string
): AssetAccountIntegration | null {
  if (!value || typeof value !== 'object') return null
  const integration = value as {
    assetAccountId?: unknown
    provider?: unknown
    websocket?: unknown
    gateway?: unknown
    api?: unknown
  }
  const normalizedAssetAccountId =
    assetAccountId ??
    (typeof integration.assetAccountId === 'string'
      ? integration.assetAccountId.trim()
      : '')
  if (!normalizedAssetAccountId) return null

  if (integration.provider === 'Futu') {
    if (!integration.websocket || typeof integration.websocket !== 'object') return null
    const websocket = integration.websocket as {
      host?: unknown
      port?: unknown
      key?: unknown
    }
    return {
      assetAccountId: normalizedAssetAccountId,
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
      assetAccountId: normalizedAssetAccountId,
      provider: 'Ibkr',
      gateway: {
        host: normalizeIbkrGatewayHost(gateway.host),
        port: normalizeIbkrGatewayPort(gateway.port)
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
      (integration.provider === 'Okx' &&
        (typeof api.passphrase !== 'string' || !api.passphrase))
    ) {
      return null
    }
    if (integration.provider === 'Okx') {
      return {
        assetAccountId: normalizedAssetAccountId,
        provider: 'Okx',
        api: {
          apiKey: api.apiKey.trim().slice(0, 256),
          secretKey: api.secretKey.slice(0, 512),
          passphrase: (api.passphrase as string).slice(0, 256)
        }
      }
    }
    return {
      assetAccountId: normalizedAssetAccountId,
      provider: 'Binance',
      api: {
        apiKey: api.apiKey.trim().slice(0, 256),
        secretKey: api.secretKey.slice(0, 512)
      }
    }
  }

  return null
}

function normalizeStoredIntegrationData(input: unknown): IntegrationData | null {
  if (!input || typeof input !== 'object') return null
  const value = input as { version?: unknown; integrations?: unknown }
  if (value.version !== 1 || !Array.isArray(value.integrations)) return null

  const usedAssetAccountIds = new Set<string>()
  const integrations = value.integrations.flatMap((integration) => {
    const normalized = normalizeIntegration(integration)
    if (!normalized || usedAssetAccountIds.has(normalized.assetAccountId)) return []
    usedAssetAccountIds.add(normalized.assetAccountId)
    return [normalized]
  })
  return { version: 1, integrations }
}

function parseStoredIntegrationData(raw: string): IntegrationData | null {
  try {
    return normalizeStoredIntegrationData(JSON.parse(raw))
  } catch {
    return null
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
    value.version !== 1 ||
    !Array.isArray(value.productAccounts) ||
    !Array.isArray(value.snapshots)
  ) {
    return null
  }

  const productAccounts = value.productAccounts.flatMap((account) => {
      if (!account || typeof account !== 'object') return []
      const storedAccount = account as {
        id?: unknown
        name?: unknown
        anchorCurrency?: unknown
        exchangeRateProvider?: unknown
        exchangeRateRefreshIntervalMinutes?: unknown
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
          typeof storedAssetAccount.holderId !== 'string' ||
          !usedHolderIds.has(storedAssetAccount.holderId) ||
          !Array.isArray(storedAssetAccount.positions)
        ) {
          return []
        }
        const sync = normalizeAssetAccountSync(storedAssetAccount.sync, type)
        return [
          {
            id: storedAssetAccount.id,
            name: normalizeAssetAccountName(storedAssetAccount.name),
            type,
            holderId: storedAssetAccount.holderId,
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
          exchangeRateProvider: normalizeExchangeRateProvider(
            storedAccount.exchangeRateProvider
          ),
          exchangeRateRefreshIntervalMinutes: normalizeExchangeRateRefreshInterval(
            storedAccount.exchangeRateRefreshIntervalMinutes
          ),
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
  const snapshots = value.snapshots.flatMap((snapshot) => {
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
          productAccounts: [storedSnapshot.account],
          snapshots: []
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

  snapshots.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
  return { version: 1, activeProductAccountId, productAccounts, snapshots }
}

function parseStoredData(raw: string): AppData | null {
  try {
    return normalizeStoredData(JSON.parse(raw))
  } catch {
    return null
  }
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
  const sync = value as Partial<AssetAccountSync>
  const hasValidLastSyncedAt =
    sync.lastSyncedAt === undefined ||
    (typeof sync.lastSyncedAt === 'string' &&
      Number.isFinite(Date.parse(sync.lastSyncedAt)))
  return (
    Number.isInteger(sync.interval) &&
    sync.interval !== undefined &&
    sync.interval >= 5 &&
    sync.interval <= 3600 &&
    hasValidLastSyncedAt
  )
}

function stripIntegrationFields(account: ProductAccount): ProductAccount {
  return {
    ...structuredClone(account),
    assetAccounts: account.assetAccounts.map((assetAccount) => ({
      id: assetAccount.id,
      name: assetAccount.name,
      type: assetAccount.type,
      holderId: assetAccount.holderId,
      ...(assetAccount.sync ? { sync: structuredClone(assetAccount.sync) } : {}),
      positions: structuredClone(assetAccount.positions)
    }))
  }
}

function sanitizeSnapshot(snapshot: PortfolioSnapshot): PortfolioSnapshot {
  return {
    ...structuredClone(snapshot),
    account: stripIntegrationFields(snapshot.account)
  }
}

function sanitizeAccountBackup(
  account: ProductAccount,
  snapshots: PortfolioSnapshot[]
): AccountBackup {
  return {
    account: stripIntegrationFields(account),
    snapshots: snapshots.map(sanitizeSnapshot)
  }
}

function reconcileIntegrations(
  data: AppData,
  integrationData: IntegrationData
): { data: AppData; integrationData: IntegrationData } {
  const accountTypes = new Map(
    data.productAccounts.flatMap((productAccount) =>
      productAccount.assetAccounts.map(
        (assetAccount) => [assetAccount.id, assetAccount.type] as const
      )
    )
  )
  const integrations = integrationData.integrations.filter(
    (integration) => accountTypes.get(integration.assetAccountId) === integration.provider
  )
  const integratedAccountIds = new Set(
    integrations.map((integration) => integration.assetAccountId)
  )
  return {
    data: {
      ...data,
      productAccounts: data.productAccounts.map((productAccount) => ({
        ...productAccount,
        assetAccounts: productAccount.assetAccounts.map((assetAccount) => {
          if (integratedAccountIds.has(assetAccount.id)) {
            return assetAccount.sync
              ? assetAccount
              : {
                  ...assetAccount,
                  sync: { interval: DEFAULT_SYNC_INTERVAL }
                }
          }
          return assetAccount.sync
            ? { ...assetAccount, sync: undefined }
            : assetAccount
        })
      }))
    },
    integrationData: { version: 1, integrations }
  }
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
    (account.exchangeRateProvider !== undefined &&
      !EXCHANGE_RATE_PROVIDERS.includes(account.exchangeRateProvider)) ||
    (account.exchangeRateRefreshIntervalMinutes !== undefined &&
      (typeof account.exchangeRateRefreshIntervalMinutes !== 'number' ||
        !Number.isInteger(account.exchangeRateRefreshIntervalMinutes) ||
        account.exchangeRateRefreshIntervalMinutes <
          MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES ||
        account.exchangeRateRefreshIntervalMinutes >
          MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES)) ||
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
      typeof assetAccount.holderId !== 'string' ||
      !holderIds.has(assetAccount.holderId) ||
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
  const backup = sanitizeAccountBackup(account, snapshots)
  return JSON.stringify(
    {
      format: 'chromie-account',
      version: 1,
      exportedAt: new Date().toISOString(),
      ...backup
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
      backup.version !== 1 ||
      typeof backup.exportedAt !== 'string' ||
      !Number.isFinite(Date.parse(backup.exportedAt)) ||
      !isValidBackupAccount(backup.account)
    ) {
      return null
    }
    const account = backup.account as ProductAccount
    const usedSnapshotIds = new Set<string>()
    const rawSnapshots = backup.snapshots
    if (
      !Array.isArray(rawSnapshots) ||
      !rawSnapshots.every((snapshot) =>
        isValidBackupSnapshot(snapshot, account.id, usedSnapshotIds)
      )
    ) {
      return null
    }
    const normalized = normalizeStoredData({
      version: 1,
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

type PortfolioDataUpdater = (
  update: AppData | ((current: AppData) => AppData)
) => void
type IntegrationDataUpdater = (
  update: IntegrationData | ((current: IntegrationData) => IntegrationData)
) => void

function createPortfolioOperations(
  data: AppData,
  setData: PortfolioDataUpdater,
  setIntegrationData: IntegrationDataUpdater
) {
  const activeProductAccount =
    data.productAccounts.find((account) => account.id === data.activeProductAccountId) ?? null
  const activeSnapshots = activeProductAccount
    ? data.snapshots.filter(
        (snapshot) => snapshot.productAccountId === activeProductAccount.id
      )
    : []

  function setAssetAccountIntegration(
    assetAccountId: string,
    integration: AssetAccountIntegration | null
  ): void {
    setIntegrationData((current) => ({
      ...current,
      integrations: integration
        ? [
            ...current.integrations.filter(
              (item) => item.assetAccountId !== assetAccountId
            ),
            integration
          ]
        : current.integrations.filter(
            (item) => item.assetAccountId !== assetAccountId
          )
    }))
  }

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
      exchangeRateProvider: DEFAULT_EXCHANGE_RATE_PROVIDER,
      exchangeRateRefreshIntervalMinutes:
        DEFAULT_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
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
    const account = data.productAccounts.find((item) => item.id === id)
    if (
      account?.assetAccounts.some(
        (assetAccount) => !usedHolderIds.has(assetAccount.holderId)
      )
    ) {
      throw new Error('仍有资产账户属于被删除的持有人')
    }
    setData((current) => ({
      ...current,
      productAccounts: current.productAccounts.map((account) =>
        account.id === id
          ? {
              ...account,
              name: input.name.trim(),
              anchorCurrency: normalizeAnchorCurrency(input.anchorCurrency),
              exchangeRateProvider: normalizeExchangeRateProvider(
                input.exchangeRateProvider
              ),
              exchangeRateRefreshIntervalMinutes:
                normalizeExchangeRateRefreshInterval(
                  input.exchangeRateRefreshIntervalMinutes
                ),
              holders
            }
          : account
      )
    }))
  }

  function deleteProductAccount(id: string): void {
    const deletedAssetAccountIds = new Set(
      data.productAccounts
        .find((account) => account.id === id)
        ?.assetAccounts.map((assetAccount) => assetAccount.id) ?? []
    )
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
    setIntegrationData((current) => ({
      ...current,
      integrations: current.integrations.filter(
        (integration) => !deletedAssetAccountIds.has(integration.assetAccountId)
      )
    }))
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
    const productAccount = data.productAccounts.find(
      (account) => account.id === productAccountId
    )
    if (!productAccount) throw new Error('没有找到对应的账户')
    if (!productAccount.holders.some((holder) => holder.id === input.holderId)) {
      throw new Error('请选择有效的持有人')
    }
    const assetAccountId = createId()
    const integration = input.integration
      ? normalizeIntegration(input.integration, assetAccountId)
      : null
    if (input.integration && (!integration || integration.provider !== type)) {
      throw new Error('同步配置与资产账户类型不匹配')
    }
    const sync = integration
      ? (normalizeAssetAccountSync(input.sync, type) ?? {
          interval: DEFAULT_SYNC_INTERVAL
        })
      : undefined
    const assetAccount: AssetAccount = {
      id: assetAccountId,
      name: normalizeAssetAccountName(input.name),
      type,
      holderId: input.holderId,
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
    setAssetAccountIntegration(assetAccount.id, integration)
    return assetAccount.id
  }

  function updateAssetAccount(
    productAccountId: string,
    assetAccountId: string,
    input: AssetAccountInput
  ): void {
    const type = normalizeAssetAccountType(input.type) ?? 'Futu'
    const productAccount = data.productAccounts.find(
      (account) => account.id === productAccountId
    )
    if (!productAccount) throw new Error('没有找到对应的账户')
    if (!productAccount.assetAccounts.some((account) => account.id === assetAccountId)) {
      throw new Error('没有找到对应的资产账户')
    }
    if (!productAccount.holders.some((holder) => holder.id === input.holderId)) {
      throw new Error('请选择有效的持有人')
    }
    const integration = input.integration
      ? normalizeIntegration(input.integration, assetAccountId)
      : null
    if (input.integration && (!integration || integration.provider !== type)) {
      throw new Error('同步配置与资产账户类型不匹配')
    }
    const sync = integration
      ? (normalizeAssetAccountSync(input.sync, type) ?? {
          interval: DEFAULT_SYNC_INTERVAL
        })
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
                      name: normalizeAssetAccountName(input.name),
                      type,
                      holderId: input.holderId,
                      sync
                    }
                  : assetAccount
              )
            }
          : account
      )
    }))
    setAssetAccountIntegration(assetAccountId, integration)
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
    setAssetAccountIntegration(assetAccountId, null)
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
              position.symbol.toUpperCase() === input.symbol.trim().toUpperCase() &&
              position.currency.toUpperCase() === input.currency.trim().toUpperCase()
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
        holderId: holderIdMap.get(assetAccount.holderId)!,
        sync: undefined,
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

export interface PortfolioOperations {
  load(): Promise<PortfolioLoadResponse>
  execute(
    command: PortfolioCommand,
    options?: PortfolioExecuteOptions
  ): Promise<PortfolioCommandResponse>
  inspectBackup(content: unknown): AccountBackup | null
  exportActiveAccount(): Promise<string>
  subscribe(listener: PortfolioChangeListener): () => void
}

export type PortfolioExecuteOptions = {
  expectedRevision?: string
}

export type PortfolioChangeListener = (revision: string) => void

export class PortfolioRevisionConflictError extends Error {
  constructor(
    readonly expectedRevision: string,
    readonly actualRevision: string
  ) {
    super('资产数据已发生变化，请重新读取后再试')
    this.name = 'PortfolioRevisionConflictError'
  }
}

export class PortfolioService implements PortfolioOperations {
  private data: AppData = structuredClone(EMPTY_PORTFOLIO_DATA)
  private integrationData: IntegrationData = structuredClone(EMPTY_INTEGRATION_DATA)
  private initialized = false
  private pending: Promise<void> = Promise.resolve()
  private readonly revisionEpoch = crypto.randomUUID()
  private revisionCounter = 0
  private readonly listeners = new Set<PortfolioChangeListener>()

  constructor(
    private readonly repository: PortfolioRepository,
    private readonly integrationRepository: IntegrationRepository
  ) {}

  load(): Promise<PortfolioLoadResponse> {
    return this.runExclusive(async () => {
      if (this.initialized) {
        return {
          revision: this.currentRevision(),
          data: structuredClone(this.data),
          integrations: structuredClone(this.integrationData.integrations)
        }
      }

      const [storedContent, storedIntegrationContent] = await Promise.all([
        this.repository.load(),
        this.integrationRepository.load()
      ])
      const storedData = storedContent ? parseStoredData(storedContent) : null
      const storedIntegrationData = storedIntegrationContent
        ? parseStoredIntegrationData(storedIntegrationContent)
        : null
      const reconciled = reconcileIntegrations(
        structuredClone(storedData ?? EMPTY_PORTFOLIO_DATA),
        structuredClone(storedIntegrationData ?? EMPTY_INTEGRATION_DATA)
      )
      this.data = reconciled.data
      this.integrationData = reconciled.integrationData
      this.initialized = true

      return {
        revision: this.currentRevision(),
        data: structuredClone(this.data),
        integrations: structuredClone(this.integrationData.integrations)
      }
    })
  }

  execute(
    command: PortfolioCommand,
    options: PortfolioExecuteOptions = {}
  ): Promise<PortfolioCommandResponse> {
    return this.runExclusive(async () => {
      await this.initialize()
      const currentRevision = this.currentRevision()
      if (
        options.expectedRevision !== undefined &&
        options.expectedRevision !== currentRevision
      ) {
        throw new PortfolioRevisionConflictError(
          options.expectedRevision,
          currentRevision
        )
      }
      let nextData = this.data
      let nextIntegrationData = this.integrationData
      const operations = createPortfolioOperations(
        this.data,
        (update) => {
          nextData = typeof update === 'function' ? update(nextData) : update
        },
        (update) => {
          nextIntegrationData =
            typeof update === 'function' ? update(nextIntegrationData) : update
        }
      )
      let result: string | null | undefined

      switch (command.type) {
        case 'set-active-product-account':
          operations.setActiveProductAccount(command.id)
          break
        case 'create-snapshot':
          result = operations.createSnapshot(
            command.productAccountId,
            command.exchangeRates
          )
          break
        case 'delete-snapshot':
          operations.deleteSnapshot(command.snapshotId)
          break
        case 'create-product-account':
          result = operations.createProductAccount(command.input)
          break
        case 'update-product-account':
          operations.updateProductAccount(command.id, command.input)
          break
        case 'delete-product-account':
          operations.deleteProductAccount(command.id)
          break
        case 'create-position-group':
          result = operations.createPositionGroup(
            command.productAccountId,
            command.input
          )
          break
        case 'update-position-group':
          operations.updatePositionGroup(
            command.productAccountId,
            command.groupId,
            command.input
          )
          break
        case 'delete-position-group':
          operations.deletePositionGroup(command.productAccountId, command.groupId)
          break
        case 'set-position-group-positions':
          result = operations.setPositionGroupPositions(
            command.productAccountId,
            command.groupId,
            command.positionIds
          )
          break
        case 'remove-position-from-group':
          operations.removePositionFromGroup(
            command.productAccountId,
            command.groupId,
            command.positionId
          )
          break
        case 'create-asset-account':
          result = operations.createAssetAccount(
            command.productAccountId,
            command.input
          )
          break
        case 'update-asset-account':
          operations.updateAssetAccount(
            command.productAccountId,
            command.assetAccountId,
            command.input
          )
          break
        case 'delete-asset-account':
          operations.deleteAssetAccount(
            command.productAccountId,
            command.assetAccountId
          )
          break
        case 'save-position':
          result = operations.savePosition(
            command.productAccountId,
            command.assetAccountId,
            command.input,
            command.positionId
          )
          break
        case 'delete-position':
          operations.deletePosition(
            command.productAccountId,
            command.assetAccountId,
            command.positionId
          )
          break
        case 'replace-positions':
          operations.replacePositions(
            command.productAccountId,
            command.assetAccountId,
            command.positions,
            command.lastSyncedAt
          )
          break
        case 'import-account':
          result = operations.importAccount(command.account, command.snapshots)
          break
        default:
          throw new Error('不支持的资产命令')
      }

      if (
        typeof result === 'string' &&
        (command.type === 'save-position' ||
          command.type === 'set-position-group-positions')
      ) {
        return {
          revision: currentRevision,
          data: structuredClone(this.data),
          integrations: structuredClone(this.integrationData.integrations),
          result
        }
      }

      await this.persist(nextData, nextIntegrationData)
      this.data = nextData
      this.integrationData = nextIntegrationData
      this.revisionCounter += 1
      const revision = this.currentRevision()
      this.listeners.forEach((listener) => {
        try {
          listener(revision)
        } catch {
          // A transport listener must not break a committed portfolio update.
        }
      })
      return {
        revision,
        data: structuredClone(this.data),
        integrations: structuredClone(this.integrationData.integrations),
        ...(result === undefined ? {} : { result })
      }
    })
  }

  inspectBackup(content: unknown): AccountBackup | null {
    return typeof content === 'string' ? parseAccountBackup(content) : null
  }

  async exportActiveAccount(): Promise<string> {
    return this.runExclusive(async () => {
      await this.initialize()
      const account = this.data.productAccounts.find(
        (item) => item.id === this.data.activeProductAccountId
      )
      if (!account) throw new Error('没有可导出的账户')
      return createAccountBackup(
        account,
        this.data.snapshots.filter(
          (snapshot) => snapshot.productAccountId === account.id
        )
      )
    })
  }

  subscribe(listener: PortfolioChangeListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return
    const [storedContent, storedIntegrationContent] = await Promise.all([
      this.repository.load(),
      this.integrationRepository.load()
    ])
    const reconciled = reconcileIntegrations(
      structuredClone(
        storedContent
          ? (parseStoredData(storedContent) ?? EMPTY_PORTFOLIO_DATA)
          : EMPTY_PORTFOLIO_DATA
      ),
      structuredClone(
        storedIntegrationContent
          ? (parseStoredIntegrationData(storedIntegrationContent) ??
              EMPTY_INTEGRATION_DATA)
          : EMPTY_INTEGRATION_DATA
      )
    )
    this.data = reconciled.data
    this.integrationData = reconciled.integrationData
    this.initialized = true
  }

  private async persist(
    data: AppData,
    integrationData: IntegrationData
  ): Promise<void> {
    await this.repository.save(JSON.stringify(data))
    await this.integrationRepository.save(JSON.stringify(integrationData))
  }

  private currentRevision(): string {
    return `${this.revisionEpoch}:${this.revisionCounter}`
  }

  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pending.then(operation, operation)
    this.pending = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }
}
