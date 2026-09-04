import {
  DEFAULT_CRYPTO_QUOTE_PROVIDER,
  DEFAULT_STOCK_QUOTE_PROVIDER
} from '../../shared/asset-quotes'
import {
  DEFAULT_EXCHANGE_RATE_PROVIDER,
  DEFAULT_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  type ExchangeRateSnapshot
} from '../../shared/exchange-rates'
import { type AccountIntegration, type IntegrationData } from '../../shared/integrations'
import {
  DEFAULT_SYNC_INTERVAL,
  marketMeta,
  type Account,
  type AccountInput,
  type AppData,
  type PositionInput,
  type Tag,
  type TagInput,
  type Workspace,
  type WorkspaceInput,
  type WorkspaceSettingsInput,
  type WorkspaceSnapshot
} from '../../shared/portfolio'

import {
  createId,
  normalizeAccountSync,
  normalizeAccountType,
  normalizeBaseCurrency,
  normalizeCryptoQuoteProvider,
  normalizeExchangeRateProvider,
  normalizeExchangeRateRefreshInterval,
  normalizePosition,
  normalizeStockQuoteProvider,
  normalizeTagIds,
  resolveIntegrationInput,
  uniqueAccountName
} from './portfolio-data'

type PortfolioDataUpdater = (update: AppData | ((current: AppData) => AppData)) => void
type IntegrationDataUpdater = (
  update: IntegrationData | ((current: IntegrationData) => IntegrationData)
) => void

export function createPortfolioOperations(
  data: AppData,
  setData: PortfolioDataUpdater,
  integrationData: IntegrationData,
  setIntegrationData: IntegrationDataUpdater
) {
  function setAccountIntegration(accountId: string, integration: AccountIntegration | null): void {
    setIntegrationData((current) => ({
      ...current,
      integrations: integration
        ? [...current.integrations.filter((item) => item.accountId !== accountId), integration]
        : current.integrations.filter((item) => item.accountId !== accountId)
    }))
  }

  function createSnapshot(
    workspaceId: string,
    exchangeRates?: ExchangeRateSnapshot | null
  ): string {
    const workspace = data.workspaces.find((item) => item.id === workspaceId)
    if (!workspace) throw new Error('没有找到对应的工作区')
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
    if (!data.snapshots.some((snapshot) => snapshot.id === snapshotId)) {
      throw new Error('没有找到对应的快照')
    }
    setData((current) => ({
      ...current,
      snapshots: current.snapshots.filter((snapshot) => snapshot.id !== snapshotId)
    }))
  }

  function setActiveWorkspace(id: string): void {
    if (!data.workspaces.some((workspace) => workspace.id === id)) {
      throw new Error('没有找到对应的工作区')
    }
    setData((current) => ({ ...current, activeWorkspaceId: id }))
  }

  function createWorkspace(input: WorkspaceInput): string {
    const workspace: Workspace = {
      id: createId(),
      name: input.name.trim(),
      baseCurrency: normalizeBaseCurrency(input.baseCurrency),
      exchangeRateProvider: DEFAULT_EXCHANGE_RATE_PROVIDER,
      exchangeRateRefreshIntervalMinutes: DEFAULT_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
      stockQuoteProvider: DEFAULT_STOCK_QUOTE_PROVIDER,
      cryptoQuoteProvider: DEFAULT_CRYPTO_QUOTE_PROVIDER,
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
    if (!data.workspaces.some((workspace) => workspace.id === id)) {
      throw new Error('没有找到对应的工作区')
    }
    setData((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === id
          ? {
              ...workspace,
              name: input.name.trim(),
              baseCurrency: normalizeBaseCurrency(input.baseCurrency),
              exchangeRateProvider: normalizeExchangeRateProvider(input.exchangeRateProvider),
              exchangeRateRefreshIntervalMinutes: normalizeExchangeRateRefreshInterval(
                input.exchangeRateRefreshIntervalMinutes
              ),
              stockQuoteProvider: normalizeStockQuoteProvider(input.stockQuoteProvider),
              cryptoQuoteProvider: normalizeCryptoQuoteProvider(input.cryptoQuoteProvider)
            }
          : workspace
      )
    }))
  }

  function deleteWorkspace(id: string): void {
    if (!data.workspaces.some((workspace) => workspace.id === id)) {
      throw new Error('没有找到对应的工作区')
    }
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
        snapshots: current.snapshots.filter((snapshot) => snapshot.workspaceId !== id)
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
    const tag: Tag = {
      id: createId(),
      name,
      color: input.color,
      note: input.note.trim()
    }
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
    if (
      workspace.tags.some(
        (tag) => tag.id !== tagId && tag.name.toLocaleLowerCase() === name.toLocaleLowerCase()
      )
    )
      throw new Error(`标签“${name}”已存在`)
    setData((current) => ({
      ...current,
      workspaces: current.workspaces.map((item) =>
        item.id === workspaceId
          ? {
              ...item,
              tags: item.tags.map((tag) =>
                tag.id === tagId
                  ? { ...tag, name, color: input.color, note: input.note.trim() }
                  : tag
              )
            }
          : item
      )
    }))
  }

  function deleteTag(workspaceId: string, tagId: string): void {
    const workspace = data.workspaces.find((item) => item.id === workspaceId)
    if (!workspace?.tags.some((tag) => tag.id === tagId)) {
      throw new Error('没有找到对应的标签')
    }
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

  function setAccountTags(workspaceId: string, accountId: string, tagIds: string[]): void {
    const workspace = data.workspaces.find((item) => item.id === workspaceId)
    if (!workspace) throw new Error('没有找到对应的工作区')
    if (!workspace.accounts.some((account) => account.id === accountId)) {
      throw new Error('没有找到对应的账户')
    }
    const normalized = validateTagIds(workspace, tagIds)
    if (!normalized) throw new Error('部分标签已不存在，请重新选择')
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
  }

  function setPositionTags(
    workspaceId: string,
    accountId: string,
    positionId: string,
    tagIds: string[]
  ): void {
    const workspace = data.workspaces.find((item) => item.id === workspaceId)
    if (!workspace) throw new Error('没有找到对应的工作区')
    const account = workspace.accounts.find((item) => item.id === accountId)
    if (!account) throw new Error('没有找到对应的账户')
    if (!account.positions.some((position) => position.id === positionId)) {
      throw new Error('没有找到对应的持仓')
    }
    const normalized = validateTagIds(workspace, tagIds)
    if (!normalized) throw new Error('部分标签已不存在，请重新选择')
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
                        position.id === positionId ? { ...position, tagIds: normalized } : position
                      )
                    }
                  : account
              )
            }
          : item
      )
    }))
  }

  function createAccount(workspaceId: string, input: AccountInput): string {
    const type = normalizeAccountType(input.type) ?? 'Futu'
    const workspace = data.workspaces.find((workspace) => workspace.id === workspaceId)
    if (!workspace) throw new Error('没有找到对应的工作区')
    const name = uniqueAccountName(workspace, input.name)
    const accountId = createId()
    const integration = resolveIntegrationInput(input.integration, accountId)
    if (input.integration && (!integration || integration.provider !== type)) {
      throw new Error('同步配置与账户类型不匹配')
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
      name,
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

  function updateAccount(workspaceId: string, accountId: string, input: AccountInput): void {
    const type = normalizeAccountType(input.type) ?? 'Futu'
    const workspace = data.workspaces.find((workspace) => workspace.id === workspaceId)
    if (!workspace) throw new Error('没有找到对应的工作区')
    if (!workspace.accounts.some((workspace) => workspace.id === accountId)) {
      throw new Error('没有找到对应的账户')
    }
    const existingIntegration = integrationData.integrations.find(
      (item) => item.accountId === accountId
    )
    const integration = resolveIntegrationInput(input.integration, accountId, existingIntegration)
    if (input.integration && (!integration || integration.provider !== type)) {
      throw new Error('同步配置与账户类型不匹配')
    }
    const sync = integration
      ? (normalizeAccountSync(input.sync, type) ?? {
          interval: DEFAULT_SYNC_INTERVAL
        })
      : undefined
    const existingAccount = workspace.accounts.find((account) => account.id === accountId)!
    const name = uniqueAccountName(workspace, input.name, accountId)
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
                      name,
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
    const workspace = data.workspaces.find((item) => item.id === workspaceId)
    if (!workspace) throw new Error('没有找到对应的工作区')
    if (!workspace.accounts.some((account) => account.id === accountId)) {
      throw new Error('没有找到对应的账户')
    }
    setData((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) => {
        if (workspace.id !== workspaceId) return workspace
        return {
          ...workspace,
          accounts: workspace.accounts.filter((account) => account.id !== accountId)
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
  ): void {
    const workspace = data.workspaces.find((item) => item.id === workspaceId)
    const account = workspace?.accounts.find((item) => item.id === accountId)
    if (!account) throw new Error('没有找到对应的账户')
    if (account.sync) throw new Error('自动同步的账户不能手动修改持仓')
    if (positionId && !account.positions.some((item) => item.id === positionId)) {
      throw new Error('没有找到对应的持仓')
    }
    const existingPosition = account.positions.find((item) => item.id === positionId)
    const tagIds = validateTagIds(workspace!, input.tagIds ?? existingPosition?.tagIds ?? [])
    if (!tagIds) throw new Error('部分标签已不存在，请重新选择')
    const position = normalizePosition({ ...input, tagIds }, positionId)

    const duplicate = account.positions.some(
      (item) =>
        item.id !== position.id &&
        item.market === position.market &&
        item.symbol.toUpperCase() === position.symbol
    )
    if (duplicate) {
      throw new Error(`${marketMeta[position.market].label} ${position.symbol} 已存在`)
    }

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
  }

  function deletePosition(workspaceId: string, accountId: string, positionId: string): void {
    const workspace = data.workspaces.find((item) => item.id === workspaceId)
    if (!workspace) throw new Error('没有找到对应的工作区')
    const account = workspace.accounts.find((item) => item.id === accountId)
    if (!account) throw new Error('没有找到对应的账户')
    if (account.sync) throw new Error('自动同步的账户不能手动修改持仓')
    if (!account.positions.some((position) => position.id === positionId)) {
      throw new Error('没有找到对应的持仓')
    }
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
                      positions: account.positions.filter((position) => position.id !== positionId)
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
        const targetAccount = workspace.accounts.find((account) => account.id === accountId)
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

  function importWorkspace(
    input: Workspace,
    snapshots: WorkspaceSnapshot[] = [],
    integrations: AccountIntegration[] = []
  ): string {
    const tagIdMap = new Map(input.tags.map((tag) => [tag.id, createId()] as const))
    const accountIdMap = new Map(input.accounts.map((account) => [account.id, createId()] as const))
    const positionIdMap = new Map(
      input.accounts.flatMap((account) =>
        account.positions.map((position) => [position.id, createId()] as const)
      )
    )
    const accountTypes = new Map(input.accounts.map((account) => [account.id, account.type]))
    const importedIntegrations = integrations.flatMap((integration) => {
      const importedAccountId = accountIdMap.get(integration.accountId)
      if (!importedAccountId || accountTypes.get(integration.accountId) !== integration.provider) {
        return []
      }
      return [{ ...structuredClone(integration), accountId: importedAccountId }]
    })
    const integratedAccountIds = new Set(
      importedIntegrations.map((integration) => integration.accountId)
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
        sync: integratedAccountIds.has(accountIdMap.get(account.id)!)
          ? (account.sync ?? { interval: DEFAULT_SYNC_INTERVAL })
          : undefined,
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
    setIntegrationData((current) => ({
      version: 1,
      integrations: [...current.integrations, ...importedIntegrations]
    }))
    return workspace.id
  }

  return {
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
    importWorkspace
  }
}
