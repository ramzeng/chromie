import {
  ArrowLeftRight,
  ChartSpline,
  ChevronUp,
  History,
  LogOut,
  Plus,
  Settings
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CHROMIE_LOGO_URL } from '@/lib/brand'
import type { Account, Tag, Workspace } from '@/lib/portfolio'
import { cn } from '@/lib/utils'
import {
  AccountNavigation,
  SELECTED_NAVIGATION_CLASS_NAME,
  TagNavigation
} from './portfolio-navigation'

type AppSidebarProps = {
  workspace: Workspace
  readOnly: boolean
  viewingExampleWorkspace: boolean
  selectedSnapshotId: string | null
  selectedAccountId: string | null
  selectedTagId: string | null
  showTimeMachine: boolean
  onExitExampleWorkspace: () => void
  onOpenWorkspaceSettings: () => void
  onShowOverview: () => void
  onShowTimeMachine: () => void
  onAddAccount: () => void
  onSelectAccount: (account: Account) => void
  onEditAccount: (account: Account) => void
  onDeleteAccount: (account: Account) => void
  onAddTag: () => void
  onSelectTag: (tag: Tag) => void
  onEditTag: (tag: Tag) => void
  onDeleteTag: (tag: Tag) => void
  onCreateWorkspace: () => void
  onSwitchWorkspace: () => void
}

export function AppSidebar({
  workspace,
  readOnly,
  viewingExampleWorkspace,
  selectedSnapshotId,
  selectedAccountId,
  selectedTagId,
  showTimeMachine,
  onExitExampleWorkspace,
  onOpenWorkspaceSettings,
  onShowOverview,
  onShowTimeMachine,
  onAddAccount,
  onSelectAccount,
  onEditAccount,
  onDeleteAccount,
  onAddTag,
  onSelectTag,
  onEditTag,
  onDeleteTag,
  onCreateWorkspace,
  onSwitchWorkspace
}: AppSidebarProps) {
  const workspaceSwitcher = viewingExampleWorkspace ? (
    <Button
      variant="ghost"
      className="h-auto w-full justify-start gap-3 px-2 py-2"
      title="退出示例工作区"
      onClick={onExitExampleWorkspace}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-sm bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
        {workspace.name.trim().slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">
        {workspace.name}
      </span>
      <LogOut data-icon="inline-end" />
    </Button>
  ) : (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto w-full justify-start gap-3 px-2 py-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-sm bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
            {workspace.name.trim().slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">
            {workspace.name}
          </span>
          <ChevronUp data-icon="inline-end" className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[var(--radix-dropdown-menu-trigger-width)]"
        side="top"
        align="start"
      >
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onCreateWorkspace}>
            <Plus />
            新建工作区
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onSwitchWorkspace}>
            <ArrowLeftRight />
            切换工作区
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <aside
      data-slot="app-sidebar"
      className="flex w-64 shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground"
    >
      <div className="flex h-full w-64 min-w-64 flex-col overflow-hidden">
        <div className="window-drag shrink-0 pt-8">
          <div className="flex h-10 items-center gap-2 px-4">
            <span className="grid size-6 shrink-0 place-items-center">
              <img
                className="size-6 object-contain invert"
                src={CHROMIE_LOGO_URL}
                alt=""
                aria-hidden="true"
              />
            </span>
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[-0.02em]">
              Chromie
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="-mr-1 shrink-0"
              disabled={readOnly}
              aria-label="工作区设置"
              title={
                viewingExampleWorkspace
                  ? '示例工作区为只读'
                  : selectedSnapshotId
                    ? '历史版本中无法修改工作区设置'
                    : '工作区设置'
              }
              onClick={onOpenWorkspaceSettings}
            >
              <Settings data-icon="icon-only" />
            </Button>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <nav className="px-3 pb-4 pt-2">
            <div className="mb-4 grid gap-1">
              <Button
                variant="ghost"
                className={cn(
                  'w-full justify-start px-3 font-normal',
                  !selectedAccountId &&
                    !selectedTagId &&
                    !showTimeMachine &&
                    cn(SELECTED_NAVIGATION_CLASS_NAME, 'font-medium')
                )}
                onClick={onShowOverview}
              >
                <ChartSpline />
                资产概览
              </Button>
              <Button
                variant="ghost"
                className={cn(
                  'w-full justify-start px-3 font-normal',
                  showTimeMachine && cn(SELECTED_NAVIGATION_CLASS_NAME, 'font-medium')
                )}
                onClick={onShowTimeMachine}
              >
                <History />
                时间机器
              </Button>
            </div>

            <div className="mb-2 flex items-center gap-1">
              <p className="flex h-7 min-w-0 flex-1 items-center px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                账户
              </p>
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="添加账户"
                  title="添加账户"
                  onClick={onAddAccount}
                >
                  <Plus data-icon="icon-only" />
                </Button>
              )}
            </div>
            <AccountNavigation
              key={workspace.id}
              accounts={workspace.accounts}
              readOnly={readOnly}
              selectedAccountId={selectedAccountId}
              onSelect={onSelectAccount}
              onEdit={onEditAccount}
              onDelete={onDeleteAccount}
            />

            <div className="mb-2 mt-5 flex items-center gap-1">
              <p className="flex h-7 min-w-0 flex-1 items-center px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                标签
              </p>
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="添加标签"
                  title="添加标签"
                  onClick={onAddTag}
                >
                  <Plus data-icon="icon-only" />
                </Button>
              )}
            </div>
            <TagNavigation
              key={`${workspace.id}:${selectedSnapshotId ?? 'latest'}`}
              tags={workspace.tags}
              readOnly={readOnly}
              selectedTagId={selectedTagId}
              onSelect={onSelectTag}
              onEdit={onEditTag}
              onDelete={onDeleteTag}
            />
          </nav>
        </ScrollArea>

        <div className="px-3 py-3">{workspaceSwitcher}</div>
      </div>
    </aside>
  )
}
