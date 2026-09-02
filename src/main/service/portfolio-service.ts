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
  TAG_COLORS,
  marketMeta,
  type WorkspaceBackup,
  type BaseCurrency,
  type AppData,
  type Account,
  type AccountInput,
  type AccountSync,
  type AccountType,
  type Market,
  type PortfolioCommand,
  type PortfolioCommandResponse,
  type PortfolioLoadResponse,
  type WorkspaceSnapshot,
  type Position,
  type PositionInput,
  type Tag,
  type TagColor,
  type TagInput,
  type Workspace,
  type WorkspaceInput,
  type WorkspaceSettingsInput
} from '../../shared/portfolio'
import {
  EMPTY_INTEGRATION_DATA,
  type AccountIntegration,
  type IntegrationData
} from '../../shared/integrations'
import type { IntegrationRepository } from '../repository/integration-repository'
import type { PortfolioRepository } from '../repository/portfolio-repository'

function normalizeAccountName(value: string): string {
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

function normalizeTagIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.flatMap((tagId) =>
    typeof tagId === 'string' && tagId.trim() ? [tagId.trim()] : []
  ))]
}

function isTagColor(value: unknown): value is TagColor {
  return typeof value === 'string' && TAG_COLORS.includes(value as TagColor)
}

function normalizePosition(input: PositionInput, id?: string): Position {
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

function normalizeStoredMarket(value: unknown): Market | null {
  if (typeof value !== 'string') return null
  const market = value.toUpperCase()
  return market === 'CN' || market === 'US' || market === 'HK' || market === 'CC'
    ? market
    : null
}

function normalizeAccountType(value: unknown): AccountType | null {
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

function normalizeAccountSync(
  value: unknown,
  type: AccountType
): AccountSync | undefined {
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
    accountId ??
    (typeof integration.accountId === 'string'
      ? integration.accountId.trim()
      : '')
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
      (integration.provider === 'Okx' &&
        (typeof api.passphrase !== 'string' || !api.passphrase))
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

function resolveIntegrationInput(
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
      accountId
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

function normalizeStoredIntegrationData(input: unknown): IntegrationData | null {
  if (!input || typeof input !== 'object') return null
  const value = input as { version?: unknown; integrations?: unknown }
  if (value.version !== 1 || !Array.isArray(value.integrations)) return null

  const usedAccountIds = new Set<string>()
  const integrations = value.integrations.flatMap((integration) => {
    const normalized = normalizeIntegration(integration)
    if (!normalized || usedAccountIds.has(normalized.accountId)) return []
    usedAccountIds.add(normalized.accountId)
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
      ...(price === undefined ? {} : { price }),
      tagIds: normalizeTagIds(position.tagIds)
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

function normalizeStoredWorkspace(value: unknown): Workspace | null {
  if (!value || typeof value !== 'object') return null
  const storedWorkspace = value as {
    id?: unknown
    name?: unknown
    baseCurrency?: unknown
    exchangeRateProvider?: unknown
    exchangeRateRefreshIntervalMinutes?: unknown
    tags?: unknown
    accounts?: unknown
  }
  if (
    typeof storedWorkspace.id !== 'string' ||
    !storedWorkspace.id.trim() ||
    typeof storedWorkspace.name !== 'string' ||
    !storedWorkspace.name.trim() ||
    !Array.isArray(storedWorkspace.accounts)
  ) return null

  const usedAccountIds = new Set<string>()
  const usedPositionIds = new Set<string>()
  let accounts: Account[] = storedWorkspace.accounts.flatMap((value) => {
    if (!value || typeof value !== 'object') return []
    const storedAccount = value as {
      id?: unknown
      name?: unknown
      type?: unknown
      sync?: unknown
      tagIds?: unknown
      positions?: unknown
    }
    const type = normalizeAccountType(storedAccount.type)
    if (
      typeof storedAccount.id !== 'string' ||
      !storedAccount.id.trim() ||
      usedAccountIds.has(storedAccount.id) ||
      typeof storedAccount.name !== 'string' ||
      !storedAccount.name.trim() ||
      !type ||
      !Array.isArray(storedAccount.positions)
    ) return []

    usedAccountIds.add(storedAccount.id)
    const sync = normalizeAccountSync(storedAccount.sync, type)
    return [{
      id: storedAccount.id,
      name: normalizeAccountName(storedAccount.name),
      type,
      ...(sync ? { sync } : {}),
      tagIds: normalizeTagIds(storedAccount.tagIds),
      positions: storedAccount.positions.flatMap((position) => {
        const normalized = normalizeStoredPosition(position)
        if (!normalized) return []
        const uniquePosition = usedPositionIds.has(normalized.id)
          ? { ...normalized, id: createId() }
          : normalized
        usedPositionIds.add(uniquePosition.id)
        return [uniquePosition]
      })
    }]
  })

  const usedTagIds = new Set<string>()
  const tagByNormalizedName = new Map<string, Tag>()
  const tags: Tag[] = []
  function addTag(rawId: unknown, rawName: unknown, rawColor: unknown): Tag | null {
    if (typeof rawName !== 'string' || !rawName.trim() || !isTagColor(rawColor)) return null
    const name = rawName.trim()
    const key = name.toLocaleLowerCase()
    const existing = tagByNormalizedName.get(key)
    if (existing) return existing
    const requestedId = typeof rawId === 'string' ? rawId.trim() : ''
    const id = requestedId && !usedTagIds.has(requestedId) ? requestedId : createId()
    const tag = { id, name, color: rawColor }
    usedTagIds.add(id)
    tagByNormalizedName.set(key, tag)
    tags.push(tag)
    return tag
  }

  if (!Array.isArray(storedWorkspace.tags)) return null
  let hasInvalidTag = false
  storedWorkspace.tags.forEach((value) => {
    if (!value || typeof value !== 'object') {
      hasInvalidTag = true
      return
    }
    const storedTag = value as { id?: unknown; name?: unknown; color?: unknown }
    if (!addTag(storedTag.id, storedTag.name, storedTag.color)) hasInvalidTag = true
  })
  if (hasInvalidTag) return null

  const availableTagIds = new Set(tags.map((tag) => tag.id))
  accounts = accounts.map((account) => ({
    ...account,
    tagIds: account.tagIds.filter((tagId) => availableTagIds.has(tagId)),
    positions: account.positions.map((position) => ({
      ...position,
      tagIds: position.tagIds.filter((tagId) => availableTagIds.has(tagId))
    }))
  }))

  return {
    id: storedWorkspace.id,
    name: storedWorkspace.name.trim(),
    baseCurrency: normalizeBaseCurrency(storedWorkspace.baseCurrency),
    exchangeRateProvider: normalizeExchangeRateProvider(
      storedWorkspace.exchangeRateProvider
    ),
    exchangeRateRefreshIntervalMinutes: normalizeExchangeRateRefreshInterval(
      storedWorkspace.exchangeRateRefreshIntervalMinutes
    ),
    tags,
    accounts
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
  ) return null

  const workspaces = value.workspaces.flatMap((workspace) => {
    const normalized = normalizeStoredWorkspace(workspace)
    return normalized ? [normalized] : []
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
        const workspace = normalizeStoredWorkspace(storedSnapshot.workspace)
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
    Array.isArray(position.tagIds) &&
    position.tagIds.every((tagId) => typeof tagId === 'string' && Boolean(tagId.trim())) &&
    (position.price === undefined ||
      (typeof position.price === 'number' && Number.isFinite(position.price)))
  )
}

function isValidBackupSync(value: unknown, type: AccountType): boolean {
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
  const sync = value as Partial<AccountSync>
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
    accounts: workspace.accounts.map((account) => ({
      id: account.id,
      name: account.name,
      type: account.type,
      ...(account.sync ? { sync: structuredClone(account.sync) } : {}),
      tagIds: [...account.tagIds],
      positions: structuredClone(account.positions)
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
      workspace.accounts.map(
        (account) => [account.id, account.type] as const
      )
    )
  )
  const integrations = integrationData.integrations.filter(
    (integration) => accountTypes.get(integration.accountId) === integration.provider
  )
  const integratedAccountIds = new Set(
    integrations.map((integration) => integration.accountId)
  )
  return {
    data: {
      ...data,
      workspaces: data.workspaces.map((workspace) => ({
        ...workspace,
        accounts: workspace.accounts.map((account) => {
          if (integratedAccountIds.has(account.id)) {
            return account.sync
              ? account
              : {
                  ...account,
                  sync: { interval: DEFAULT_SYNC_INTERVAL }
                }
          }
          return account.sync
            ? { ...account, sync: undefined }
            : account
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
    !Array.isArray(workspace.tags) ||
    !Array.isArray(workspace.accounts)
  ) {
    return false
  }

  const tagIds = new Set<string>()
  const validTags = workspace.tags.every((tag) => {
    if (
      !tag ||
      typeof tag.id !== 'string' ||
      !tag.id.trim() ||
      tagIds.has(tag.id) ||
      typeof tag.name !== 'string' ||
      !tag.name.trim() ||
      !isTagColor(tag.color)
    ) return false
    tagIds.add(tag.id)
    return true
  })
  if (!validTags) return false

  const accountIds = new Set<string>()
  const positionIds = new Set<string>()
  const validAccounts = workspace.accounts.every((account) => {
    const type = normalizeAccountType(account?.type)
    if (
      !account ||
      typeof account.id !== 'string' ||
      !account.id ||
      accountIds.has(account.id) ||
      typeof account.name !== 'string' ||
      !account.name.trim() ||
      !type ||
      !Array.isArray(account.tagIds) ||
      account.tagIds.some((tagId) => !tagIds.has(tagId)) ||
      !Array.isArray(account.positions) ||
      !account.positions.every((position) => {
        if (
          !isValidBackupPosition(position) ||
          positionIds.has(position.id) ||
          position.tagIds.some((tagId) => !tagIds.has(tagId))
        ) return false
        positionIds.add(position.id)
        return true
      }) ||
      (account.sync !== undefined && !isValidBackupSync(account.sync, type))
    ) {
      return false
    }
    accountIds.add(account.id)
    return true
  })
  return validAccounts
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
    const normalizedWorkspace = normalizeStoredWorkspace(backup.workspace)
    if (!normalizedWorkspace) return null
    const rawSnapshots = backup.snapshots
    if (!Array.isArray(rawSnapshots)) return null
    const normalized = normalizeStoredData({
      version: backup.version,
      activeWorkspaceId: normalizedWorkspace.id,
      workspaces: [normalizedWorkspace],
      snapshots: rawSnapshots
    })
    const workspace = normalized?.workspaces[0]
    if (!workspace || normalized.snapshots.length !== rawSnapshots.length) return null
    return { workspace, snapshots: normalized.snapshots }
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

  function setAccountIntegration(
    accountId: string,
    integration: AccountIntegration | null
  ): void {
    setIntegrationData((current) => ({
      ...current,
      integrations: integration
        ? [
            ...current.integrations.filter(
              (item) => item.accountId !== accountId
            ),
            integration
          ]
        : current.integrations.filter(
            (item) => item.accountId !== accountId
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
      tags: [],
      accounts: []
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
    const deletedAccountIds = new Set(
      data.workspaces
        .find((workspace) => workspace.id === id)
        ?.accounts.map((account) => account.id) ?? []
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
        (integration) => !deletedAccountIds.has(integration.accountId)
      )
    }))
  }

  function createTag(workspaceId: string, input: TagInput): string {
    const workspace = data.workspaces.find((item) => item.id === workspaceId)
    if (!workspace) throw new Error('没有找到对应的工作区')
    const name = input.name.trim()
    if (workspace.tags.some((tag) => tag.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new Error(`标签“${name}”已存在`)
    }
    const tag: Tag = { id: createId(), name, color: input.color }
    setData((current) => ({
      ...current,
      workspaces: current.workspaces.map((item) =>
        item.id === workspaceId ? { ...item, tags: [...item.tags, tag] } : item
      )
    }))
    return tag.id
  }

  function updateTag(workspaceId: string, tagId: string, input: TagInput): void {
    const workspace = data.workspaces.find((item) => item.id === workspaceId)
    if (!workspace?.tags.some((tag) => tag.id === tagId)) {
      throw new Error('没有找到对应的标签')
    }
    const name = input.name.trim()
    if (workspace.tags.some((tag) =>
      tag.id !== tagId && tag.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    )) throw new Error(`标签“${name}”已存在`)
    setData((current) => ({
      ...current,
      workspaces: current.workspaces.map((item) =>
        item.id === workspaceId
          ? {
              ...item,
              tags: item.tags.map((tag) =>
                tag.id === tagId ? { ...tag, name, color: input.color } : tag
              )
            }
          : item
      )
    }))
  }

  function deleteTag(workspaceId: string, tagId: string): void {
    setData((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === workspaceId
          ? {
              ...workspace,
              tags: workspace.tags.filter((tag) => tag.id !== tagId),
              accounts: workspace.accounts.map((account) => ({
                ...account,
                tagIds: account.tagIds.filter((id) => id !== tagId),
                positions: account.positions.map((position) => ({
                  ...position,
                  tagIds: position.tagIds.filter((id) => id !== tagId)
                }))
              }))
            }
          : workspace
      )
    }))
  }

  function validateTagIds(workspace: Workspace, tagIds: string[]): string[] | null {
    const normalized = normalizeTagIds(tagIds)
    const available = new Set(workspace.tags.map((tag) => tag.id))
    return normalized.every((tagId) => available.has(tagId)) ? normalized : null
  }

  function setAccountTags(
    workspaceId: string,
    accountId: string,
    tagIds: string[]
  ): string | null {
    const workspace = data.workspaces.find((item) => item.id === workspaceId)
    if (!workspace) return '没有找到对应的工作区'
    if (!workspace.accounts.some((account) => account.id === accountId)) {
      return '没有找到对应的资产账户'
    }
    const normalized = validateTagIds(workspace, tagIds)
    if (!normalized) return '部分标签已不存在，请重新选择'
    setData((current) => ({
      ...current,
      workspaces: current.workspaces.map((item) =>
        item.id === workspaceId
          ? {
              ...item,
              accounts: item.accounts.map((account) =>
                account.id === accountId ? { ...account, tagIds: normalized } : account
              )
            }
          : item
      )
    }))
    return null
  }

  function setPositionTags(
    workspaceId: string,
    accountId: string,
    positionId: string,
    tagIds: string[]
  ): string | null {
    const workspace = data.workspaces.find((item) => item.id === workspaceId)
    if (!workspace) return '没有找到对应的工作区'
    const account = workspace.accounts.find((item) => item.id === accountId)
    if (!account) return '没有找到对应的资产账户'
    if (!account.positions.some((position) => position.id === positionId)) {
      return '没有找到对应的持仓'
    }
    const normalized = validateTagIds(workspace, tagIds)
    if (!normalized) return '部分标签已不存在，请重新选择'
    setData((current) => ({
      ...current,
      workspaces: current.workspaces.map((item) =>
        item.id === workspaceId
          ? {
              ...item,
              accounts: item.accounts.map((account) =>
                account.id === accountId
                  ? {
                      ...account,
                      positions: account.positions.map((position) =>
                        position.id === positionId
                          ? { ...position, tagIds: normalized }
                          : position
                      )
                    }
                  : account
              )
            }
          : item
      )
    }))
    return null
  }

  function createAccount(workspaceId: string, input: AccountInput): string {
    const type = normalizeAccountType(input.type) ?? 'Futu'
    const workspace = data.workspaces.find(
      (workspace) => workspace.id === workspaceId
    )
    if (!workspace) throw new Error('没有找到对应的工作区')
    const accountId = createId()
    const integration = resolveIntegrationInput(
      input.integration,
      accountId
    )
    if (input.integration && (!integration || integration.provider !== type)) {
      throw new Error('同步配置与资产账户类型不匹配')
    }
    const sync = integration
      ? (normalizeAccountSync(input.sync, type) ?? {
          interval: DEFAULT_SYNC_INTERVAL
        })
      : undefined
    const tagIds = validateTagIds(workspace, input.tagIds ?? [])
    if (!tagIds) throw new Error('部分标签已不存在，请重新选择')
    const account: Account = {
      id: accountId,
      name: normalizeAccountName(input.name),
      type,
      ...(sync ? { sync } : {}),
      tagIds,
      positions: []
    }
    setData((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === workspaceId
          ? { ...workspace, accounts: [...workspace.accounts, account] }
          : workspace
      )
    }))
    setAccountIntegration(account.id, integration)
    return account.id
  }

  function updateAccount(
    workspaceId: string,
    accountId: string,
    input: AccountInput
  ): void {
    const type = normalizeAccountType(input.type) ?? 'Futu'
    const workspace = data.workspaces.find(
      (workspace) => workspace.id === workspaceId
    )
    if (!workspace) throw new Error('没有找到对应的工作区')
    if (!workspace.accounts.some((workspace) => workspace.id === accountId)) {
      throw new Error('没有找到对应的资产账户')
    }
    const existingIntegration = integrationData.integrations.find(
      (item) => item.accountId === accountId
    )
    const integration = resolveIntegrationInput(
      input.integration,
      accountId,
      existingIntegration
    )
    if (input.integration && (!integration || integration.provider !== type)) {
      throw new Error('同步配置与资产账户类型不匹配')
    }
    const sync = integration
      ? (normalizeAccountSync(input.sync, type) ?? {
          interval: DEFAULT_SYNC_INTERVAL
        })
      : undefined
    const existingAccount = workspace.accounts.find(
      (account) => account.id === accountId
    )!
    const tagIds = validateTagIds(workspace, input.tagIds ?? existingAccount.tagIds)
    if (!tagIds) throw new Error('部分标签已不存在，请重新选择')
    setData((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === workspaceId
          ? {
              ...workspace,
              accounts: workspace.accounts.map((account) =>
                account.id === accountId
                  ? {
                      ...account,
                      name: normalizeAccountName(input.name),
                      type,
                      sync,
                      tagIds
                    }
                  : account
              )
            }
          : workspace
      )
    }))
    setAccountIntegration(accountId, integration)
  }

  function deleteAccount(workspaceId: string, accountId: string): void {
    setData((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) => {
        if (workspace.id !== workspaceId) return workspace
        return {
          ...workspace,
          accounts: workspace.accounts.filter(
            (account) => account.id !== accountId
          )
        }
      })
    }))
    setAccountIntegration(accountId, null)
  }

  function savePosition(
    workspaceId: string,
    accountId: string,
    input: PositionInput,
    positionId?: string
  ): string | null {
    const workspace = data.workspaces.find((item) => item.id === workspaceId)
    const account = workspace?.accounts.find(
      (item) => item.id === accountId
    )
    if (!account) return '没有找到对应的资产账户'
    if (account.sync) return '自动同步的资产账户不能手动修改持仓'
    if (positionId && !account.positions.some((item) => item.id === positionId)) {
      return '没有找到对应的持仓'
    }
    const existingPosition = account.positions.find((item) => item.id === positionId)
    const tagIds = validateTagIds(workspace!, input.tagIds ?? existingPosition?.tagIds ?? [])
    if (!tagIds) return '部分标签已不存在，请重新选择'
    const position = normalizePosition({ ...input, tagIds }, positionId)

    const duplicate = account.positions.some(
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
              accounts: workspace.accounts.map((currentAccount) =>
                currentAccount.id === accountId
                  ? {
                      ...currentAccount,
                      positions: positionId
                        ? currentAccount.positions.map((item) =>
                            item.id === positionId ? position : item
                          )
                        : [...currentAccount.positions, position]
                    }
                  : currentAccount
              )
            }
          : workspace
      )
    }))
    return null
  }

  function deletePosition(
    workspaceId: string,
    accountId: string,
    positionId: string
  ): void {
    const account = data.workspaces
      .find((workspace) => workspace.id === workspaceId)
      ?.accounts.find((workspace) => workspace.id === accountId)
    if (!account || account.sync) return
    setData((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === workspaceId
          ? {
              ...workspace,
              accounts: workspace.accounts.map((account) =>
                account.id === accountId && !account.sync
                  ? {
                      ...account,
                      positions: account.positions.filter(
                        (position) => position.id !== positionId
                      )
                    }
                  : account
              )
            }
          : workspace
      )
    }))
  }

  function replacePositions(
    workspaceId: string,
    accountId: string,
    positions: PositionInput[],
    lastSyncedAt?: string
  ): void {
    setData((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) => {
        if (workspace.id !== workspaceId) return workspace
        const targetAccount = workspace.accounts.find(
          (account) => account.id === accountId
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
          const position = normalizePosition(
            { ...input, tagIds: input.tagIds ?? existing?.tagIds ?? [] },
            existing?.id
          )
          usedPositionIds.add(position.id)
          return position
        })
        return {
          ...workspace,
          accounts: workspace.accounts.map((account) =>
            account.id === accountId
              ? {
                  ...account,
                  positions: normalizedPositions,
                  ...(account.sync &&
                  typeof lastSyncedAt === 'string' &&
                  Number.isFinite(Date.parse(lastSyncedAt))
                    ? {
                        sync: {
                          ...account.sync,
                          lastSyncedAt
                        }
                      }
                    : {})
                }
              : account
          )
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
    const tagIdMap = new Map(
      input.tags.map(
        (tag) => [tag.id, createId()] as const
      )
    )
    const accountIdMap = new Map(
      input.accounts.map(
        (account) => [account.id, createId()] as const
      )
    )
    const positionIdMap = new Map(
      input.accounts.flatMap((account) =>
        account.positions.map((position) => [position.id, createId()] as const)
      )
    )
    const workspace: Workspace = {
      ...input,
      id: createId(),
      tags: input.tags.map((tag) => ({
        ...tag,
        id: tagIdMap.get(tag.id)!
      })),
      accounts: input.accounts.map((account) => ({
        ...account,
        id: accountIdMap.get(account.id)!,
        sync: undefined,
        tagIds: account.tagIds.flatMap((tagId) => {
          const importedTagId = tagIdMap.get(tagId)
          return importedTagId ? [importedTagId] : []
        }),
        positions: account.positions.map((position) => ({
          ...position,
          id: positionIdMap.get(position.id)!,
          tagIds: position.tagIds.flatMap((tagId) => {
            const importedTagId = tagIdMap.get(tagId)
            return importedTagId ? [importedTagId] : []
          })
        }))
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
    createTag,
    updateTag,
    deleteTag,
    setAccountTags,
    setPositionTags,
    createAccount,
    updateAccount,
    deleteAccount,
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
        case 'create-tag':
          result = operations.createTag(command.workspaceId, command.input)
          break
        case 'update-tag':
          operations.updateTag(
            command.workspaceId,
            command.tagId,
            command.input
          )
          break
        case 'delete-tag':
          operations.deleteTag(command.workspaceId, command.tagId)
          break
        case 'set-account-tags':
          result = operations.setAccountTags(
            command.workspaceId,
            command.accountId,
            command.tagIds
          )
          break
        case 'set-position-tags':
          result = operations.setPositionTags(
            command.workspaceId,
            command.accountId,
            command.positionId,
            command.tagIds
          )
          break
        case 'create-account':
          result = operations.createAccount(
            command.workspaceId,
            command.input
          )
          break
        case 'update-account':
          operations.updateAccount(
            command.workspaceId,
            command.accountId,
            command.input
          )
          break
        case 'delete-account':
          operations.deleteAccount(
            command.workspaceId,
            command.accountId
          )
          break
        case 'save-position':
          result = operations.savePosition(
            command.workspaceId,
            command.accountId,
            command.input,
            command.positionId
          )
          break
        case 'delete-position':
          operations.deletePosition(
            command.workspaceId,
            command.accountId,
            command.positionId
          )
          break
        case 'replace-positions':
          operations.replacePositions(
            command.workspaceId,
            command.accountId,
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
          command.type === 'set-account-tags' ||
          command.type === 'set-position-tags')
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
