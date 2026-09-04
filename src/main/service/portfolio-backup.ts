import { CRYPTO_QUOTE_PROVIDERS, STOCK_QUOTE_PROVIDERS } from '../../shared/asset-quotes'
import {
  EXCHANGE_RATE_PROVIDERS,
  MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES
} from '../../shared/exchange-rates'
import {
  type AccountIntegration,
  type IntegrationData,
  type ProxyProfile
} from '../../shared/integrations'
import {
  DEFAULT_SYNC_INTERVAL,
  MAX_TAG_NOTE_LENGTH,
  type AccountSync,
  type AccountType,
  type AppData,
  type Position,
  type Workspace,
  type WorkspaceBackup,
  type WorkspaceSnapshot
} from '../../shared/portfolio'

import {
  isCurrencyCode,
  isTagColor,
  normalizeAccountType,
  normalizeStoredData,
  normalizeStoredIntegrationData,
  normalizeStoredWorkspace
} from './portfolio-data'

function isValidBackupPosition(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const position = value as Partial<Position>
  return (
    typeof position.id === 'string' &&
    Boolean(position.id.trim()) &&
    (position.market === 'CN' ||
      position.market === 'CN_OTC' ||
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
    (typeof sync.lastSyncedAt === 'string' && Number.isFinite(Date.parse(sync.lastSyncedAt)))
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
  snapshots: WorkspaceSnapshot[],
  integrations: AccountIntegration[],
  proxyProfiles: ProxyProfile[]
): WorkspaceBackup {
  return {
    workspace: stripIntegrationFields(workspace),
    snapshots: snapshots.map(sanitizeSnapshot),
    integrations: structuredClone(integrations),
    proxyProfiles: structuredClone(proxyProfiles)
  }
}

export function reconcileIntegrations(
  data: AppData,
  integrationData: IntegrationData
): { data: AppData; integrationData: IntegrationData } {
  const accountTypes = new Map(
    data.workspaces.flatMap((workspace) =>
      workspace.accounts.map((account) => [account.id, account.type] as const)
    )
  )
  const integrations = integrationData.integrations.filter(
    (integration) => accountTypes.get(integration.accountId) === integration.provider
  )
  const integratedAccountIds = new Set(integrations.map((integration) => integration.accountId))
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
          return account.sync ? { ...account, sync: undefined } : account
        })
      }))
    },
    integrationData: {
      version: 1,
      integrations,
      proxyProfiles: structuredClone(integrationData.proxyProfiles)
    }
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
    (workspace.baseCurrency !== undefined && !isCurrencyCode(workspace.baseCurrency)) ||
    (workspace.exchangeRateProvider !== undefined &&
      !EXCHANGE_RATE_PROVIDERS.includes(workspace.exchangeRateProvider)) ||
    (workspace.stockQuoteProvider !== undefined &&
      !STOCK_QUOTE_PROVIDERS.includes(workspace.stockQuoteProvider)) ||
    (workspace.cryptoQuoteProvider !== undefined &&
      !CRYPTO_QUOTE_PROVIDERS.includes(workspace.cryptoQuoteProvider)) ||
    (workspace.exchangeRateRefreshIntervalMinutes !== undefined &&
      (typeof workspace.exchangeRateRefreshIntervalMinutes !== 'number' ||
        !Number.isInteger(workspace.exchangeRateRefreshIntervalMinutes) ||
        workspace.exchangeRateRefreshIntervalMinutes < MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES ||
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
      (tag.note !== undefined &&
        (typeof tag.note !== 'string' || tag.note.trim().length > MAX_TAG_NOTE_LENGTH)) ||
      !isTagColor(tag.color)
    )
      return false
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
        )
          return false
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

export function createWorkspaceBackup(
  workspace: Workspace,
  snapshots: WorkspaceSnapshot[] = [],
  integrations: AccountIntegration[] = [],
  proxyProfiles: ProxyProfile[] = []
): string {
  const accountIds = new Set(workspace.accounts.map((account) => account.id))
  const workspaceIntegrations = integrations.filter((integration) =>
    accountIds.has(integration.accountId)
  )
  const referencedProxyProfileIds = new Set(
    workspaceIntegrations.flatMap((integration) =>
      (integration.provider === 'Okx' || integration.provider === 'Binance') &&
      integration.network.mode === 'proxy'
        ? [integration.network.proxyProfileId]
        : []
    )
  )
  const backup = sanitizeWorkspaceBackup(
    workspace,
    snapshots,
    workspaceIntegrations,
    proxyProfiles.filter((profile) => referencedProxyProfileIds.has(profile.id))
  )
  return JSON.stringify(
    {
      format: 'chromie-workspace',
      version: 2,
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
      integrations?: unknown
      proxyProfiles?: unknown
    }
    if (
      backup.format !== 'chromie-workspace' ||
      (backup.version !== 1 && backup.version !== 2) ||
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
    const rawIntegrations = backup.integrations ?? []
    if (!Array.isArray(rawIntegrations)) return null
    const rawProxyProfiles = backup.version === 2 ? (backup.proxyProfiles ?? []) : []
    if (!Array.isArray(rawProxyProfiles)) return null
    const normalizedIntegrationData = normalizeStoredIntegrationData({
      version: 1,
      integrations: rawIntegrations,
      proxyProfiles: rawProxyProfiles
    })
    if (
      !normalizedIntegrationData ||
      normalizedIntegrationData.integrations.length !== rawIntegrations.length ||
      normalizedIntegrationData.proxyProfiles.length !== rawProxyProfiles.length
    ) {
      return null
    }
    const accountTypes = new Map(
      normalizedWorkspace.accounts.map((account) => [account.id, account.type])
    )
    if (
      normalizedIntegrationData.integrations.some(
        (integration) => accountTypes.get(integration.accountId) !== integration.provider
      )
    ) {
      return null
    }
    const normalized = normalizeStoredData({
      version: 1,
      activeWorkspaceId: normalizedWorkspace.id,
      workspaces: [normalizedWorkspace],
      snapshots: rawSnapshots
    })
    const workspace = normalized?.workspaces[0]
    if (!workspace || normalized.snapshots.length !== rawSnapshots.length) return null
    return {
      workspace,
      snapshots: normalized.snapshots,
      integrations: normalizedIntegrationData.integrations,
      proxyProfiles: normalizedIntegrationData.proxyProfiles
    }
  } catch {
    return null
  }
}
