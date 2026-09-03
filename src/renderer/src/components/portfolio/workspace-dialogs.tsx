import { Check, Download } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import {
  BASE_CURRENCIES,
  DEFAULT_BASE_CURRENCY,
  type BaseCurrency,
  type Workspace,
  type WorkspaceInput
} from '@/lib/portfolio'
import { cn } from '@/lib/utils'
import { reportOperationError, reportValidationError, useSubmissionGuard } from './dialog-utils'

import { type BaseDialogProps } from './dialog-shared'
export function WorkspaceDialog({
  open,
  onOpenChange,
  onSubmit
}: BaseDialogProps & {
  onSubmit: (input: WorkspaceInput) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [baseCurrency, setBaseCurrency] = useState<BaseCurrency>(DEFAULT_BASE_CURRENCY)
  const [error, setError] = useState('')
  const { submitting, submissionInFlight, beginSubmission, endSubmission } = useSubmissionGuard()
  useEffect(() => {
    if (!open) return
    setName('')
    setBaseCurrency(DEFAULT_BASE_CURRENCY)
    setError('')
  }, [open])

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (submissionInFlight.current) return
    if (!name.trim()) {
      const message = '请输入工作区名称'
      setError(message)
      reportValidationError(message)
      return
    }
    if (!beginSubmission()) return
    try {
      await onSubmit({ name, baseCurrency })
      onOpenChange(false)
    } catch (submitError) {
      reportOperationError('创建工作区失败', submitError)
    } finally {
      endSubmission()
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!submitting) onOpenChange(nextOpen)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建工作区</DialogTitle>
          <DialogDescription className="sr-only">
            每个工作区的数据、设置和历史快照相互独立
          </DialogDescription>
        </DialogHeader>
        <form className="contents" onSubmit={handleSubmit}>
          <DialogBody>
            <FieldGroup>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="workspace-name">名称</FieldLabel>
                <Input
                  id="workspace-name"
                  aria-invalid={Boolean(error)}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value)
                    setError('')
                  }}
                  placeholder="家庭资产"
                  autoFocus
                  maxLength={40}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="workspace-base-currency">本位币</FieldLabel>
                <Select
                  value={baseCurrency}
                  onValueChange={(value) => {
                    setBaseCurrency(value as BaseCurrency)
                    setError('')
                  }}
                >
                  <SelectTrigger id="workspace-base-currency">
                    <SelectValue placeholder="选择本位币" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {BASE_CURRENCIES.map((currency) => (
                        <SelectItem key={currency} value={currency}>
                          {currency}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  各币种市值按参考汇率折算为本位币，并据此计算全部持仓的市值占比
                </FieldDescription>
              </Field>
            </FieldGroup>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={submitting} aria-busy={submitting}>
              {submitting && <Spinner data-icon="inline-start" />}
              {submitting ? '创建中…' : '创建'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function WorkspaceSwitcherDialog({
  open,
  onOpenChange,
  workspaces,
  activeWorkspaceId,
  onSelect,
  onImport,
  importing
}: BaseDialogProps & {
  workspaces: Workspace[]
  activeWorkspaceId: string
  onSelect: (workspaceId: string) => Promise<void>
  onImport: () => void
  importing: boolean
}) {
  const [switchingWorkspaceId, setSwitchingWorkspaceId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) setSwitchingWorkspaceId(null)
  }, [open])

  async function handleSelect(workspaceId: string): Promise<void> {
    if (switchingWorkspaceId) return
    if (workspaceId === activeWorkspaceId) {
      onOpenChange(false)
      return
    }
    setSwitchingWorkspaceId(workspaceId)
    try {
      await onSelect(workspaceId)
      onOpenChange(false)
    } catch (error) {
      reportOperationError('切换工作区失败', error)
    } finally {
      setSwitchingWorkspaceId(null)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!switchingWorkspaceId) onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>切换工作区</DialogTitle>
          <DialogDescription className="sr-only">选择要进入的工作区</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3 py-3">
          <div className="flex flex-col gap-2">
            {workspaces.map((workspace) => {
              const active = workspace.id === activeWorkspaceId
              const switching = workspace.id === switchingWorkspaceId
              return (
                <Button
                  key={workspace.id}
                  type="button"
                  variant={active ? 'secondary' : 'outline'}
                  className="h-12 w-full justify-start gap-3 px-3"
                  disabled={Boolean(switchingWorkspaceId)}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => void handleSelect(workspace.id)}
                >
                  <span
                    className={cn(
                      'grid size-7 shrink-0 place-items-center rounded-sm text-xs font-semibold',
                      active ? 'bg-background' : 'bg-muted'
                    )}
                  >
                    {workspace.name.trim().slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left">{workspace.name}</span>
                  {switching ? (
                    <Spinner data-icon="inline-end" />
                  ) : active ? (
                    <Check data-icon="inline-end" />
                  ) : null}
                </Button>
              )
            })}
          </div>
          <Separator />
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={Boolean(switchingWorkspaceId) || importing}
            aria-busy={importing}
            onClick={() => {
              onOpenChange(false)
              onImport()
            }}
          >
            {importing ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Download data-icon="inline-start" />
            )}
            {importing ? '读取中…' : '导入工作区'}
          </Button>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
