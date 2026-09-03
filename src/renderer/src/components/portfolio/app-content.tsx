import { AccountDetail, type AccountSyncState } from './account-detail'
import { ExampleWorkspaceBanner, HistoricalVersionBanner } from './page-shell'
import { Overview } from './overview'
import { TagDetail } from './tag-detail'
import { TimeMachine } from './time-machine'
import type { ExchangeRateView } from './view-helpers'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Account, Position, Tag, Workspace, WorkspaceSnapshot } from '@/lib/portfolio'
import { cn } from '@/lib/utils'

type AppContentProps = {
  workspace: Workspace
  latestWorkspace: Workspace | null
  activeSnapshots: WorkspaceSnapshot[]
  selectedSnapshot: WorkspaceSnapshot | null
  selectedSnapshotId: string | null
  selectedAccount: Account | null
  selectedTag: Tag | null
  viewingExampleWorkspace: boolean
  showTimeMachine: boolean
  readOnly: boolean
  exchangeRates: ExchangeRateView
  liveExchangeRates: ExchangeRateView
  creatingSnapshot: boolean
  syncState?: AccountSyncState
  onExitExampleWorkspace: () => void
  onReturnLatest: () => void
  onCreateSnapshot: () => Promise<void>
  onViewLatest: () => void
  onViewSnapshot: (snapshotId: string) => void
  onDeleteSnapshot: (snapshot: WorkspaceSnapshot) => void
  onOpenAccount: (accountId: string) => void
  onAddPosition: () => void
  onEditAccount: () => void
  onSyncAccount: () => Promise<void>
  onManagePositionTags: (position: Position) => void
  onEditPosition: (position: Position) => void
  onDeletePosition: (position: Position) => void
}

export function AppContent({
  workspace,
  latestWorkspace,
  activeSnapshots,
  selectedSnapshot,
  selectedSnapshotId,
  selectedAccount,
  selectedTag,
  viewingExampleWorkspace,
  showTimeMachine,
  readOnly,
  exchangeRates,
  liveExchangeRates,
  creatingSnapshot,
  syncState,
  onExitExampleWorkspace,
  onReturnLatest,
  onCreateSnapshot,
  onViewLatest,
  onViewSnapshot,
  onDeleteSnapshot,
  onOpenAccount,
  onAddPosition,
  onEditAccount,
  onSyncAccount,
  onManagePositionTags,
  onEditPosition,
  onDeletePosition
}: AppContentProps) {
  return (
    <div
      data-slot="app-content"
      className="flex min-w-0 flex-1 flex-col overflow-hidden border-l border-border bg-background"
    >
      <ScrollArea className="min-h-0 min-w-0 flex-1">
        <main
          className={cn('min-h-full transition-colors', selectedSnapshot && 'bg-muted/10')}
          aria-label={
            viewingExampleWorkspace
              ? '示例工作区，只读'
              : selectedSnapshot
                ? '历史快照，只读'
                : undefined
          }
        >
          {viewingExampleWorkspace && <ExampleWorkspaceBanner onExit={onExitExampleWorkspace} />}
          {selectedSnapshot && !showTimeMachine && (
            <HistoricalVersionBanner
              snapshotId={selectedSnapshot.id}
              createdAt={selectedSnapshot.createdAt}
              onReturnLatest={onReturnLatest}
              className={viewingExampleWorkspace ? 'pt-3' : undefined}
            />
          )}
          {showTimeMachine ? (
            <TimeMachine
              workspace={latestWorkspace ?? workspace}
              snapshots={activeSnapshots}
              readOnly={viewingExampleWorkspace}
              selectedSnapshotId={selectedSnapshotId}
              liveExchangeRates={liveExchangeRates}
              creating={creatingSnapshot}
              onCreate={onCreateSnapshot}
              onViewLatest={onViewLatest}
              onViewSnapshot={onViewSnapshot}
              onDeleteSnapshot={onDeleteSnapshot}
            />
          ) : selectedTag ? (
            <TagDetail
              workspace={workspace}
              tag={selectedTag}
              exchangeRates={exchangeRates}
              onOpenAccount={onOpenAccount}
            />
          ) : selectedAccount ? (
            <AccountDetail
              account={selectedAccount}
              tags={workspace.tags}
              readOnly={readOnly}
              baseCurrency={workspace.baseCurrency}
              exchangeRates={exchangeRates}
              onAddPosition={onAddPosition}
              onEditAccount={onEditAccount}
              onSync={onSyncAccount}
              syncState={syncState}
              onManagePositionTags={onManagePositionTags}
              onEditPosition={onEditPosition}
              onDeletePosition={onDeletePosition}
            />
          ) : (
            <Overview
              workspace={workspace}
              exchangeRates={exchangeRates}
              onOpenAccount={onOpenAccount}
            />
          )}
        </main>
      </ScrollArea>
    </div>
  )
}
