import type {
  Account,
  PortfolioPriceRefreshResponse,
  PortfolioSyncResponse
} from '../../../shared/portfolio'

const MAX_CONCURRENT_ACCOUNT_SYNCS = 2

export type AccountPositionPriceSyncResult = {
  accountId: string
  successCount: number
  failureCount: number
  error?: string
}

export type PositionPriceSyncOperations = {
  syncAccount: (
    workspaceId: string,
    accountId: string
  ) => Promise<PortfolioSyncResponse>
  refreshPositionPrices: (
    workspaceId: string,
    accountId: string
  ) => Promise<PortfolioPriceRefreshResponse>
}

function cleanOperationError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/^Error invoking remote method '[^']+': Error: /, '')
}

async function syncAccountPositionPrices(
  workspaceId: string,
  account: Account,
  operations: PositionPriceSyncOperations
): Promise<AccountPositionPriceSyncResult> {
  try {
    if (account.sync) {
      const result = await operations.syncAccount(workspaceId, account.id)
      return {
        accountId: account.id,
        successCount: result.positionCount,
        failureCount: 0
      }
    }

    const result = await operations.refreshPositionPrices(
      workspaceId,
      account.id
    )
    return {
      accountId: account.id,
      successCount: result.refreshedCount,
      failureCount:
        result.notFoundCount +
        result.unavailableCount +
        result.conflictCount
    }
  } catch (error) {
    return {
      accountId: account.id,
      successCount: 0,
      failureCount: account.positions.length,
      error: cleanOperationError(error)
    }
  }
}

export async function syncPositionPricesForAccounts({
  workspaceId,
  accounts,
  operations,
  onAccountStarted,
  onAccountCompleted
}: {
  workspaceId: string
  accounts: Account[]
  operations: PositionPriceSyncOperations
  onAccountStarted?: (accountId: string) => void
  onAccountCompleted?: (result: AccountPositionPriceSyncResult) => void
}): Promise<AccountPositionPriceSyncResult[]> {
  const results = new Array<AccountPositionPriceSyncResult>(accounts.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < accounts.length) {
      const index = nextIndex
      nextIndex += 1
      const account = accounts[index]
      onAccountStarted?.(account.id)
      const result = await syncAccountPositionPrices(
        workspaceId,
        account,
        operations
      )
      results[index] = result
      onAccountCompleted?.(result)
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(MAX_CONCURRENT_ACCOUNT_SYNCS, accounts.length) },
      () => worker()
    )
  )
  return results
}
