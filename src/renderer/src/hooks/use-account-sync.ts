import { useEffect, useRef, useState } from 'react'

import type { AccountSyncState } from '@/components/portfolio/account-detail'
import { reportPortfolioError } from '@/components/portfolio/feedback'
import { accountSyncInterval } from '@/components/portfolio/view-helpers'
import type { Workspace } from '@/lib/portfolio'

export function useAccountSync({
  workspace,
  readOnly,
  syncPortfolioAccount
}: {
  workspace: Workspace | null
  readOnly: boolean
  syncPortfolioAccount: (
    workspaceId: string,
    accountId: string
  ) => Promise<unknown>
}) {
  const [syncStates, setSyncStates] = useState<Record<string, AccountSyncState>>({})
  const syncingAccountIds = useRef(new Set<string>())

  async function syncAccount(accountId: string): Promise<void> {
    if (!workspace || readOnly || syncingAccountIds.current.has(accountId)) return
    const account = workspace.accounts.find((item) => item.id === accountId)
    if (!account?.sync) return

    syncingAccountIds.current.add(accountId)
    setSyncStates((current) => ({
      ...current,
      [accountId]: { status: 'syncing' }
    }))
    try {
      await syncPortfolioAccount(workspace.id, accountId)
    } catch (error) {
      reportPortfolioError(error, `${account.name} 同步失败`)
    } finally {
      syncingAccountIds.current.delete(accountId)
      setSyncStates((current) => {
        const next = { ...current }
        delete next[accountId]
        return next
      })
    }
  }

  const autoSyncAccounts = readOnly
    ? []
    : workspace?.accounts.flatMap((account) =>
        account.sync
          ? [{ id: account.id, interval: accountSyncInterval(account) }]
          : []
      ) ?? []
  const autoSyncKey = JSON.stringify(autoSyncAccounts)

  useEffect(() => {
    if (!autoSyncAccounts.length) return
    const timers = autoSyncAccounts.map((account) => {
      void syncAccount(account.id)
      return window.setInterval(
        () => void syncAccount(account.id),
        account.interval * 1000
      )
    })
    return () => timers.forEach((timer) => window.clearInterval(timer))
    // Restart timers when an auto-sync account or its connection settings change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id, autoSyncKey])

  return { syncStates, syncAccount }
}
