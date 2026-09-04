import { Ellipsis, Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription } from '@/components/ui/empty'
import { cn } from '@/lib/utils'
import type { Account, Tag } from '@/lib/portfolio'
import { TagColorDot } from './tag-badge'
import { AccountTypeIcon } from './view-helpers'

export const SELECTED_NAVIGATION_CLASS_NAME =
  'bg-sidebar-accent text-sidebar-accent-foreground'

function NavigationEmptyState({ label }: { label: string }) {
  return (
    <Empty className="min-h-10 gap-0 p-2 md:p-2">
      <EmptyDescription className="text-xs/5">{label}</EmptyDescription>
    </Empty>
  )
}

export function AccountNavigation({
  accounts,
  readOnly,
  selectedAccountId,
  onSelect,
  onEdit,
  onDelete
}: {
  accounts: Account[]
  readOnly: boolean
  selectedAccountId: string | null
  onSelect: (account: Account) => void
  onEdit: (account: Account) => void
  onDelete: (account: Account) => void
}) {
  return (
    <div className="grid min-w-0 gap-1">
      {!accounts.length && <NavigationEmptyState label="暂无账户" />}
      {accounts.map((account) => {
        const selected = selectedAccountId === account.id
        return (
          <div
            key={account.id}
            className={cn(
              'group flex min-w-0 items-center rounded-sm pr-1 transition-colors hover:bg-muted/70',
              selected && SELECTED_NAVIGATION_CLASS_NAME
            )}
          >
            <Button
              variant="ghost"
              className={cn(
                'h-auto min-w-0 flex-1 justify-start gap-3 px-3 py-2.5 font-normal hover:bg-transparent',
                selected && 'font-medium'
              )}
              onClick={() => onSelect(account)}
            >
              <AccountTypeIcon type={account.type} className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-left">{account.name}</span>
            </Button>
            {!readOnly && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100',
                      selected && 'opacity-100'
                    )}
                    aria-label={`${account.name}操作`}
                  >
                    <Ellipsis data-icon="icon-only" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-18">
                  <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={() => onEdit(account)}>
                      <Pencil className="size-4" />
                      编辑
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => onDelete(account)}>
                      <Trash2 className="size-4" />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function TagNavigation({
  tags,
  readOnly,
  selectedTagId,
  onSelect,
  onEdit,
  onDelete
}: {
  tags: Tag[]
  readOnly: boolean
  selectedTagId: string | null
  onSelect: (tag: Tag) => void
  onEdit: (tag: Tag) => void
  onDelete: (tag: Tag) => void
}) {
  return (
    <div className="grid min-w-0 gap-1">
      {!tags.length && <NavigationEmptyState label="暂无标签" />}
      {tags.map((tag) => {
        const selected = selectedTagId === tag.id
        return (
          <div
            key={tag.id}
            className={cn(
              'group flex min-w-0 items-center rounded-sm pr-1 transition-colors hover:bg-muted/70',
              selected && SELECTED_NAVIGATION_CLASS_NAME
            )}
          >
            <Button
              variant="ghost"
              className={cn(
                'h-auto min-w-0 flex-1 justify-start gap-3 px-3 py-2.5 font-normal hover:bg-transparent',
                selected && 'font-medium'
              )}
              onClick={() => onSelect(tag)}
            >
              <TagColorDot color={tag.color} />
              <span className="min-w-0 flex-1 truncate text-left">{tag.name}</span>
            </Button>
            {!readOnly && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100',
                      selected && 'opacity-100'
                    )}
                    aria-label={`${tag.name}操作`}
                  >
                    <Ellipsis data-icon="icon-only" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-18">
                  <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={() => onEdit(tag)}>
                      <Pencil className="size-4" />
                      编辑
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => onDelete(tag)}>
                      <Trash2 className="size-4" />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )
      })}
    </div>
  )
}
