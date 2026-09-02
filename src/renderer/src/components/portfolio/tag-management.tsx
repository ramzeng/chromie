import { Ellipsis, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { TagDialog } from '@/components/portfolio/dialogs'
import { PortfolioPage, PortfolioPageHeader } from '@/components/portfolio/page-shell'
import { TagColorDot } from '@/components/portfolio/tag-badge'
import { TableEmptyState } from '@/components/portfolio/table-empty-state'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import type { Tag, TagInput, Workspace } from '@/lib/portfolio'

type TagDialogState = { open: boolean; tag?: Tag }

export function TagManagement({
  workspace,
  readOnly,
  onCreate,
  onUpdate,
  onDelete
}: {
  workspace: Workspace
  readOnly: boolean
  onCreate: (input: TagInput) => Promise<void>
  onUpdate: (tagId: string, input: TagInput) => Promise<void>
  onDelete: (tag: Tag) => void
}) {
  const [dialog, setDialog] = useState<TagDialogState>({ open: false })

  return (
    <PortfolioPage>
      <PortfolioPageHeader>
        <div className="min-w-0 flex-[1_1_20rem]">
          <h1 className="truncate text-2xl font-semibold tracking-[-0.035em]">
            标签
          </h1>
        </div>
        {!readOnly && (
          <Button onClick={() => setDialog({ open: true })}>
            <Plus data-icon="inline-start" />
            添加标签
          </Button>
        )}
      </PortfolioPageHeader>

      {workspace.tags.length ? (
        <section className="mt-5 overflow-hidden rounded-sm border border-border/70 bg-card">
          <Table>
            <TableHeader className="bg-muted/15">
              <TableRow className="hover:bg-transparent">
                <TableHead>标签</TableHead>
                {!readOnly && <TableHead className="w-16" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {workspace.tags.map((tag) => (
                <TableRow key={tag.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <TagColorDot color={tag.color} className="size-3" />
                      <span className="font-medium">{tag.name}</span>
                    </div>
                  </TableCell>
                  {!readOnly && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`${tag.name}操作`}>
                            <Ellipsis data-icon="icon-only" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-20">
                          <DropdownMenuGroup>
                            <DropdownMenuItem onSelect={() => setDialog({ open: true, tag })}>
                              <Pencil />
                              编辑
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuGroup>
                            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(tag)}>
                              <Trash2 />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : (
        <TableEmptyState className="mt-5">暂无标签</TableEmptyState>
      )}

      <TagDialog
        open={dialog.open}
        onOpenChange={(open) =>
          setDialog((current) => (open ? { ...current, open } : { open: false }))
        }
        tag={dialog.tag}
        onSubmit={async (input) => {
          if (dialog.tag) await onUpdate(dialog.tag.id, input)
          else await onCreate(input)
        }}
      />
    </PortfolioPage>
  )
}
