import {
  DEFAULT_EXCHANGE_RATE_PROVIDER,
  DEFAULT_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  EXCHANGE_RATE_PROVIDERS,
  isExchangeRateCurrency,
  MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  type ExchangeRateProvider,
  type ExchangeRateSnapshot
} from '../../shared/exchange-rates'
import {
  DEFAULT_BASE_CURRENCY,
  DEFAULT_FUTU_OPEND_HOST,
  DEFAULT_FUTU_OPEND_PORT,
  DEFAULT_HSTONG_GATEWAY_HOST,
  DEFAULT_HSTONG_GATEWAY_PORT,
  DEFAULT_IBKR_GATEWAY_HOST,
  DEFAULT_IBKR_GATEWAY_PORT,
  DEFAULT_SYNC_INTERVAL,
  EMPTY_PORTFOLIO_DATA,
  marketMeta,
  type WorkspaceBackup,
  type AccountGroup,
  type AccountGroupInput,
  type BaseCurrency,
  type AppData,
  type AssetAccount,
  type AssetAccountInput,
  type AssetAccountSync,
  type AssetAccountType,
  type Market,
  type PortfolioCommand,
  type PortfolioCommandResponse,
  type PortfolioLoadResponse,
  type WorkspaceSnapshot,
  type Position,
  type PositionGroup,
  type PositionGroupInput,
  type PositionInput,
  type Workspace,
  type WorkspaceInput,
  type WorkspaceSettingsInput
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

function normalizeBaseCurrency(value: unknown): BaseCurrency {
  if (!isCurrencyCode(value)) return DEFAULT_BASE_CURRENCY
  const currency = value.trim().toUpperCase()
  return currency === 'CNY' || currency === 'HKD' || currency === 'USD'
    ? currency
    : DEFAULT_BASE_CURRENCY
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

function normalizeHstongGatewayHost(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_HSTONG_GATEWAY_HOST
  const host = value.trim().toLowerCase().replace(/^\[|\]$/g, '')
  return host === '127.0.0.1' || host === 'localhost' || host === '::1'
    ? host
    : DEFAULT_HSTONG_GATEWAY_HOST
}

function normalizeHstongGatewayPort(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535
    ? value
    : DEFAULT_HSTONG_GATEWAY_PORT
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
  if (type === 'hstong') return 'Hstong'
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

  if (integration.provider === 'Hstong') {
    if (!integration.gateway || typeof integration.gateway !== 'object') return null
    const gateway = integration.gateway as {
      host?: unknown
      port?: unknown
      tradingPassword?: unknown
    }
    return {
      assetAccountId: normalizedAssetAccountId,
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

function resolveIntegrationInput(
  input: AssetAccountInput['integration'],
  assetAccountId: string,
  existing?: AssetAccountIntegration
): AssetAccountIntegration | null {
  if (!input) return null

  if (input.provider === 'Ibkr') {
    return normalizeIntegration(input, assetAccountId)
  }

  if (input.provider === 'Futu') {
    const credential = input.websocket.credential
    if (credential.mode === 'keep' && existing?.provider !== 'Futu') {
      throw new Error('没有可保留的 Futu OpenD 密钥，请重新填写')
    }
    const key = credential.mode === 'keep'
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
      assetAccountId
    )
  }

  if (input.provider === 'Hstong') {
    const credential = input.gateway.credential
    if (credential.mode === 'keep' && existing?.provider !== 'Hstong') {
      throw new Error('没有可保留的华盛交易密码，请重新填写')
    }
    const tradingPassword = credential.mode === 'keep'
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
      assetAccountId
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
    assetAccountId
  )
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
      isExchangeRateCurrency(currency) &&
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
    activeWorkspaceId?: unknown
    workspaces?: unknown
    snapshots?: unknown
  }
  if (
    value.version !== 1 ||
    !Array.isArray(value.workspaces) ||
    !Array.isArray(value.snapshots)
  ) {
    return null
  }

  const workspaces = value.workspaces.flatMap((workspace) => {
      if (!workspace || typeof workspace !== 'object') return []
      const storedWorkspace = workspace as {
        id?: unknown
        name?: unknown
        baseCurrency?: unknown
        exchangeRateProvider?: unknown
        exchangeRateRefreshIntervalMinutes?: unknown
        accountGroups?: unknown
        assetAccounts?: unknown
        positionGroups?: unknown
      }
      if (
        typeof storedWorkspace.id !== 'string' ||
        typeof storedWorkspace.name !== 'string' ||
        !Array.isArray(storedWorkspace.accountGroups) ||
        !Array.isArray(storedWorkspace.assetAccounts) ||
        !Array.isArray(storedWorkspace.positionGroups)
      ) {
        return []
      }
      const usedPositionIds = new Set<string>()
      const assetAccounts = storedWorkspace.assetAccounts.flatMap((assetAccount) => {
        if (!assetAccount || typeof assetAccount !== 'object') return []
        const storedAssetAccount = assetAccount as {
          id?: unknown
          name?: unknown
          type?: unknown
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
        const sync = normalizeAssetAccountSync(storedAssetAccount.sync, type)
        return [
          {
            id: storedAssetAccount.id,
            name: normalizeAssetAccountName(storedAssetAccount.name),
            type,
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
      const availableAssetAccountIds = new Set(
        assetAccounts.map((assetAccount) => assetAccount.id)
      )
      const usedAccountGroupIds = new Set<string>()
      const assignedAssetAccountIds = new Set<string>()
      const accountGroups = storedWorkspace.accountGroups.flatMap((accountGroup) => {
            if (!accountGroup || typeof accountGroup !== 'object') return []
            const storedAccountGroup = accountGroup as {
              id?: unknown
              name?: unknown
              assetAccountIds?: unknown
            }
            if (
              typeof storedAccountGroup.id !== 'string' ||
              !storedAccountGroup.id.trim() ||
              usedAccountGroupIds.has(storedAccountGroup.id) ||
              typeof storedAccountGroup.name !== 'string' ||
              !storedAccountGroup.name.trim() ||
              !Array.isArray(storedAccountGroup.assetAccountIds)
            ) {
              return []
            }
            const seenAssetAccountIds = new Set<string>()
            const assetAccountIds = storedAccountGroup.assetAccountIds.flatMap(
              (assetAccountId) => {
                if (
                  typeof assetAccountId !== 'string' ||
                  !availableAssetAccountIds.has(assetAccountId) ||
                  assignedAssetAccountIds.has(assetAccountId) ||
                  seenAssetAccountIds.has(assetAccountId)
                ) {
                  return []
                }
                seenAssetAccountIds.add(assetAccountId)
                assignedAssetAccountIds.add(assetAccountId)
                return [assetAccountId]
              }
            )
            usedAccountGroupIds.add(storedAccountGroup.id)
            return [{
              id: storedAccountGroup.id,
              name: storedAccountGroup.name.trim(),
              assetAccountIds
            }]
          })
      const accountGroupsAreStrict =
        accountGroups.length === storedWorkspace.accountGroups.length &&
        storedWorkspace.accountGroups.every((accountGroup) => {
          if (!accountGroup || typeof accountGroup !== 'object') return false
          const storedAccountGroup = accountGroup as {
            id?: unknown
            assetAccountIds?: unknown
          }
          if (
            typeof storedAccountGroup.id !== 'string' ||
            !Array.isArray(storedAccountGroup.assetAccountIds)
          ) {
            return false
          }
          return accountGroups.find((group) => group.id === storedAccountGroup.id)
            ?.assetAccountIds.length === storedAccountGroup.assetAccountIds.length
        })
      if (!accountGroupsAreStrict) return []
      const availablePositionIds = new Set(
        assetAccounts.flatMap((assetAccount) =>
          assetAccount.positions.map((position) => position.id)
        )
      )
      const assignedPositionIds = new Set<string>()
      const positionGroups = storedWorkspace.positionGroups.flatMap((group) => {
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
      return [
        {
          id: storedWorkspace.id,
          name: storedWorkspace.name,
          baseCurrency: normalizeBaseCurrency(storedWorkspace.baseCurrency),
          exchangeRateProvider: normalizeExchangeRateProvider(
            storedWorkspace.exchangeRateProvider
          ),
          exchangeRateRefreshIntervalMinutes: normalizeExchangeRateRefreshInterval(
            storedWorkspace.exchangeRateRefreshIntervalMinutes
          ),
          accountGroups,
          assetAccounts,
          positionGroups
        }
      ]
  })
  const activeWorkspaceId = workspaces.some(
    (workspace) => workspace.id === value.activeWorkspaceId
  )
    ? (value.activeWorkspaceId as string)
    : (workspaces[0]?.id ?? null)

  const workspaceIds = new Set(workspaces.map((workspace) => workspace.id))
  const usedSnapshotIds = new Set<string>()
  const snapshots = value.snapshots.flatMap((snapshot) => {
        if (!snapshot || typeof snapshot !== 'object') return []
        const storedSnapshot = snapshot as {
          id?: unknown
          workspaceId?: unknown
          createdAt?: unknown
          workspace?: unknown
          exchangeRates?: unknown
        }
        if (
          typeof storedSnapshot.id !== 'string' ||
          !storedSnapshot.id.trim() ||
          usedSnapshotIds.has(storedSnapshot.id) ||
          typeof storedSnapshot.workspaceId !== 'string' ||
          !workspaceIds.has(storedSnapshot.workspaceId) ||
          typeof storedSnapshot.createdAt !== 'string' ||
          !Number.isFinite(Date.parse(storedSnapshot.createdAt))
        ) {
          return []
        }
        const normalizedWorkspaceData = normalizeStoredData({
          version: 1,
          activeWorkspaceId: storedSnapshot.workspaceId,
          workspaces: [storedSnapshot.workspace],
          snapshots: []
        })
        const workspace = normalizedWorkspaceData?.workspaces[0]
        if (!workspace || workspace.id !== storedSnapshot.workspaceId) return []
        const exchangeRates = normalizeStoredExchangeRates(storedSnapshot.exchangeRates)
        usedSnapshotIds.add(storedSnapshot.id)
        return [{
          id: storedSnapshot.id,
          workspaceId: storedSnapshot.workspaceId,
          createdAt: storedSnapshot.createdAt,
          workspace,
          ...(exchangeRates ? { exchangeRates } : {})
        }]
      })

  snapshots.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
  return { version: 1, activeWorkspaceId, workspaces, snapshots }
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

function stripIntegrationFields(workspace: Workspace): Workspace {
  return {
    ...structuredClone(workspace),
    assetAccounts: workspace.assetAccounts.map((assetAccount) => ({
      id: assetAccount.id,
      name: assetAccount.name,
      type: assetAccount.type,
      ...(assetAccount.sync ? { sync: structuredClone(assetAccount.sync) } : {}),
      positions: structuredClone(assetAccount.positions)
    }))
  }
}

function sanitizeSnapshot(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  return {
    ...structuredClone(snapshot),
    workspace: stripIntegrationFields(snapshot.workspace)
  }
}

function sanitizeWorkspaceBackup(
  workspace: Workspace,
  snapshots: WorkspaceSnapshot[]
): WorkspaceBackup {
  return {
    workspace: stripIntegrationFields(workspace),
    snapshots: snapshots.map(sanitizeSnapshot)
  }
}

function reconcileIntegrations(
  data: AppData,
  integrationData: IntegrationData
): { data: AppData; integrationData: IntegrationData } {
  const accountTypes = new Map(
    data.workspaces.flatMap((workspace) =>
      workspace.assetAccounts.map(
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
      workspaces: data.workspaces.map((workspace) => ({
        ...workspace,
        assetAccounts: workspace.assetAccounts.map((assetAccount) => {
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

function isValidBackupWorkspace(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const workspace = value as Partial<Workspace>
  if (
    typeof workspace.id !== 'string' ||
    !workspace.id ||
    typeof workspace.name !== 'string' ||
    !workspace.name.trim() ||
    (workspace.baseCurrency !== undefined &&
      !isCurrencyCode(workspace.baseCurrency)) ||
    (workspace.exchangeRateProvider !== undefined &&
      !EXCHANGE_RATE_PROVIDERS.includes(workspace.exchangeRateProvider)) ||
    (workspace.exchangeRateRefreshIntervalMinutes !== undefined &&
      (typeof workspace.exchangeRateRefreshIntervalMinutes !== 'number' ||
        !Number.isInteger(workspace.exchangeRateRefreshIntervalMinutes) ||
        workspace.exchangeRateRefreshIntervalMinutes <
          MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES ||
        workspace.exchangeRateRefreshIntervalMinutes >
          MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES)) ||
    !Array.isArray(workspace.accountGroups) ||
    !Array.isArray(workspace.assetAccounts)
  ) {
    return false
  }

  const assetAccountIds = new Set<string>()
  const positionIds = new Set<string>()
  const validAssetAccounts = workspace.assetAccounts.every((assetAccount) => {
    const type = normalizeAssetAccountType(assetAccount?.type)
    if (
      !assetAccount ||
      typeof assetAccount.id !== 'string' ||
      !assetAccount.id ||
      assetAccountIds.has(assetAccount.id) ||
      typeof assetAccount.name !== 'string' ||
      !assetAccount.name.trim() ||
      !type ||
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

  const accountGroupIds = new Set<string>()
  const assignedAssetAccountIds = new Set<string>()
  const validAccountGroups = workspace.accountGroups.every((accountGroup) => {
    if (
      !accountGroup ||
      typeof accountGroup.id !== 'string' ||
      !accountGroup.id.trim() ||
      accountGroupIds.has(accountGroup.id) ||
      typeof accountGroup.name !== 'string' ||
      !accountGroup.name.trim() ||
      !Array.isArray(accountGroup.assetAccountIds)
    ) {
      return false
    }
    accountGroupIds.add(accountGroup.id)
    const seenAssetAccountIds = new Set<string>()
    return accountGroup.assetAccountIds.every((assetAccountId) => {
      if (
        typeof assetAccountId !== 'string' ||
        !assetAccountIds.has(assetAccountId) ||
        assignedAssetAccountIds.has(assetAccountId) ||
        seenAssetAccountIds.has(assetAccountId)
      ) {
        return false
      }
      seenAssetAccountIds.add(assetAccountId)
      assignedAssetAccountIds.add(assetAccountId)
      return true
    })
  })
  if (!validAccountGroups) return false

  if (!Array.isArray(workspace.positionGroups)) return false

  const groupIds = new Set<string>()
  const assignedPositionIds = new Set<string>()
  return workspace.positionGroups.every((group) => {
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
  workspaceId: string,
  usedIds: Set<string>
): value is WorkspaceSnapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as Partial<WorkspaceSnapshot>
  const snapshotWorkspace = snapshot.workspace
  if (
    typeof snapshot.id !== 'string' ||
    !snapshot.id.trim() ||
    usedIds.has(snapshot.id) ||
    snapshot.workspaceId !== workspaceId ||
    typeof snapshot.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(snapshot.createdAt)) ||
    !isValidBackupWorkspace(snapshotWorkspace) ||
    (snapshotWorkspace as Workspace).id !== workspaceId ||
    (snapshot.exchangeRates !== undefined &&
      !normalizeStoredExchangeRates(snapshot.exchangeRates))
  ) {
    return false
  }
  usedIds.add(snapshot.id)
  return true
}

export function createWorkspaceBackup(
  workspace: Workspace,
  snapshots: WorkspaceSnapshot[] = []
): string {
  const backup = sanitizeWorkspaceBackup(workspace, snapshots)
  return JSON.stringify(
    {
      format: 'chromie-workspace',
      version: 1,
      exportedAt: new Date().toISOString(),
      ...backup
    },
    null,
    2
  )
}

export function parseWorkspaceBackup(raw: string): WorkspaceBackup | null {
  try {
    const backup = JSON.parse(raw) as {
      format?: unknown
      version?: unknown
      exportedAt?: unknown
      workspace?: unknown
      snapshots?: unknown
    }
    if (
      backup.format !== 'chromie-workspace' ||
      backup.version !== 1 ||
      typeof backup.exportedAt !== 'string' ||
      !Number.isFinite(Date.parse(backup.exportedAt)) ||
      !isValidBackupWorkspace(backup.workspace)
    ) {
      return null
    }
    const workspace = backup.workspace as Workspace
    const usedSnapshotIds = new Set<string>()
    const rawSnapshots = backup.snapshots
    if (
      !Array.isArray(rawSnapshots) ||
      !rawSnapshots.every((snapshot) =>
        isValidBackupSnapshot(snapshot, workspace.id, usedSnapshotIds)
      )
    ) {
      return null
    }
    const normalized = normalizeStoredData({
      version: 1,
      activeWorkspaceId: workspace.id,
      workspaces: [workspace],
      snapshots: rawSnapshots
    })
    const normalizedWorkspace = normalized?.workspaces[0]
    if (!normalizedWorkspace || normalized.snapshots.length !== rawSnapshots.length) return null
    return { workspace: normalizedWorkspace, snapshots: normalized.snapshots }
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
  integrationData: IntegrationData,
  setIntegrationData: IntegrationDataUpdater
) {
  const activeWorkspace =
    data.workspaces.find((workspace) => workspace.id === data.activeWorkspaceId) ?? null
  const activeSnapshots = activeWorkspace
    ? data.snapshots.filter(
        (snapshot) => snapshot.workspaceId === activeWorkspace.id
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
    workspaceId: string,
    exchangeRates?: ExchangeRateSnapshot | null
  ): string | null {
    const workspace = data.workspaces.find((item) => item.id === workspaceId)
    if (!workspace) return null
    const snapshot: WorkspaceSnapshot = {
      id: createId(),
      workspaceId,
      createdAt: new Date().toISOString(),
      workspace: structuredClone(workspace),
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

  function setActiveWorkspace(id: string): void {
    if (!data.workspaces.some((workspace) => workspace.id === id)) return
    setData((current) => ({ ...current, activeWorkspaceId: id }))
  }

  function createWorkspace(input: WorkspaceInput): string {
    const workspace: Workspace = {
      id: createId(),
      name: input.name.trim(),
      baseCurrency: normalizeBaseCurrency(input.baseCurrency),
      exchangeRateProvider: DEFAULT_EXCHANGE_RATE_PROVIDER,
      exchangeRateRefreshIntervalMinutes:
        DEFAULT_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
      accountGroups: [],
      assetAccounts: [],
      positionGroups: []
    }
    setData((current) => ({
      ...current,
      activeWorkspaceId: workspace.id,
      workspaces: [...current.workspaces, workspace]
    }))
    return workspace.id
  }

  function updateWorkspace(id: string, input: WorkspaceSettingsInput): void {
    setData((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === id
          ? {
              ...workspace,
              name: input.name.trim(),
              baseCurrency: normalizeBaseCurrency(input.baseCurrency),
              exchangeRateProvider: normalizeExchangeRateProvider(
                input.exchangeRateProvider
              ),
              exchangeRateRefreshIntervalMinutes:
                normalizeExchangeRateRefreshInterval(
                  input.exchangeRateRefreshIntervalMinutes
                )
            }
          : workspace
      )
    }))
  }

  function deleteWorkspace(id: string): void {
    const deletedAssetAccountIds = new Set(
      data.workspaces
        .find((workspace) => workspace.id === id)
        ?.assetAccounts.map((assetAccount) => assetAccount.id) ?? []
    )
    setData((current) => {
      const workspaces = current.workspaces.filter((workspace) => workspace.id !== id)
      return {
        ...current,
        activeWorkspaceId:
          current.activeWorkspaceId === id
            ? (workspaces[0]?.id ?? null)
            : current.activeWorkspaceId,
        workspaces,
        snapshots: current.snapshots.filter(
          (snapshot) => snapshot.workspaceId !== id
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

  function createAccountGroup(
    workspaceId: string,
    input: AccountGroupInput
  ): string {
    const group: AccountGroup = {
      id: createId(),
      name: input.name.trim(),
      assetAccountIds: []
    }
    setData((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === workspaceId
          ? { ...workspace, accountGroups: [...workspace.accountGroups, group] }
          : workspace
      )
    }))
    return group.id
  }

  function updateAccountGroup(
    workspaceId: string,
    groupId: string,
    input: AccountGroupInput
  ): void {
    setData((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === workspaceId
          ? {
              ...workspace,
              accountGroups: workspace.accountGroups.map((group) =>
                group.id === groupId ? { ...group, name: input.name.trim() } : group
              )
            }
          : workspace
      )
    }))
  }

  function deleteAccountGroup(workspaceId: string, groupId: string): void {
    setData((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === workspaceId
          ? {
              ...workspace,
              accountGroups: workspace.accountGroups.filter(
                (group) => group.id !== groupId
              )
            }
          : workspace
      )
    }))
  }

  function setAccountGroupAccounts(
    workspaceId: string,
    groupId: string,
    assetAccountIds: string[]
  ): string | null {
    const workspace = data.workspaces.find(
      (workspace) => workspace.id === workspaceId
    )
    if (!workspace) return '没有找到对应的工作区'
    if (!workspace.accountGroups.some((group) => group.id === groupId)) {
      return '没有找到对应的账户分组'
    }
    const availableAssetAccountIds = new Set(
      workspace.assetAccounts.map((workspace) => workspace.id)
    )
    const normalizedAssetAccountIds = [...new Set(assetAccountIds)]
    if (
      normalizedAssetAccountIds.some(
        (assetAccountId) => !availableAssetAccountIds.has(assetAccountId)
      )
    ) {
      return '部分资产账户已不存在，请重新选择'
    }
    const assignedGroupByAccountId = new Map(
      workspace.accountGroups.flatMap((group) =>
        group.id === groupId
          ? []
          : group.assetAccountIds.map(
              (assetAccountId) => [assetAccountId, group.name] as const
            )
      )
    )
    const conflictingAccountId = normalizedAssetAccountIds.find(
      (assetAccountId) => assignedGroupByAccountId.has(assetAccountId)
    )
    if (conflictingAccountId) {
      const assetAccount = workspace.assetAccounts.find(
        (item) => item.id === conflictingAccountId
      )
      return `${assetAccount?.name ?? '所选资产账户'} 已属于“${assignedGroupByAccountId.get(conflictingAccountId)}”，一个资产账户只能加入一个分组`
    }
    setData((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === workspaceId
          ? {
              ...workspace,
              accountGroups: workspace.accountGroups.map((group) =>
                group.id === groupId
                  ? { ...group, assetAccountIds: normalizedAssetAccountIds }
                  : group
              )
            }
          : workspace
      )
    }))
    return null
  }

  function removeAccountFromGroup(
    workspaceId: string,
    groupId: string,
    assetAccountId: string
  ): void {
    setData((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === workspaceId
          ? {
              ...workspace,
              accountGroups: workspace.accountGroups.map((group) =>
                group.id === groupId
                  ? {
                      ...group,
                      assetAccountIds: group.assetAccountIds.filter(
                        (id) => id !== assetAccountId
                      )
                    }
                  : group
              )
            }
          : workspace
      )
    }))
  }

  function createPositionGroup(
    workspaceId: string,
    input: PositionGroupInput
  ): string {
    const group: PositionGroup = {
      id: createId(),
      name: input.name.trim(),
      positionIds: []
    }
    setData((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === workspaceId
          ? { ...workspace, positionGroups: [...workspace.positionGroups, group] }
          : workspace
      )
    }))
    return group.id
  }

  function updatePositionGroup(
    workspaceId: string,
    groupId: string,
    input: PositionGroupInput
  ): void {
    setData((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === workspaceId
          ? {
              ...workspace,
              positionGroups: workspace.positionGroups.map((group) =>
                group.id === groupId ? { ...group, name: input.name.trim() } : group
              )
            }
          : workspace
      )
    }))
  }

  function deletePositionGroup(workspaceId: string, groupId: string): void {
    setData((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === workspaceId
          ? {
              ...workspace,
              positionGroups: workspace.positionGroups.filter((group) => group.id !== groupId)
            }
          : workspace
      )
    }))
  }

  function setPositionGroupPositions(
    workspaceId: string,
    groupId: string,
    positionIds: string[]
  ): string | null {
    const workspace = data.workspaces.find(
      (workspace) => workspace.id === workspaceId
    )
    if (!workspace) return '没有找到对应的工作区'
    if (!workspace.positionGroups.some((group) => group.id === groupId)) {
      return '没有找到对应的持仓分组'
    }

    const availablePositionIds = new Set(
      workspace.assetAccounts.flatMap((workspace) =>
        workspace.positions.map((position) => position.id)
      )
    )
    const normalizedPositionIds = [...new Set(positionIds)]
    if (normalizedPositionIds.some((positionId) => !availablePositionIds.has(positionId))) {
      return '部分持仓已不存在，请重新选择'
    }
    const assignedGroupByPositionId = new Map(
      workspace.positionGroups.flatMap((group) =>
        group.id === groupId
          ? []
          : group.positionIds.map((positionId) => [positionId, group.name] as const)
      )
    )
    const conflictingPositionId = normalizedPositionIds.find((positionId) =>
      assignedGroupByPositionId.has(positionId)
    )
    if (conflictingPositionId) {
      const position = workspace.assetAccounts
        .flatMap((workspace) => workspace.positions)
        .find((item) => item.id === conflictingPositionId)
      return `${position?.symbol ?? '所选持仓'} 已属于“${assignedGroupByPositionId.get(conflictingPositionId)}”，一个持仓只能加入一个分组`
    }

    setData((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === workspaceId
          ? {
              ...workspace,
              positionGroups: workspace.positionGroups.map((group) =>
                group.id === groupId
                  ? { ...group, positionIds: normalizedPositionIds }
                  : group
              )
            }
          : workspace
      )
    }))
    return null
  }

  function removePositionFromGroup(
    workspaceId: string,
    groupId: string,
    positionId: string
  ): void {
    setData((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === workspaceId
          ? {
              ...workspace,
              positionGroups: workspace.positionGroups.map((group) =>
                group.id === groupId
                  ? {
                      ...group,
                      positionIds: group.positionIds.filter((id) => id !== positionId)
                    }
                  : group
              )
            }
          : workspace
      )
    }))
  }

  function createAssetAccount(workspaceId: string, input: AssetAccountInput): string {
    const type = normalizeAssetAccountType(input.type) ?? 'Futu'
    const workspace = data.workspaces.find(
      (workspace) => workspace.id === workspaceId
    )
    if (!workspace) throw new Error('没有找到对应的工作区')
    const assetAccountId = createId()
    const integration = resolveIntegrationInput(
      input.integration,
      assetAccountId
    )
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
      ...(sync ? { sync } : {}),
      positions: []
    }
    setData((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === workspaceId
          ? { ...workspace, assetAccounts: [...workspace.assetAccounts, assetAccount] }
          : workspace
      )
    }))
    setAssetAccountIntegration(assetAccount.id, integration)
    return assetAccount.id
  }

  function updateAssetAccount(
    workspaceId: string,
    assetAccountId: string,
    input: AssetAccountInput
  ): void {
    const type = normalizeAssetAccountType(input.type) ?? 'Futu'
    const workspace = data.workspaces.find(
      (workspace) => workspace.id === workspaceId
    )
    if (!workspace) throw new Error('没有找到对应的工作区')
    if (!workspace.assetAccounts.some((workspace) => workspace.id === assetAccountId)) {
      throw new Error('没有找到对应的资产账户')
    }
    const existingIntegration = integrationData.integrations.find(
      (item) => item.assetAccountId === assetAccountId
    )
    const integration = resolveIntegrationInput(
      input.integration,
      assetAccountId,
      existingIntegration
    )
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
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === workspaceId
          ? {
              ...workspace,
              assetAccounts: workspace.assetAccounts.map((assetAccount) =>
                assetAccount.id === assetAccountId
                  ? {
                      ...assetAccount,
                      name: normalizeAssetAccountName(input.name),
                      type,
                      sync
                    }
                  : assetAccount
              )
            }
          : workspace
      )
    }))
    setAssetAccountIntegration(assetAccountId, integration)
  }

  function deleteAssetAccount(workspaceId: string, assetAccountId: string): void {
    setData((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) => {
        if (workspace.id !== workspaceId) return workspace
        const deletedPositionIds = new Set(
          workspace.assetAccounts
            .find((assetAccount) => assetAccount.id === assetAccountId)
            ?.positions.map((position) => position.id) ?? []
        )
        return {
          ...workspace,
          assetAccounts: workspace.assetAccounts.filter(
            (assetAccount) => assetAccount.id !== assetAccountId
          ),
          accountGroups: workspace.accountGroups.map((group) => ({
            ...group,
            assetAccountIds: group.assetAccountIds.filter(
              (id) => id !== assetAccountId
            )
          })),
          positionGroups: workspace.positionGroups.map((group) => ({
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
    workspaceId: string,
    assetAccountId: string,
    input: PositionInput,
    positionId?: string
  ): string | null {
    const position = normalizePosition(input, positionId)
    const assetAccount = data.workspaces
      .find((workspace) => workspace.id === workspaceId)
      ?.assetAccounts.find((workspace) => workspace.id === assetAccountId)
    if (!assetAccount) return '没有找到对应的资产账户'
    if (assetAccount.sync) return '自动同步的资产账户不能手动修改持仓'
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
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === workspaceId
          ? {
              ...workspace,
              assetAccounts: workspace.assetAccounts.map((currentAssetAccount) =>
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
          : workspace
      )
    }))
    return null
  }

  function deletePosition(
    workspaceId: string,
    assetAccountId: string,
    positionId: string
  ): void {
    const assetAccount = data.workspaces
      .find((workspace) => workspace.id === workspaceId)
      ?.assetAccounts.find((workspace) => workspace.id === assetAccountId)
    if (!assetAccount || assetAccount.sync) return
    setData((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === workspaceId
          ? {
              ...workspace,
              assetAccounts: workspace.assetAccounts.map((assetAccount) =>
                assetAccount.id === assetAccountId && !assetAccount.sync
                  ? {
                      ...assetAccount,
                      positions: assetAccount.positions.filter(
                        (position) => position.id !== positionId
                      )
                    }
                  : assetAccount
              ),
              positionGroups: workspace.positionGroups.map((group) => ({
                ...group,
                positionIds: group.positionIds.filter((id) => id !== positionId)
              }))
            }
          : workspace
      )
    }))
  }

  function replacePositions(
    workspaceId: string,
    assetAccountId: string,
    positions: PositionInput[],
    lastSyncedAt?: string
  ): void {
    setData((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) => {
        if (workspace.id !== workspaceId) return workspace
        const targetAccount = workspace.assetAccounts.find(
          (assetAccount) => assetAccount.id === assetAccountId
        )
        if (!targetAccount) return workspace

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
          ...workspace,
          assetAccounts: workspace.assetAccounts.map((assetAccount) =>
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
          positionGroups: workspace.positionGroups.map((group) => ({
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

  function exportWorkspace(): string {
    if (!activeWorkspace) throw new Error('没有可导出的工作区')
    return createWorkspaceBackup(activeWorkspace, activeSnapshots)
  }

  function importWorkspace(
    input: Workspace,
    snapshots: WorkspaceSnapshot[] = []
  ): string {
    const accountGroupIdMap = new Map(
      input.accountGroups.map(
        (accountGroup) => [accountGroup.id, createId()] as const
      )
    )
    const assetAccountIdMap = new Map(
      input.assetAccounts.map(
        (assetAccount) => [assetAccount.id, createId()] as const
      )
    )
    const positionIdMap = new Map(
      input.assetAccounts.flatMap((assetAccount) =>
        assetAccount.positions.map((position) => [position.id, createId()] as const)
      )
    )
    const workspace: Workspace = {
      ...input,
      id: createId(),
      accountGroups: input.accountGroups.map((accountGroup) => ({
        ...accountGroup,
        id: accountGroupIdMap.get(accountGroup.id)!,
        assetAccountIds: accountGroup.assetAccountIds.flatMap((assetAccountId) => {
          const importedAssetAccountId = assetAccountIdMap.get(assetAccountId)
          return importedAssetAccountId ? [importedAssetAccountId] : []
        })
      })),
      assetAccounts: input.assetAccounts.map((assetAccount) => ({
        ...assetAccount,
        id: assetAccountIdMap.get(assetAccount.id)!,
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
      workspaceId: workspace.id,
      workspace: {
        ...structuredClone(snapshot.workspace),
        id: workspace.id
      }
    }))
    setData((current) => ({
      ...current,
      activeWorkspaceId: workspace.id,
      workspaces: [...current.workspaces, workspace],
      snapshots: [...importedSnapshots, ...current.snapshots]
    }))
    return workspace.id
  }

  return {
    workspaces: data.workspaces,
    activeWorkspace,
    activeSnapshots,
    setActiveWorkspace,
    createSnapshot,
    deleteSnapshot,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    createAccountGroup,
    updateAccountGroup,
    deleteAccountGroup,
    setAccountGroupAccounts,
    removeAccountFromGroup,
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
    exportWorkspace,
    importWorkspace
  }
}

export interface PortfolioOperations {
  load(): Promise<PortfolioLoadResponse>
  execute(command: PortfolioCommand): Promise<PortfolioCommandResponse>
  inspectBackup(content: unknown): WorkspaceBackup | null
  exportActiveWorkspace(): Promise<string>
  subscribe(listener: PortfolioChangeListener): () => void
}

export type PortfolioChangeListener = () => void

export class PortfolioService implements PortfolioOperations {
  private data: AppData = structuredClone(EMPTY_PORTFOLIO_DATA)
  private integrationData: IntegrationData = structuredClone(EMPTY_INTEGRATION_DATA)
  private initialized = false
  private pending: Promise<void> = Promise.resolve()
  private readonly listeners = new Set<PortfolioChangeListener>()

  constructor(
    private readonly repository: PortfolioRepository,
    private readonly integrationRepository: IntegrationRepository
  ) {}

  load(): Promise<PortfolioLoadResponse> {
    return this.runExclusive(async () => {
      if (this.initialized) {
        return {
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
        data: structuredClone(this.data),
        integrations: structuredClone(this.integrationData.integrations)
      }
    })
  }

  execute(command: PortfolioCommand): Promise<PortfolioCommandResponse> {
    return this.runExclusive(async () => {
      await this.initialize()
      let nextData = this.data
      let nextIntegrationData = this.integrationData
      const operations = createPortfolioOperations(
        this.data,
        (update) => {
          nextData = typeof update === 'function' ? update(nextData) : update
        },
        this.integrationData,
        (update) => {
          nextIntegrationData =
            typeof update === 'function' ? update(nextIntegrationData) : update
        }
      )
      let result: string | null | undefined

      switch (command.type) {
        case 'set-active-workspace':
          operations.setActiveWorkspace(command.id)
          break
        case 'create-snapshot':
          result = operations.createSnapshot(
            command.workspaceId,
            command.exchangeRates
          )
          break
        case 'delete-snapshot':
          operations.deleteSnapshot(command.snapshotId)
          break
        case 'create-workspace':
          result = operations.createWorkspace(command.input)
          break
        case 'update-workspace':
          operations.updateWorkspace(command.id, command.input)
          break
        case 'delete-workspace':
          operations.deleteWorkspace(command.id)
          break
        case 'create-account-group':
          result = operations.createAccountGroup(
            command.workspaceId,
            command.input
          )
          break
        case 'update-account-group':
          operations.updateAccountGroup(
            command.workspaceId,
            command.groupId,
            command.input
          )
          break
        case 'delete-account-group':
          operations.deleteAccountGroup(command.workspaceId, command.groupId)
          break
        case 'set-account-group-accounts':
          result = operations.setAccountGroupAccounts(
            command.workspaceId,
            command.groupId,
            command.assetAccountIds
          )
          break
        case 'remove-account-from-group':
          operations.removeAccountFromGroup(
            command.workspaceId,
            command.groupId,
            command.assetAccountId
          )
          break
        case 'create-position-group':
          result = operations.createPositionGroup(
            command.workspaceId,
            command.input
          )
          break
        case 'update-position-group':
          operations.updatePositionGroup(
            command.workspaceId,
            command.groupId,
            command.input
          )
          break
        case 'delete-position-group':
          operations.deletePositionGroup(command.workspaceId, command.groupId)
          break
        case 'set-position-group-positions':
          result = operations.setPositionGroupPositions(
            command.workspaceId,
            command.groupId,
            command.positionIds
          )
          break
        case 'remove-position-from-group':
          operations.removePositionFromGroup(
            command.workspaceId,
            command.groupId,
            command.positionId
          )
          break
        case 'create-asset-account':
          result = operations.createAssetAccount(
            command.workspaceId,
            command.input
          )
          break
        case 'update-asset-account':
          operations.updateAssetAccount(
            command.workspaceId,
            command.assetAccountId,
            command.input
          )
          break
        case 'delete-asset-account':
          operations.deleteAssetAccount(
            command.workspaceId,
            command.assetAccountId
          )
          break
        case 'save-position':
          result = operations.savePosition(
            command.workspaceId,
            command.assetAccountId,
            command.input,
            command.positionId
          )
          break
        case 'delete-position':
          operations.deletePosition(
            command.workspaceId,
            command.assetAccountId,
            command.positionId
          )
          break
        case 'replace-positions':
          operations.replacePositions(
            command.workspaceId,
            command.assetAccountId,
            command.positions,
            command.lastSyncedAt
          )
          break
        case 'import-workspace':
          result = operations.importWorkspace(command.workspace, command.snapshots)
          break
        default:
          throw new Error('不支持的资产命令')
      }

      if (
        typeof result === 'string' &&
        (command.type === 'save-position' ||
          command.type === 'set-account-group-accounts' ||
          command.type === 'set-position-group-positions')
      ) {
        return {
          data: structuredClone(this.data),
          integrations: structuredClone(this.integrationData.integrations),
          result
        }
      }

      await this.persist(nextData, nextIntegrationData)
      this.data = nextData
      this.integrationData = nextIntegrationData
      this.listeners.forEach((listener) => {
        try {
          listener()
        } catch {
          // A transport listener must not break a committed portfolio update.
        }
      })
      return {
        data: structuredClone(this.data),
        integrations: structuredClone(this.integrationData.integrations),
        ...(result === undefined ? {} : { result })
      }
    })
  }

  inspectBackup(content: unknown): WorkspaceBackup | null {
    return typeof content === 'string' ? parseWorkspaceBackup(content) : null
  }

  async exportActiveWorkspace(): Promise<string> {
    return this.runExclusive(async () => {
      await this.initialize()
      const workspace = this.data.workspaces.find(
        (item) => item.id === this.data.activeWorkspaceId
      )
      if (!workspace) throw new Error('没有可导出的工作区')
      return createWorkspaceBackup(
        workspace,
        this.data.snapshots.filter(
          (snapshot) => snapshot.workspaceId === workspace.id
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
  }

  private async persist(
    data: AppData,
    integrationData: IntegrationData
  ): Promise<void> {
    await this.repository.save(JSON.stringify(data))
    await this.integrationRepository.save(JSON.stringify(integrationData))
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
