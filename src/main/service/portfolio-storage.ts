import { isExchangeRateCurrency, type ExchangeRateSnapshot } from '../../shared/exchange-rates'
import { type IntegrationData } from '../../shared/integrations'
import {
  type Account,
  type AppData,
  type Position,
  type Tag,
  type Workspace
} from '../../shared/portfolio'

import {
  isCurrencyCode,
  isTagColor,
  normalizeAccountName,
  normalizeAccountSync,
  normalizeAccountType,
  normalizeBaseCurrency,
  normalizeCryptoQuoteProvider,
  normalizeExchangeRateProvider,
  normalizeExchangeRateRefreshInterval,
  normalizeIntegration,
  normalizePosition,
  normalizeStockQuoteProvider,
  normalizeStoredMarket,
  normalizeStoredTagIds
} from './portfolio-normalization'
export function normalizeStoredIntegrationData(input: unknown): IntegrationData | null {
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
  return integrations.length === value.integrations.length ? { version: 1, integrations } : null
}

export function parseStoredIntegrationData(raw: string): IntegrationData | null {
  try {
    return normalizeStoredIntegrationData(JSON.parse(raw))
  } catch {
    return null
  }
}

export function normalizeStoredPosition(value: unknown): Position | null {
  if (!value || typeof value !== 'object') return null
  const position = value as Partial<Position>
  const market = normalizeStoredMarket(position.market)
  const tagIds = normalizeStoredTagIds(position.tagIds)
  if (
    !market ||
    !tagIds ||
    typeof position.id !== 'string' ||
    !position.id.trim() ||
    typeof position.symbol !== 'string' ||
    !position.symbol.trim() ||
    typeof position.name !== 'string' ||
    !position.name.trim() ||
    typeof position.currency !== 'string' ||
    !isCurrencyCode(position.currency) ||
    typeof position.quantity !== 'number' ||
    !Number.isFinite(position.quantity) ||
    (position.price !== undefined &&
      (typeof position.price !== 'number' ||
        !Number.isFinite(position.price) ||
        position.price < 0))
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
      tagIds
    },
    position.id
  )
}

export function normalizeStoredExchangeRates(value: unknown): ExchangeRateSnapshot | null {
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

export function normalizeStoredWorkspace(value: unknown): Workspace | null {
  if (!value || typeof value !== 'object') return null
  const storedWorkspace = value as {
    id?: unknown
    name?: unknown
    baseCurrency?: unknown
    exchangeRateProvider?: unknown
    exchangeRateRefreshIntervalMinutes?: unknown
    stockQuoteProvider?: unknown
    cryptoQuoteProvider?: unknown
    tags?: unknown
    accounts?: unknown
  }
  if (
    typeof storedWorkspace.id !== 'string' ||
    !storedWorkspace.id.trim() ||
    typeof storedWorkspace.name !== 'string' ||
    !storedWorkspace.name.trim() ||
    !Array.isArray(storedWorkspace.accounts)
  )
    return null

  const usedAccountIds = new Set<string>()
  const usedPositionIds = new Set<string>()
  const accounts: Account[] = []
  for (const value of storedWorkspace.accounts) {
    if (!value || typeof value !== 'object') return null
    const storedAccount = value as {
      id?: unknown
      name?: unknown
      type?: unknown
      sync?: unknown
      tagIds?: unknown
      positions?: unknown
    }
    const type = normalizeAccountType(storedAccount.type)
    const tagIds = normalizeStoredTagIds(storedAccount.tagIds)
    if (
      typeof storedAccount.id !== 'string' ||
      !storedAccount.id.trim() ||
      usedAccountIds.has(storedAccount.id) ||
      typeof storedAccount.name !== 'string' ||
      !storedAccount.name.trim() ||
      !type ||
      !tagIds ||
      !Array.isArray(storedAccount.positions)
    )
      return null

    usedAccountIds.add(storedAccount.id)
    const sync = normalizeAccountSync(storedAccount.sync, type)
    const positions: Position[] = []
    for (const position of storedAccount.positions) {
      const normalized = normalizeStoredPosition(position)
      if (!normalized || usedPositionIds.has(normalized.id)) return null
      usedPositionIds.add(normalized.id)
      positions.push(normalized)
    }
    accounts.push({
      id: storedAccount.id,
      name: normalizeAccountName(storedAccount.name),
      type,
      ...(sync ? { sync } : {}),
      tagIds,
      positions
    })
  }

  const usedTagIds = new Set<string>()
  const tagByNormalizedName = new Map<string, Tag>()
  const tags: Tag[] = []
  function addTag(rawId: unknown, rawName: unknown, rawColor: unknown): Tag | null {
    if (typeof rawName !== 'string' || !rawName.trim() || !isTagColor(rawColor)) return null
    const name = rawName.trim()
    const key = name.toLocaleLowerCase()
    if (tagByNormalizedName.has(key)) return null
    const requestedId = typeof rawId === 'string' ? rawId.trim() : ''
    if (!requestedId || usedTagIds.has(requestedId)) return null
    const id = requestedId
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
    const storedTag = value as {
      id?: unknown
      name?: unknown
      color?: unknown
    }
    if (!addTag(storedTag.id, storedTag.name, storedTag.color)) hasInvalidTag = true
  })
  if (hasInvalidTag) return null

  const availableTagIds = new Set(tags.map((tag) => tag.id))
  if (
    accounts.some(
      (account) =>
        account.tagIds.some((tagId) => !availableTagIds.has(tagId)) ||
        account.positions.some((position) =>
          position.tagIds.some((tagId) => !availableTagIds.has(tagId))
        )
    )
  )
    return null

  return {
    id: storedWorkspace.id,
    name: storedWorkspace.name.trim(),
    baseCurrency: normalizeBaseCurrency(storedWorkspace.baseCurrency),
    exchangeRateProvider: normalizeExchangeRateProvider(storedWorkspace.exchangeRateProvider),
    exchangeRateRefreshIntervalMinutes: normalizeExchangeRateRefreshInterval(
      storedWorkspace.exchangeRateRefreshIntervalMinutes
    ),
    stockQuoteProvider: normalizeStockQuoteProvider(storedWorkspace.stockQuoteProvider),
    cryptoQuoteProvider: normalizeCryptoQuoteProvider(storedWorkspace.cryptoQuoteProvider),
    tags,
    accounts
  }
}

export function normalizeStoredData(input: unknown): AppData | null {
  if (!input || typeof input !== 'object') return null
  const value = input as {
    version?: unknown
    activeWorkspaceId?: unknown
    workspaces?: unknown
    snapshots?: unknown
  }
  if (value.version !== 1 || !Array.isArray(value.workspaces) || !Array.isArray(value.snapshots))
    return null

  const workspaces = value.workspaces.flatMap((workspace) => {
    const normalized = normalizeStoredWorkspace(workspace)
    return normalized ? [normalized] : []
  })
  if (workspaces.length !== value.workspaces.length) return null
  const workspaceIds = new Set(workspaces.map((workspace) => workspace.id))
  if (workspaceIds.size !== workspaces.length) return null
  if (
    (workspaces.length === 0 && value.activeWorkspaceId !== null) ||
    (workspaces.length > 0 &&
      (typeof value.activeWorkspaceId !== 'string' || !workspaceIds.has(value.activeWorkspaceId)))
  )
    return null
  const activeWorkspaceId = workspaces.some((workspace) => workspace.id === value.activeWorkspaceId)
    ? (value.activeWorkspaceId as string)
    : (workspaces[0]?.id ?? null)

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
    if (storedSnapshot.exchangeRates !== undefined && !exchangeRates) return []
    usedSnapshotIds.add(storedSnapshot.id)
    return [
      {
        id: storedSnapshot.id,
        workspaceId: storedSnapshot.workspaceId,
        createdAt: storedSnapshot.createdAt,
        workspace,
        ...(exchangeRates ? { exchangeRates } : {})
      }
    ]
  })
  if (snapshots.length !== value.snapshots.length) return null

  snapshots.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
  return { version: 1, activeWorkspaceId, workspaces, snapshots }
}

export function parseStoredData(raw: string): AppData | null {
  try {
    return normalizeStoredData(JSON.parse(raw))
  } catch {
    return null
  }
}
