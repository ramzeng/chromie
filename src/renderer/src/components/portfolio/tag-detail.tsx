import {
  AssetDistributionCharts,
  createPositionAllocationItems
} from '@/components/portfolio/asset-allocation-chart'
import {
  AccountTable,
  PortfolioPositionTable
} from '@/components/portfolio/overview'
import { PortfolioPage, PortfolioPageHeader } from '@/components/portfolio/page-shell'
import { TableEmptyState } from '@/components/portfolio/table-empty-state'
import { ValueSummaryCard } from '@/components/portfolio/value-summary-card'
import { type ExchangeRateView } from '@/components/portfolio/view-helpers'
import { type Tag, type Workspace } from '@/lib/portfolio'

export function TagDetail({
  workspace,
  tag,
  exchangeRates,
  onOpenAccount
}: {
  workspace: Workspace
  tag: Tag
  exchangeRates: ExchangeRateView
  onOpenAccount: (accountId: string) => void
}) {
  const taggedAccounts = workspace.accounts.filter((account) =>
    account.tagIds.includes(tag.id)
  )
  const taggedPositionRows = workspace.accounts.flatMap((account) =>
    account.positions
      .filter((position) => position.tagIds.includes(tag.id))
      .map((position) => ({ account, position }))
  )
  const allocationAccounts = workspace.accounts.flatMap((account) => {
    const positions = account.positions.filter(
      (position) =>
        account.tagIds.includes(tag.id) || position.tagIds.includes(tag.id)
    )
    return positions.length ? [{ ...account, positions }] : []
  })
  const positions = allocationAccounts.flatMap((account) => account.positions)

  return (
    <PortfolioPage>
      <PortfolioPageHeader>
        <div className="min-w-0 flex-[1_1_20rem]">
          <h1 className="truncate text-2xl font-semibold tracking-[-0.035em]">
            {tag.name}
          </h1>
          {tag.note && (
            <p className="mt-1 max-w-3xl whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
              {tag.note}
            </p>
          )}
        </div>
      </PortfolioPageHeader>

      <section className="mt-5">
        <ValueSummaryCard
          positions={positions}
          baseCurrency={workspace.baseCurrency}
          exchangeRates={exchangeRates}
        />
      </section>

      {positions.length > 0 && (
        <section className="mt-6">
          <AssetDistributionCharts
            positions={positions}
            breakdownItems={createPositionAllocationItems(
              positions,
              allocationAccounts
            )}
            breakdownTitle="持仓市值分布"
            breakdownDimensionLabel="持仓"
            baseCurrency={workspace.baseCurrency}
            rates={exchangeRates.snapshot?.rates}
          />
        </section>
      )}

      <div className="mt-6 flex flex-col gap-6">
        {taggedAccounts.length ? (
          <AccountTable
            accounts={taggedAccounts}
            tags={workspace.tags}
            baseCurrency={workspace.baseCurrency}
            exchangeRates={exchangeRates}
            onOpen={onOpenAccount}
          />
        ) : (
          <TableEmptyState>暂无账户</TableEmptyState>
        )}
        <PortfolioPositionTable
          rows={taggedPositionRows}
          tags={workspace.tags}
          baseCurrency={workspace.baseCurrency}
          exchangeRates={exchangeRates}
          onOpenAccount={onOpenAccount}
        />
      </div>
    </PortfolioPage>
  )
}
