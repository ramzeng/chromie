import assert from 'node:assert/strict'
import test from 'node:test'

import type {
  Account,
  PortfolioPriceRefreshResponse,
  PortfolioSyncResponse
} from '../src/shared/portfolio'
import { syncPositionPricesForAccounts } from '../src/renderer/src/lib/position-price-sync'

function account(
  id: string,
  positionCount: number,
  automatic = false
): Account {
  return {
    id,
    name: id,
    type: automatic ? 'Okx' : 'General',
    ...(automatic ? { sync: { interval: 30 } } : {}),
    tagIds: [],
    positions: Array.from({ length: positionCount }, (_, index) => ({
      id: `${id}-position-${index}`,
      market: automatic ? 'CC' : 'US',
      symbol: automatic ? `TOKEN${index}` : `STOCK${index}`,
      name: `Position ${index}`,
      currency: 'USD',
      quantity: 1,
      price: 1,
      tagIds: []
    }))
  }
}

function automaticResult(positionCount: number): PortfolioSyncResponse {
  return {
    positionCount,
    syncedAt: '2026-09-05T01:00:00.000Z'
  }
}

function manualResult(
  refreshedCount: number,
  notFoundCount: number,
  unavailableCount: number,
  conflictCount: number
): PortfolioPriceRefreshResponse {
  return {
    positionCount:
      refreshedCount + notFoundCount + unavailableCount + conflictCount,
    refreshedCount,
    notFoundCount,
    unavailableCount,
    conflictCount,
    completedAt: '2026-09-05T01:00:00.000Z'
  }
}

test('routes automatic accounts to account sync and manual accounts to quote refresh', async () => {
  const calls: string[] = []
  const results = await syncPositionPricesForAccounts({
    workspaceId: 'workspace-1',
    accounts: [account('automatic', 2, true), account('manual', 4)],
    operations: {
      syncAccount: async (workspaceId, accountId) => {
        calls.push(`sync:${workspaceId}:${accountId}`)
        return automaticResult(3)
      },
      refreshPositionPrices: async (workspaceId, accountId) => {
        calls.push(`refresh:${workspaceId}:${accountId}`)
        return manualResult(2, 1, 1, 0)
      }
    }
  })

  assert.deepEqual(calls.sort(), [
    'refresh:workspace-1:manual',
    'sync:workspace-1:automatic'
  ])
  assert.deepEqual(results, [
    {
      accountId: 'automatic',
      successCount: 3,
      failureCount: 0
    },
    {
      accountId: 'manual',
      successCount: 2,
      failureCount: 2
    }
  ])
})

test('keeps syncing other accounts when one account fails', async () => {
  const completed: string[] = []
  const results = await syncPositionPricesForAccounts({
    workspaceId: 'workspace-1',
    accounts: [account('broken', 2, true), account('manual', 1)],
    operations: {
      syncAccount: async () => {
        throw new Error(
          "Error invoking remote method 'portfolio:sync-account': Error: API 不可用"
        )
      },
      refreshPositionPrices: async () => manualResult(1, 0, 0, 0)
    },
    onAccountCompleted: (result) => completed.push(result.accountId)
  })

  assert.deepEqual(completed.sort(), ['broken', 'manual'])
  assert.deepEqual(results, [
    {
      accountId: 'broken',
      successCount: 0,
      failureCount: 2,
      error: 'API 不可用'
    },
    {
      accountId: 'manual',
      successCount: 1,
      failureCount: 0
    }
  ])
})
