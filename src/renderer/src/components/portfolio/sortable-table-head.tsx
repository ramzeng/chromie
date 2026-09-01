import { useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type SortDirection = 'asc' | 'desc'

export type TableSort<Key extends string> = {
  key: Key
  direction: SortDirection
}

export function useTableSort<Key extends string>(
  initialKey: Key,
  initialDirection: SortDirection = 'asc'
): [TableSort<Key>, (key: Key, defaultDirection?: SortDirection) => void] {
  const [sort, setSort] = useState<TableSort<Key>>({
    key: initialKey,
    direction: initialDirection
  })

  function changeSort(key: Key, defaultDirection: SortDirection = 'asc'): void {
    setSort((current) => ({
      key,
      direction:
        current.key === key
          ? current.direction === 'asc' ? 'desc' : 'asc'
          : defaultDirection
    }))
  }

  return [sort, changeSort]
}

export function compareText(
  left: string,
  right: string,
  direction: SortDirection
): number {
  const comparison = left.localeCompare(right, 'zh-CN', {
    numeric: true,
    sensitivity: 'base'
  })
  return direction === 'asc' ? comparison : -comparison
}

export function compareOptionalNumbers(
  left: number | undefined,
  right: number | undefined,
  direction: SortDirection
): number {
  if (left === undefined) return right === undefined ? 0 : 1
  if (right === undefined) return -1
  return direction === 'asc' ? left - right : right - left
}

export function SortableTableHead<Key extends string>({
  sortKey,
  sort,
  onSort,
  defaultDirection = 'asc',
  align = 'left',
  className,
  children
}: {
  sortKey: Key
  sort: TableSort<Key>
  onSort: (key: Key, defaultDirection?: SortDirection) => void
  defaultDirection?: SortDirection
  align?: 'left' | 'right'
  className?: string
  children: React.ReactNode
}) {
  const active = sort.key === sortKey
  const ariaSort = active
    ? sort.direction === 'asc' ? 'ascending' : 'descending'
    : 'none'
  const SortIcon = !active
    ? ArrowUpDown
    : sort.direction === 'asc' ? ArrowUp : ArrowDown

  return (
    <TableHead
      aria-sort={ariaSort}
      className={cn(align === 'right' && 'text-right', className)}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          'h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground',
          align === 'left' ? '-ml-2' : '-mr-2 ml-auto'
        )}
        onClick={() => onSort(sortKey, defaultDirection)}
      >
        {children}
        <SortIcon data-icon="inline-end" aria-hidden="true" />
      </Button>
    </TableHead>
  )
}
