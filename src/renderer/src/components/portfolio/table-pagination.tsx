import { useEffect, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Pagination,
  PaginationContent,
  PaginationItem
} from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

const PAGE_SIZE_OPTIONS = [15, 30, 50, 100] as const

export function useTablePagination(
  itemCount: number,
  resetKey?: string | number
) {
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0])
  const pageCount = Math.max(1, Math.ceil(itemCount / pageSize))
  const safePageIndex = Math.min(pageIndex, pageCount - 1)

  useEffect(() => {
    setPageIndex(0)
  }, [resetKey])

  useEffect(() => {
    if (pageIndex !== safePageIndex) setPageIndex(safePageIndex)
  }, [pageIndex, safePageIndex])

  function changePageSize(nextPageSize: number): void {
    setPageSize(nextPageSize)
    setPageIndex(0)
  }

  return {
    pageIndex: safePageIndex,
    pageSize,
    pageCount,
    startIndex: safePageIndex * pageSize,
    endIndex: Math.min((safePageIndex + 1) * pageSize, itemCount),
    setPageIndex,
    setPageSize: changePageSize
  }
}

export function TablePagination({
  itemCount,
  pageIndex,
  pageSize,
  pageCount,
  startIndex,
  endIndex,
  setPageIndex,
  setPageSize
}: {
  itemCount: number
  pageIndex: number
  pageSize: number
  pageCount: number
  startIndex: number
  endIndex: number
  setPageIndex: (pageIndex: number) => void
  setPageSize: (pageSize: number) => void
}) {
  if (itemCount <= PAGE_SIZE_OPTIONS[0]) return null

  const hasPreviousPage = pageIndex > 0
  const hasNextPage = pageIndex < pageCount - 1

  return (
    <>
      <Separator />
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
          第 {startIndex + 1}–{endIndex} 条，共 {itemCount} 条
        </p>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>每页</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => setPageSize(Number(value))}
            >
              <SelectTrigger className="h-8 w-24" aria-label="每页显示条数">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option} 条
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <span className="min-w-16 text-center text-xs tabular-nums text-muted-foreground">
            {pageIndex + 1} / {pageCount} 页
          </span>
          <Pagination className="mx-0 w-auto" aria-label="表格分页">
            <PaginationContent>
              <PaginationItem>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  disabled={!hasPreviousPage}
                  aria-label="转到第一页"
                  onClick={() => setPageIndex(0)}
                >
                  <ChevronsLeft data-icon="icon-only" />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  disabled={!hasPreviousPage}
                  aria-label="转到上一页"
                  onClick={() => setPageIndex(pageIndex - 1)}
                >
                  <ChevronLeft data-icon="icon-only" />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  disabled={!hasNextPage}
                  aria-label="转到下一页"
                  onClick={() => setPageIndex(pageIndex + 1)}
                >
                  <ChevronRight data-icon="icon-only" />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  disabled={!hasNextPage}
                  aria-label="转到最后一页"
                  onClick={() => setPageIndex(pageCount - 1)}
                >
                  <ChevronsRight data-icon="icon-only" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </>
  )
}
