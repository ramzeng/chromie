import {
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction
} from 'react'
import {
  Check,
  Coins,
  Copy,
  Download,
  FolderTree,
  Plus,
  SlidersHorizontal,
  Trash2,
  Upload,
  Wrench
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList
} from '@/components/ui/combobox'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel
} from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { McpAccessSettings, McpConnectionSettings } from '@/lib/mcp'
import { AccountTypeIcon } from './view-helpers'
import {
  BASE_CURRENCIES,
  assetAccountTypeLabels,
  defaultCurrencyByMarket,
  DEFAULT_BASE_CURRENCY,
  DEFAULT_EXCHANGE_RATE_PROVIDER,
  DEFAULT_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  DEFAULT_FUTU_OPEND_HOST,
  DEFAULT_FUTU_OPEND_PORT,
  DEFAULT_IBKR_GATEWAY_HOST,
  DEFAULT_IBKR_GATEWAY_PORT,
  DEFAULT_SYNC_INTERVAL,
  exchangeRateProviderLabels,
  EXCHANGE_RATE_PROVIDERS,
  MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  marketMeta,
  marketOrder,
  MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  type AssetAccount,
  type AssetAccountIntegrationView,
  type AssetAccountInput,
  type AssetAccountType,
  type BaseCurrency,
  type ExchangeRateProvider,
  type AccountGroup,
  type AccountGroupInput,
  type Market,
  type Position,
  type PositionGroup,
  type PositionGroupInput,
  type PositionInput,
  type Workspace,
  type WorkspaceInput,
  type WorkspaceSettingsInput
} from '@/lib/portfolio'

type BaseDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function FieldMessage({ id, children }: { id?: string; children: string }) {
  return <FieldError id={id}>{children}</FieldError>
}

function operationErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/^Error invoking remote method '[^']+': Error: /, '')
}

function reportOperationError(title: string, error: unknown): void {
  toast.error(title, { description: operationErrorMessage(error) })
}

function useSubmissionGuard() {
  const [submitting, setSubmitting] = useState(false)
  const submissionInFlight = useRef(false)

  function beginSubmission(): boolean {
    if (submissionInFlight.current) return false
    submissionInFlight.current = true
    setSubmitting(true)
    return true
  }

  function endSubmission(): void {
    submissionInFlight.current = false
    setSubmitting(false)
  }

  return { submitting, submissionInFlight, beginSubmission, endSubmission }
}

const DISABLED_MCP_ACCESS: McpAccessSettings = {
  enabled: false,
  allowWrite: false
}

const ASSET_ACCOUNT_TYPES: readonly AssetAccountType[] = [
  'Futu',
  'Ibkr',
  'Boci',
  'Okx',
  'Binance',
  'Alipay',
  'Cmb',
  'Boc',
  'General'
]

const POSITION_CURRENCIES = [
  ...new Set([...BASE_CURRENCIES, ...Object.values(defaultCurrencyByMarket)])
].filter((currency) => currency !== 'USDT')

function McpSettingsSection({
  connection,
  access,
  setAccess
}: {
  connection: McpConnectionSettings | null
  access: McpAccessSettings
  setAccess: Dispatch<SetStateAction<McpAccessSettings>>
}) {
  const clientConfig = connection
    ? JSON.stringify({
        mcpServers: {
          chromie: {
            command: connection.command,
            args: connection.args
          }
        }
      }, null, 2)
    : ''

  async function copyClientConfig(): Promise<void> {
    try {
      await navigator.clipboard.writeText(clientConfig)
      toast.success('MCP 配置已复制')
    } catch (error) {
      toast.error('复制 MCP 配置失败', {
        description: operationErrorMessage(error)
      })
    }
  }

  return (
    <section className="grid gap-5">
      <div>
        <h3 className="text-base font-semibold">MCP</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          允许本机 AI 工具在你授权的范围内读取或维护 Chromie 数据
        </p>
      </div>
      <div className="divide-y overflow-hidden rounded-sm border">
        <div className="flex items-center justify-between gap-6 p-4">
          <div>
            <Label htmlFor="mcp-enabled">启用 MCP</Label>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              默认只读；关闭后本机 MCP 连接立即停止
            </p>
          </div>
          <Switch
            id="mcp-enabled"
            checked={access.enabled}
            onCheckedChange={(enabled) =>
              setAccess(enabled ? { ...access, enabled: true } : DISABLED_MCP_ACCESS)
            }
          />
        </div>
        <div className="flex items-center justify-between gap-6 p-4">
          <div>
            <Label htmlFor="mcp-write">允许写入与同步</Label>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              允许创建和修改资产数据，以及联网同步账户和汇率
            </p>
          </div>
          <Switch
            id="mcp-write"
            checked={access.allowWrite}
            disabled={!access.enabled}
            onCheckedChange={(allowWrite) =>
              setAccess((current) => ({
                ...current,
                allowWrite
              }))
            }
          />
        </div>
      </div>

      {clientConfig && (
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <Label>MCP 客户端配置</Label>
            <Button type="button" variant="outline" size="sm" onClick={copyClientConfig}>
              <Copy data-icon="inline-start" />
              复制
            </Button>
          </div>
          <pre className="max-h-40 overflow-auto rounded-sm bg-muted p-3 text-xs leading-5">
            {clientConfig}
          </pre>
        </div>
      )}
    </section>
  )
}

export function AccountGroupDialog({
  open,
  onOpenChange,
  group,
  onSubmit
}: BaseDialogProps & {
  group?: AccountGroup
  onSubmit: (input: AccountGroupInput) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const { submitting, submissionInFlight, beginSubmission, endSubmission } =
    useSubmissionGuard()

  useEffect(() => {
    if (!open) return
    setName(group?.name ?? '')
    setError('')
  }, [group, open])

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (submissionInFlight.current) return
    const normalizedName = name.trim()
    if (!normalizedName) {
      setError('请输入账户分组名称')
      return
    }
    if (!beginSubmission()) return
    try {
      await onSubmit({ name: normalizedName })
      onOpenChange(false)
    } catch (submitError) {
      reportOperationError(
        group ? '更新账户分组失败' : '创建账户分组失败',
        submitError
      )
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
          <DialogTitle>{group ? '编辑账户分组' : '新建账户分组'}</DialogTitle>
          <DialogDescription className="sr-only">把多个资产账户汇总到一起查看</DialogDescription>
        </DialogHeader>
        <form className="contents" onSubmit={handleSubmit}>
          <DialogBody>
            <FieldGroup>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="account-group-name">账户分组名称</FieldLabel>
                <Input
                  id="account-group-name"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'account-group-name-error' : undefined}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value)
                    setError('')
                  }}
                  placeholder="输入账户分组名称"
                  autoFocus
                  maxLength={40}
                />
                {error && (
                  <FieldMessage id="account-group-name-error">{error}</FieldMessage>
                )}
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
              {submitting
                ? group
                  ? '保存中…'
                  : '创建中…'
                : group
                  ? '保存'
                  : '创建'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function WorkspaceDialog({
  open,
  onOpenChange,
  onSubmit
}: BaseDialogProps & {
  onSubmit: (input: WorkspaceInput) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [baseCurrency, setBaseCurrency] = useState<BaseCurrency>(
    DEFAULT_BASE_CURRENCY
  )
  const [error, setError] = useState('')
  const { submitting, submissionInFlight, beginSubmission, endSubmission } =
    useSubmissionGuard()

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
      setError('请输入工作区名称')
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
                <FieldLabel htmlFor="workspace-name">工作区名称</FieldLabel>
                <Input
                  id="workspace-name"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'workspace-name-error' : undefined}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value)
                    setError('')
                  }}
                  placeholder="例如：家庭资产"
                  autoFocus
                  maxLength={40}
                />
                {error && (
                  <FieldMessage id="workspace-name-error">{error}</FieldMessage>
                )}
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
        <DialogBody className="grid content-start gap-2">
          {workspaces.map((workspace) => {
            const active = workspace.id === activeWorkspaceId
            const switching = workspace.id === switchingWorkspaceId
            return (
              <Button
                key={workspace.id}
                type="button"
                variant={active ? 'secondary' : 'outline'}
                className="h-auto w-full justify-start gap-3 p-3"
                disabled={Boolean(switchingWorkspaceId)}
                aria-current={active ? 'true' : undefined}
                onClick={() => void handleSelect(workspace.id)}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-sm bg-background text-sm font-semibold">
                  {workspace.name.trim().slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate text-left">
                  {workspace.name}
                </span>
                {switching ? (
                  <Spinner data-icon="inline-end" />
                ) : active ? (
                  <Check data-icon="inline-end" />
                ) : null}
              </Button>
            )
          })}
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

export function WorkspaceSettingsDialog({
  open,
  onOpenChange,
  workspace,
  initialSection = 'basic',
  onSubmit,
  onRequestExport,
  onRequestDelete
}: BaseDialogProps & {
  workspace: Workspace
  initialSection?: 'basic' | 'currency' | 'mcp'
  onSubmit: (input: WorkspaceSettingsInput) => Promise<void>
  onRequestExport: () => void
  onRequestDelete: () => void
}) {
  const [name, setName] = useState('')
  const [baseCurrency, setBaseCurrency] = useState<BaseCurrency>(
    DEFAULT_BASE_CURRENCY
  )
  const [exchangeRateProvider, setExchangeRateProvider] =
    useState<ExchangeRateProvider>(DEFAULT_EXCHANGE_RATE_PROVIDER)
  const [exchangeRateRefreshInterval, setExchangeRateRefreshInterval] = useState(
    String(DEFAULT_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES)
  )
  const [section, setSection] = useState<'basic' | 'currency' | 'mcp'>('basic')
  const [mcpConnection, setMcpConnection] =
    useState<McpConnectionSettings | null>(null)
  const [mcpAccess, setMcpAccess] =
    useState<McpAccessSettings>(DISABLED_MCP_ACCESS)
  const [mcpLoading, setMcpLoading] = useState(false)
  const { submitting, submissionInFlight, beginSubmission, endSubmission } =
    useSubmissionGuard()
  const [mcpError, setMcpError] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setName(workspace.name)
    setBaseCurrency(workspace.baseCurrency)
    setExchangeRateProvider(
      EXCHANGE_RATE_PROVIDERS.includes(workspace.exchangeRateProvider)
        ? workspace.exchangeRateProvider
        : DEFAULT_EXCHANGE_RATE_PROVIDER
    )
    setExchangeRateRefreshInterval(
      String(
        Number.isInteger(workspace.exchangeRateRefreshIntervalMinutes) &&
          workspace.exchangeRateRefreshIntervalMinutes >=
            MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES &&
          workspace.exchangeRateRefreshIntervalMinutes <=
            MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES
          ? workspace.exchangeRateRefreshIntervalMinutes
          : DEFAULT_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES
      )
    )
    setSection(initialSection)
    setError('')
  }, [workspace.id, initialSection, open])

  useEffect(() => {
    if (!open || section !== 'mcp') return
    let mounted = true
    const mcp = window.desktop.mcp

    setMcpConnection(null)
    setMcpAccess(DISABLED_MCP_ACCESS)
    setMcpError('')
    setMcpLoading(false)
    if (!mcp) {
      const message = 'MCP 组件尚未加载，请重启 Chromie'
      setMcpError(message)
      reportOperationError('MCP 操作失败', message)
      return
    }

    setMcpLoading(true)
    void mcp
      .loadSettings()
      .then((result) => {
        if (!mounted) return
        setMcpConnection(result)
        setMcpAccess(result.access)
      })
      .catch((loadError) => {
        if (!mounted) return
        const message = operationErrorMessage(loadError)
        setMcpError(message)
        reportOperationError('MCP 操作失败', message)
      })
      .finally(() => {
        if (mounted) setMcpLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [open, section])

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (submissionInFlight.current) return
    if (section === 'mcp') {
      if (!window.desktop.mcp) {
        const message = 'MCP 组件尚未加载，请重启 Chromie'
        setMcpError(message)
        reportOperationError('MCP 操作失败', message)
        return
      }
      if (!beginSubmission()) return
      try {
        setMcpError('')
        const result = await window.desktop.mcp.updateSettings(mcpAccess)
        setMcpConnection(result)
        setMcpAccess(result.access)
        onOpenChange(false)
      } catch (submitError) {
        const message = operationErrorMessage(submitError)
        setMcpError(message)
        reportOperationError('MCP 操作失败', message)
      } finally {
        endSubmission()
      }
      return
    }
    if (!name.trim()) {
      setSection('basic')
      setError('请输入工作区名称')
      return
    }
    const refreshInterval = Number(exchangeRateRefreshInterval)
    if (
      !Number.isInteger(refreshInterval) ||
      refreshInterval < MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES ||
      refreshInterval > MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES
    ) {
      setSection('currency')
      setError(
        `更新间隔请输入 ${MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES}–${MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES} 分钟之间的整数`
      )
      return
    }
    if (!beginSubmission()) return
    try {
      await onSubmit({
        name,
        baseCurrency,
        exchangeRateProvider,
        exchangeRateRefreshIntervalMinutes: refreshInterval
      })
      onOpenChange(false)
    } catch (submitError) {
      reportOperationError('保存工作区设置失败', submitError)
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
      <DialogContent className="h-[640px] max-h-[calc(100vh-2rem)] max-w-[760px]">
        <DialogHeader>
          <DialogTitle>工作区设置</DialogTitle>
          <DialogDescription className="sr-only">
            管理工作区基础信息、币种与汇率、MCP 和工作区状态
          </DialogDescription>
        </DialogHeader>
        <form
          className="contents"
          aria-invalid={section !== 'mcp' && Boolean(error)}
          aria-describedby={
            section !== 'mcp' && error ? 'workspace-settings-error' : undefined
          }
          onSubmit={handleSubmit}
        >
          <DialogBody className="grid grid-cols-[10.5rem_minmax(0,1fr)] overflow-hidden p-0">
            <aside className="border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground">
              <nav className="grid content-start gap-1" aria-label="工作区设置菜单">
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    'h-9 justify-start gap-2.5 px-3 font-normal hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    section === 'basic' &&
                      'bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent'
                  )}
                  onClick={() => setSection('basic')}
                >
                  <SlidersHorizontal className="size-4" />
                  基础信息
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    'h-9 justify-start gap-2.5 px-3 font-normal hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    section === 'currency' &&
                      'bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent'
                  )}
                  onClick={() => setSection('currency')}
                >
                  <Coins className="size-4" />
                  币种与汇率
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    'h-9 justify-start gap-2.5 px-3 font-normal hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    section === 'mcp' &&
                      'bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent'
                  )}
                  onClick={() => setSection('mcp')}
                >
                  <Wrench className="size-4" />
                  MCP
                </Button>
              </nav>
            </aside>

            <ScrollArea className="min-h-0 min-w-0">
              <div className="px-6 py-5">
                {section === 'basic' && (
                <section className="grid gap-5">
                  <h3 className="text-base font-semibold">基础信息</h3>
                  <div className="grid gap-2">
                    <Label htmlFor="workspace-settings-name">工作区名称</Label>
                    <Input
                      id="workspace-settings-name"
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value)
                        setError('')
                      }}
                      placeholder="输入工作区名称"
                      maxLength={40}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-5">
                    <div className="grid gap-1">
                      <p className="text-sm font-medium">导出工作区</p>
                      <p className="text-xs leading-5 text-muted-foreground">
                        导出工作区数据与历史快照，备份不包含同步凭据
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => {
                        onOpenChange(false)
                        onRequestExport()
                      }}
                    >
                      <Upload data-icon="inline-start" />
                      导出
                    </Button>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-5">
                    <div className="grid gap-1">
                      <p className="text-sm font-medium">删除工作区</p>
                      <p className="text-xs leading-5 text-muted-foreground">
                        将删除工作区内的全部数据，且无法撤销
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => {
                        onOpenChange(false)
                        onRequestDelete()
                      }}
                    >
                      <Trash2 data-icon="inline-start" />
                      删除
                    </Button>
                  </div>
                </section>
              )}

                {section === 'currency' && (
                <section className="grid gap-5">
                  <h3 className="text-base font-semibold">币种与汇率</h3>
                  <div className="grid gap-2">
                    <Label htmlFor="workspace-settings-base-currency">
                      本位币
                    </Label>
                    <Select
                      value={baseCurrency}
                      onValueChange={(value) => {
                        setBaseCurrency(value as BaseCurrency)
                        setError('')
                      }}
                    >
                      <SelectTrigger id="workspace-settings-base-currency">
                        <SelectValue />
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
                    <p className="text-xs leading-5 text-muted-foreground">
                      各币种市值按参考汇率折算为本位币，并据此计算全部持仓的市值占比
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="workspace-settings-exchange-rate-provider">
                      汇率数据源
                    </Label>
                    <Select
                      value={exchangeRateProvider}
                      onValueChange={(value) => {
                        setExchangeRateProvider(value as ExchangeRateProvider)
                        setError('')
                      }}
                    >
                      <SelectTrigger id="workspace-settings-exchange-rate-provider">
                        <SelectValue placeholder="选择汇率数据源">
                          {exchangeRateProviderLabels[exchangeRateProvider]}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {EXCHANGE_RATE_PROVIDERS.map((provider) => (
                            <SelectItem key={provider} value={provider}>
                              {exchangeRateProviderLabels[provider]}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <p className="text-xs leading-5 text-muted-foreground">
                      用于获取不同持仓币种之间的参考汇率
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="workspace-settings-exchange-rate-refresh-interval">
                      更新间隔（分钟）
                    </Label>
                    <Input
                      id="workspace-settings-exchange-rate-refresh-interval"
                      type="number"
                      min={MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES}
                      max={MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES}
                      step={1}
                      value={exchangeRateRefreshInterval}
                      onChange={(event) => {
                        setExchangeRateRefreshInterval(event.target.value)
                        setError('')
                      }}
                    />
                    <p className="text-xs leading-5 text-muted-foreground">
                      打开工作区后立即更新，之后按此间隔自动更新
                    </p>
                  </div>
                </section>
              )}

                {section === 'mcp' && (
                <div className="grid gap-4">
                  {mcpLoading ? (
                    <div className="grid gap-5" aria-label="正在加载 MCP 设置">
                      <div className="grid gap-2">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-3 w-72 max-w-full" />
                      </div>
                      <div className="grid gap-4 rounded-sm border p-4">
                        {Array.from({ length: 2 }, (_, index) => (
                          <div key={index} className="flex items-center justify-between gap-6">
                            <div className="grid flex-1 gap-2">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-3 w-3/4" />
                            </div>
                            <Skeleton className="h-5 w-9" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <McpSettingsSection
                      connection={mcpConnection}
                      access={mcpAccess}
                      setAccess={setMcpAccess}
                    />
                  )}
                </div>
                )}
              </div>
            </ScrollArea>
          </DialogBody>

          <DialogFooter className="items-center sm:justify-between">
            <div>
              {section !== 'mcp' && error && (
                <FieldMessage id="workspace-settings-error">{error}</FieldMessage>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={
                  submitting ||
                  (section === 'mcp' &&
                    (mcpLoading || Boolean(mcpError && !mcpConnection)))
                }
                aria-busy={submitting}
              >
                {submitting && <Spinner data-icon="inline-start" />}
                {submitting ? '保存中…' : '保存'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function GroupAccountsDialog({
  open,
  onOpenChange,
  group,
  assetAccounts,
  accountGroups,
  onSubmit
}: BaseDialogProps & {
  group: AccountGroup
  assetAccounts: AssetAccount[]
  accountGroups: AccountGroup[]
  onSubmit: (assetAccountIds: string[]) => Promise<string | null>
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const { submitting, beginSubmission, endSubmission } = useSubmissionGuard()
  const checkboxIdPrefix = useId()

  useEffect(() => {
    if (!open) return
    setSelectedIds(group.assetAccountIds)
    setQuery('')
    // Background account syncs should not discard selections being edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id, open])

  const normalizedQuery = query.trim().toLowerCase()
  const visibleAccounts = normalizedQuery
    ? assetAccounts.filter((assetAccount) =>
        [assetAccount.name, assetAccountTypeLabels[assetAccount.type]].some((value) =>
          value.toLowerCase().includes(normalizedQuery)
        )
      )
    : assetAccounts
  const assignedGroupByAccountId = new Map(
    accountGroups.flatMap((accountGroup) =>
      accountGroup.id === group.id
        ? []
        : accountGroup.assetAccountIds.map(
            (assetAccountId) => [assetAccountId, accountGroup.name] as const
          )
    )
  )

  function setAccountSelected(assetAccountId: string, selected: boolean): void {
    if (assignedGroupByAccountId.has(assetAccountId)) return
    setSelectedIds((current) =>
      selected
        ? current.includes(assetAccountId)
          ? current
          : [...current, assetAccountId]
        : current.filter((item) => item !== assetAccountId)
    )
  }

  async function handleSubmit(): Promise<void> {
    if (!beginSubmission()) return
    try {
      const submitError = await onSubmit(selectedIds)
      if (submitError) {
        reportOperationError('更新账户分组失败', submitError)
        return
      }
      onOpenChange(false)
    } catch (submitError) {
      reportOperationError('更新账户分组失败', submitError)
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
      <DialogContent className="max-h-[88vh] max-w-xl">
        <DialogHeader>
          <DialogTitle>管理“{group.name}”的资产账户</DialogTitle>
          <DialogDescription>
            每个资产账户只能加入一个账户分组，已属于其他分组的资产账户不可选择
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid content-start gap-4">
          {assetAccounts.length > 0 && (
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索资产账户名称或类型"
              autoFocus
            />
          )}
          <div className="min-h-28 rounded-sm border bg-muted/10">
          {visibleAccounts.length ? (
            <div className="grid gap-1 p-3">
              {visibleAccounts.map((assetAccount) => {
                const selected = selectedIds.includes(assetAccount.id)
                const assignedGroupName = assignedGroupByAccountId.get(assetAccount.id)
                return (
                  <Label
                    key={assetAccount.id}
                    htmlFor={`${checkboxIdPrefix}-${assetAccount.id}`}
                    className={cn(
                      'flex items-center gap-3 rounded-sm px-3 py-2.5 transition-colors',
                      assignedGroupName
                        ? 'cursor-not-allowed opacity-55'
                        : 'cursor-pointer hover:bg-muted/70'
                    )}
                  >
                    <Checkbox
                      id={`${checkboxIdPrefix}-${assetAccount.id}`}
                      checked={selected}
                      disabled={Boolean(assignedGroupName)}
                      onCheckedChange={(checked) => {
                        if (checked !== 'indeterminate') {
                          setAccountSelected(assetAccount.id, checked)
                        }
                      }}
                    />
                    <AccountTypeIcon type={assetAccount.type} className="size-7" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {assetAccount.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {assetAccountTypeLabels[assetAccount.type]} · {assetAccount.positions.length} 项持仓
                      </span>
                    </span>
                    {assignedGroupName && (
                      <span className="max-w-40 shrink-0 truncate text-xs text-muted-foreground">
                        已在 {assignedGroupName}
                      </span>
                    )}
                  </Label>
                )
              })}
            </div>
          ) : (
            <Empty className="min-h-32 px-6 py-8 md:p-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FolderTree data-icon="inline-start" />
                </EmptyMedia>
                <EmptyTitle>
                  {assetAccounts.length ? '没有匹配的资产账户' : '暂无可选资产账户'}
                </EmptyTitle>
                <EmptyDescription>
                  {assetAccounts.length ? '请尝试调整搜索关键词' : '请先添加资产账户'}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          </div>
        </DialogBody>
        <DialogFooter className="items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            已选择 {selectedIds.length} 个资产账户
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={submitting}
              aria-busy={submitting}
              onClick={() => void handleSubmit()}
            >
              {submitting && <Spinner data-icon="inline-start" />}
              {submitting ? '保存中…' : '保存'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PositionGroupDialog({
  open,
  onOpenChange,
  group,
  onSubmit
}: BaseDialogProps & {
  group?: PositionGroup
  onSubmit: (input: PositionGroupInput) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const { submitting, submissionInFlight, beginSubmission, endSubmission } =
    useSubmissionGuard()

  useEffect(() => {
    if (!open) return
    setName(group?.name ?? '')
    setError('')
  }, [group, open])

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (submissionInFlight.current) return
    if (!name.trim()) {
      setError('请输入持仓分组名称')
      return
    }
    if (!beginSubmission()) return
    try {
      await onSubmit({ name })
      onOpenChange(false)
    } catch (submitError) {
      reportOperationError(group ? '更新持仓分组失败' : '创建持仓分组失败', submitError)
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
          <DialogTitle>{group ? '编辑持仓分组' : '新建持仓分组'}</DialogTitle>
          <DialogDescription className="sr-only">
            把不同资产账户中的持仓汇总到一起查看
          </DialogDescription>
        </DialogHeader>
        <form className="contents" onSubmit={handleSubmit}>
          <DialogBody>
            <FieldGroup>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="position-group-name">持仓分组名称</FieldLabel>
                <Input
                  id="position-group-name"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'position-group-name-error' : undefined}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value)
                    setError('')
                  }}
                  placeholder="例如：长期持有"
                  autoFocus
                  maxLength={40}
                />
                {error && (
                  <FieldMessage id="position-group-name-error">{error}</FieldMessage>
                )}
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
              {submitting
                ? group
                  ? '保存中…'
                  : '创建中…'
                : group
                  ? '保存'
                  : '创建'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function GroupPositionsDialog({
  open,
  onOpenChange,
  group,
  assetAccounts,
  accountGroups,
  positionGroups,
  onSubmit
}: BaseDialogProps & {
  group: PositionGroup
  assetAccounts: AssetAccount[]
  accountGroups: AccountGroup[]
  positionGroups: PositionGroup[]
  onSubmit: (positionIds: string[]) => Promise<string | null>
}) {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const { submitting, beginSubmission, endSubmission } = useSubmissionGuard()
  const checkboxIdPrefix = useId()

  useEffect(() => {
    if (!open) return
    setSelectedKeys(group.positionIds)
    setQuery('')
    // Only reset when the dialog opens or switches to another group. Background
    // account syncs should not discard selections that are still being edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id, open])

  const normalizedQuery = query.trim().toLowerCase()
  const visibleAccounts = assetAccounts.flatMap((account) => {
    const positions = normalizedQuery
      ? account.positions.filter((position) =>
          [
            account.name,
            position.symbol,
            position.name,
            marketMeta[position.market].label,
            position.currency
          ].some((value) => value.toLowerCase().includes(normalizedQuery))
        )
      : account.positions
    return positions.length ? [{ account, positions }] : []
  })
  const positionCount = assetAccounts.reduce(
    (total, account) => total + account.positions.length,
    0
  )
  const assignedGroupByPositionId = new Map(
    positionGroups.flatMap((positionGroup) =>
      positionGroup.id === group.id
        ? []
        : positionGroup.positionIds.map(
            (positionId) => [positionId, positionGroup.name] as const
          )
    )
  )
  const accountGroupByAssetAccountId = new Map(
    accountGroups.flatMap((accountGroup) =>
      accountGroup.assetAccountIds.map(
        (assetAccountId) => [assetAccountId, accountGroup.name] as const
      )
    )
  )

  function setPositionSelected(positionId: string, selected: boolean): void {
    if (assignedGroupByPositionId.has(positionId)) return
    setSelectedKeys((current) =>
      selected
        ? current.includes(positionId)
          ? current
          : [...current, positionId]
        : current.filter((item) => item !== positionId)
    )
  }

  async function handleSubmit(): Promise<void> {
    if (!beginSubmission()) return
    try {
      const submitError = await onSubmit(selectedKeys)
      if (submitError) {
        reportOperationError('保存分组持仓失败', submitError)
        return
      }
      onOpenChange(false)
    } catch (submitError) {
      reportOperationError('保存分组持仓失败', submitError)
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
      <DialogContent className="max-h-[88vh] max-w-2xl">
        <DialogHeader>
          <DialogTitle>管理“{group.name}”的持仓</DialogTitle>
          <DialogDescription>
            每个持仓只能加入一个分组，已属于其他分组的持仓不可选择
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid content-start gap-4">
          {positionCount > 0 && (
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索资产账户、代码或名称"
              autoFocus
            />
          )}
          <div className="min-h-28 rounded-sm border bg-muted/10">
          {visibleAccounts.length ? (
            <div className="divide-y">
              {visibleAccounts.map(({ account, positions }) => (
                <section key={account.id} className="p-3">
                  <div className="mb-2 flex min-w-0 items-center justify-between gap-3 px-1">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <p className="min-w-0 truncate text-sm font-medium">
                        {account.name}
                      </p>
                      <Badge
                        variant="secondary"
                        className="max-w-40 shrink-0 truncate"
                      >
                        {accountGroupByAssetAccountId.get(account.id) ?? '未分组'}
                      </Badge>
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      {positions.length} 项
                    </p>
                  </div>
                  <div className="grid gap-1">
                    {positions.map((position) => {
                      const selected = selectedKeys.includes(position.id)
                      const assignedGroupName = assignedGroupByPositionId.get(position.id)
                      return (
                        <Label
                          key={position.id}
                          htmlFor={`${checkboxIdPrefix}-${position.id}`}
                          className={cn(
                            'flex items-center gap-3 rounded-sm px-3 py-2.5 transition-colors',
                            assignedGroupName
                              ? 'cursor-not-allowed opacity-55'
                              : 'cursor-pointer hover:bg-muted/70'
                          )}
                        >
                          <Checkbox
                            id={`${checkboxIdPrefix}-${position.id}`}
                            checked={selected}
                            disabled={Boolean(assignedGroupName)}
                            onCheckedChange={(checked) => {
                              if (checked !== 'indeterminate') {
                                setPositionSelected(position.id, checked)
                              }
                            }}
                          />
                          <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">
                            {marketMeta[position.market].shortLabel}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {position.symbol}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {position.name}
                            </span>
                          </span>
                          {assignedGroupName && (
                            <span className="max-w-40 shrink-0 truncate text-right text-xs text-muted-foreground">
                              已在 {assignedGroupName}
                            </span>
                          )}
                        </Label>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <Empty className="min-h-32 px-6 py-8 md:p-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Coins data-icon="inline-start" />
                </EmptyMedia>
                <EmptyTitle>
                  {positionCount ? '没有匹配的持仓' : '暂无可选持仓'}
                </EmptyTitle>
                <EmptyDescription>
                  {positionCount
                    ? '请尝试调整搜索关键词'
                    : '请先在资产账户中添加或同步持仓'}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          </div>
        </DialogBody>
        <DialogFooter className="items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">已选择 {selectedKeys.length} 项持仓</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={submitting}
              aria-busy={submitting}
              onClick={() => void handleSubmit()}
            >
              {submitting && <Spinner data-icon="inline-start" />}
              {submitting ? '保存中…' : '保存'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ImportBackupDialog({
  open,
  onOpenChange,
  workspaceName,
  assetAccountCount,
  groupCount,
  positionCount,
  snapshotCount,
  onConfirm
}: BaseDialogProps & {
  workspaceName: string
  assetAccountCount: number
  groupCount: number
  positionCount: number
  snapshotCount: number
  onConfirm: () => void | Promise<void>
}) {
  const { submitting, beginSubmission, endSubmission } = useSubmissionGuard()

  async function handleConfirm(): Promise<void> {
    if (!beginSubmission()) return
    try {
      await onConfirm()
    } catch {
      // The caller owns user-facing error feedback; keep the dialog open for retry.
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
          <DialogTitle>导入“{workspaceName}”？</DialogTitle>
          <DialogDescription>
            包含 {assetAccountCount} 个资产账户、{groupCount} 个持仓分组、{positionCount}{' '}
            项持仓和 {snapshotCount} 个历史快照，将作为新工作区导入
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            disabled={submitting}
            aria-busy={submitting}
            onClick={() => void handleConfirm()}
          >
            {submitting && <Spinner data-icon="inline-start" />}
            {submitting ? '导入中…' : '导入'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ExportBackupDialog({
  open,
  onOpenChange,
  onConfirm
}: BaseDialogProps & {
  onConfirm: () => void | Promise<void>
}) {
  const { submitting, beginSubmission, endSubmission } = useSubmissionGuard()

  async function handleConfirm(): Promise<void> {
    if (!beginSubmission()) return
    try {
      await onConfirm()
    } catch {
      // The caller owns user-facing error feedback; keep the dialog open for retry.
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
          <DialogTitle>导出当前工作区</DialogTitle>
          <DialogDescription>备份不包含同步凭据，导入后需重新配置</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            disabled={submitting}
            aria-busy={submitting}
            onClick={() => void handleConfirm()}
          >
            {submitting && <Spinner data-icon="inline-start" />}
            {submitting ? '导出中…' : '导出'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AssetAccountDialog({
  open,
  onOpenChange,
  account,
  integration,
  onSubmit
}: BaseDialogProps & {
  account?: AssetAccount
  integration?: AssetAccountIntegrationView
  onSubmit: (input: AssetAccountInput) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<AssetAccountType>('Futu')
  const [autoSync, setAutoSync] = useState(false)
  const [syncHost, setSyncHost] = useState(DEFAULT_FUTU_OPEND_HOST)
  const [syncPort, setSyncPort] = useState(String(DEFAULT_FUTU_OPEND_PORT))
  const [syncInterval, setSyncInterval] = useState(String(DEFAULT_SYNC_INTERVAL))
  const [syncKey, setSyncKey] = useState('')
  const [okxApiKey, setOkxApiKey] = useState('')
  const [okxSecretKey, setOkxSecretKey] = useState('')
  const [okxPassphrase, setOkxPassphrase] = useState('')
  const [ibkrGatewayHost, setIbkrGatewayHost] = useState(DEFAULT_IBKR_GATEWAY_HOST)
  const [ibkrGatewayPort, setIbkrGatewayPort] = useState(
    String(DEFAULT_IBKR_GATEWAY_PORT)
  )
  const [binanceApiKey, setBinanceApiKey] = useState('')
  const [binanceSecretKey, setBinanceSecretKey] = useState('')
  const [error, setError] = useState('')
  const { submitting, submissionInFlight, beginSubmission, endSubmission } =
    useSubmissionGuard()
  const supportsAutoSync =
    type === 'Futu' || type === 'Okx' || type === 'Ibkr' || type === 'Binance'

  useEffect(() => {
    if (!open) return
    setName(account?.name ?? assetAccountTypeLabels[account?.type ?? 'Futu'])
    setType(account?.type ?? 'Futu')
    setAutoSync(Boolean(account?.sync && integration))
    setSyncHost(
      integration?.provider === 'Futu'
        ? integration.websocket.host
        : DEFAULT_FUTU_OPEND_HOST
    )
    setSyncPort(
      String(
        integration?.provider === 'Futu'
          ? integration.websocket.port
          : DEFAULT_FUTU_OPEND_PORT
      )
    )
    setSyncInterval(String(account?.sync?.interval ?? DEFAULT_SYNC_INTERVAL))
    setSyncKey('')
    setOkxApiKey('')
    setOkxSecretKey('')
    setOkxPassphrase('')
    setIbkrGatewayHost(
      integration?.provider === 'Ibkr'
        ? integration.gateway.host
        : DEFAULT_IBKR_GATEWAY_HOST
    )
    setIbkrGatewayPort(
      String(
        integration?.provider === 'Ibkr'
          ? integration.gateway.port
          : DEFAULT_IBKR_GATEWAY_PORT
      )
    )
    setBinanceApiKey('')
    setBinanceSecretKey('')
    setError('')
    // Background syncs refresh account props while this dialog is open. Do not
    // discard credential replacements or other edits that the user is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id, open])

  function handleAccountTypeChange(nextType: AssetAccountType): void {
    setName((currentName) =>
      !currentName.trim() || currentName === assetAccountTypeLabels[type]
        ? assetAccountTypeLabels[nextType]
        : currentName
    )
    setType(nextType)
    if (
      nextType === 'Boci' ||
      nextType === 'Alipay' ||
      nextType === 'General' ||
      nextType === 'Cmb' ||
      nextType === 'Boc'
    ) {
      setAutoSync(false)
    }
    setError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (submissionInFlight.current) return
    if (!name.trim()) {
      setError('请输入资产账户名称')
      return
    }
    const parsedSyncPort = Number(syncPort)
    const parsedSyncInterval = Number(syncInterval)
    const syncEnabled = supportsAutoSync && autoSync
    const canKeepOkxCredential =
      account?.type === 'Okx' && integration?.provider === 'Okx'
    const hasAnyOkxCredential = Boolean(
      okxApiKey.trim() || okxSecretKey || okxPassphrase
    )
    const canKeepBinanceCredential =
      account?.type === 'Binance' && integration?.provider === 'Binance'
    const hasAnyBinanceCredential = Boolean(
      binanceApiKey.trim() || binanceSecretKey
    )
    if (type === 'Futu' && syncEnabled && !syncHost.trim()) {
      setError('请输入 Futu OpenD 地址')
      return
    }
    if (
      type === 'Futu' &&
      syncEnabled &&
      (!Number.isInteger(parsedSyncPort) || parsedSyncPort < 1 || parsedSyncPort > 65535)
    ) {
      setError('Futu OpenD 端口需为 1–65535')
      return
    }
    if (
      syncEnabled &&
      (!Number.isInteger(parsedSyncInterval) || parsedSyncInterval < 5 || parsedSyncInterval > 3600)
    ) {
      setError('同步间隔需为 5–3600 秒')
      return
    }
    if (
      type === 'Okx' &&
      syncEnabled &&
      ((!canKeepOkxCredential && !hasAnyOkxCredential) ||
        (hasAnyOkxCredential &&
          (!okxApiKey.trim() || !okxSecretKey || !okxPassphrase)))
    ) {
      setError('请填写完整的 OKX API 配置')
      return
    }
    const parsedIbkrGatewayPort = Number(ibkrGatewayPort)
    const normalizedIbkrGatewayHost = ibkrGatewayHost
      .trim()
      .toLowerCase()
      .replace(/^\[|\]$/g, '')
    if (
      type === 'Ibkr' &&
      syncEnabled &&
      !['127.0.0.1', 'localhost', '::1'].includes(normalizedIbkrGatewayHost)
    ) {
      setError('IBKR Client Portal Gateway 地址必须是本机回环地址')
      return
    }
    if (
      type === 'Ibkr' &&
      syncEnabled &&
      (!Number.isInteger(parsedIbkrGatewayPort) ||
        parsedIbkrGatewayPort < 1 ||
        parsedIbkrGatewayPort > 65535)
    ) {
      setError('IBKR Client Portal Gateway 端口需为 1–65535')
      return
    }
    if (
      type === 'Binance' &&
      syncEnabled &&
      ((!canKeepBinanceCredential && !hasAnyBinanceCredential) ||
        (hasAnyBinanceCredential &&
          (!binanceApiKey.trim() || !binanceSecretKey)))
    ) {
      setError('请填写完整的币安 API 配置')
      return
    }
    const lastSyncedAt =
      account?.type === type ? account.sync?.lastSyncedAt : undefined
    if (!beginSubmission()) return
    try {
      await onSubmit({
          name: name.trim(),
          type,
          ...(syncEnabled
            ? {
              sync: {
                interval:
                  Number.isInteger(parsedSyncInterval) &&
                  parsedSyncInterval >= 5 &&
                  parsedSyncInterval <= 3600
                    ? parsedSyncInterval
                    : DEFAULT_SYNC_INTERVAL,
                ...(lastSyncedAt ? { lastSyncedAt } : {})
              },
              integration:
                type === 'Futu'
                  ? {
                      provider: 'Futu' as const,
                      websocket: {
                        host: syncHost.trim() || DEFAULT_FUTU_OPEND_HOST,
                        port:
                          Number.isInteger(parsedSyncPort) &&
                          parsedSyncPort >= 1 &&
                          parsedSyncPort <= 65535
                            ? parsedSyncPort
                            : DEFAULT_FUTU_OPEND_PORT,
                        credential: syncKey.trim()
                          ? {
                              mode: 'replace' as const,
                              value: { key: syncKey.trim() }
                            }
                          : account?.type === 'Futu' &&
                              integration?.provider === 'Futu' &&
                              integration.websocket.credentialConfigured
                            ? { mode: 'keep' as const }
                            : { mode: 'clear' as const }
                      }
                    }
                  : type === 'Ibkr'
                    ? {
                        provider: 'Ibkr' as const,
                        gateway: {
                          host: normalizedIbkrGatewayHost,
                          port: parsedIbkrGatewayPort
                        }
                      }
                    : type === 'Okx'
                      ? {
                          provider: 'Okx' as const,
                          api: {
                            credential: hasAnyOkxCredential
                              ? {
                                  mode: 'replace' as const,
                                  value: {
                                    apiKey: okxApiKey.trim(),
                                    secretKey: okxSecretKey,
                                    passphrase: okxPassphrase
                                  }
                                }
                              : { mode: 'keep' as const }
                          }
                        }
                      : {
                          provider: 'Binance' as const,
                          api: {
                            credential: hasAnyBinanceCredential
                              ? {
                                  mode: 'replace' as const,
                                  value: {
                                    apiKey: binanceApiKey.trim(),
                                    secretKey: binanceSecretKey
                                  }
                                }
                              : { mode: 'keep' as const }
                          }
                        }
              }
            : {})
      })
      onOpenChange(false)
    } catch (submitError) {
      reportOperationError(account ? '更新资产账户失败' : '添加资产账户失败', submitError)
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
      <DialogContent className="max-h-[92vh] max-w-xl">
        <DialogHeader>
          <DialogTitle>{account ? '编辑资产账户' : '添加资产账户'}</DialogTitle>
          <DialogDescription className="sr-only">
            设置资产账户名称、类型和同步来源
          </DialogDescription>
        </DialogHeader>
        <form
          className="contents"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'asset-account-error' : undefined}
          onSubmit={handleSubmit}
        >
          <DialogBody className="grid content-start gap-4">
          <div className="grid gap-2">
            <Label htmlFor="asset-account-type">账户类型</Label>
            <Combobox
              items={ASSET_ACCOUNT_TYPES}
              value={type}
              onValueChange={(nextType) => {
                if (nextType) handleAccountTypeChange(nextType)
              }}
              itemToStringLabel={(accountType) => assetAccountTypeLabels[accountType]}
              itemToStringValue={(accountType) => accountType}
              filter={(accountType, query) =>
                `${accountType} ${assetAccountTypeLabels[accountType]}`
                  .toLocaleLowerCase()
                  .includes(query.trim().toLocaleLowerCase())
              }
            >
              <ComboboxInput
                id="asset-account-type"
                className="w-full"
                placeholder="搜索账户类型…"
                autoFocus
              />
              <ComboboxContent>
                <ComboboxEmpty>未找到账户类型</ComboboxEmpty>
                <ComboboxList>
                  {(accountType: AssetAccountType) => (
                    <ComboboxItem key={accountType} value={accountType}>
                      <AccountTypeIcon type={accountType} className="size-4" />
                      <span>{assetAccountTypeLabels[accountType]}</span>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="asset-account-name">账户名称</Label>
            <Input
              id="asset-account-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setError('')
              }}
              placeholder="例如：我的美股账户"
              maxLength={50}
            />
          </div>
          {supportsAutoSync && (
            <div className="flex items-center justify-between gap-4 rounded-sm border bg-muted/20 px-4 py-3.5">
              <div>
                <Label htmlFor="asset-account-auto-sync">自动同步</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  {type === 'Futu'
                    ? '通过 Futu OpenD 同步持仓'
                    : type === 'Ibkr'
                      ? '通过 Client Portal Gateway 同步持仓'
                      : type === 'Okx'
                        ? '通过 OKX 只读 API 同步持仓'
                        : '通过币安只读 API 同步持仓'}
                </p>
              </div>
              <Switch
                id="asset-account-auto-sync"
                checked={autoSync}
                onCheckedChange={(checked) => {
                  setAutoSync(checked)
                  setError('')
                }}
              />
            </div>
          )}
          {!supportsAutoSync && (
            <div className="rounded-sm border bg-muted/20 px-4 py-3.5">
              <p className="text-sm font-medium">手动维护</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {type === 'Alipay'
                  ? '支付宝'
                  : type === 'Boci'
                    ? '中银国际'
                  : type === 'Cmb'
                    ? '招商银行'
                    : type === 'Boc'
                      ? '中国银行'
                    : '通用'}
                此类资产账户暂不支持自动同步，可手动添加和编辑持仓
              </p>
            </div>
          )}
          {type === 'Futu' && autoSync && (
            <div className="grid gap-3 rounded-sm border bg-muted/20 p-4">
              <div>
                <p className="text-sm font-medium">Futu OpenD 配置</p>
                <p
                  id="asset-account-futu-credential-description"
                  className="mt-1 text-xs text-muted-foreground"
                >
                  {account?.type === 'Futu' &&
                  integration?.provider === 'Futu' &&
                  integration.websocket.credentialConfigured
                    ? '密钥已安全保存；留空保持不变，输入新密钥可替换'
                    : '连接 WebSocket 服务；密钥可不填'}
                </p>
              </div>
              <div className="grid grid-cols-[1fr_8rem] gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="asset-account-sync-host">地址</Label>
                  <Input
                    id="asset-account-sync-host"
                    value={syncHost}
                    onChange={(event) => {
                      setSyncHost(event.target.value)
                      setError('')
                    }}
                    placeholder={DEFAULT_FUTU_OPEND_HOST}
                    maxLength={253}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="asset-account-sync-port">端口</Label>
                  <Input
                    id="asset-account-sync-port"
                    type="number"
                    value={syncPort}
                    onChange={(event) => {
                      setSyncPort(event.target.value)
                      setError('')
                    }}
                    min="1"
                    max="65535"
                    step="1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-[1fr_8rem] gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="asset-account-sync-key">密钥</Label>
                  <Input
                    id="asset-account-sync-key"
                    type="password"
                    value={syncKey}
                    onChange={(event) => {
                      setSyncKey(event.target.value)
                      setError('')
                    }}
                    placeholder={
                      account?.type === 'Futu' &&
                      integration?.provider === 'Futu' &&
                      integration.websocket.credentialConfigured
                        ? '已安全保存；留空保持不变'
                        : 'WebSocket Authentication Key'
                    }
                    aria-describedby="asset-account-futu-credential-description"
                    autoComplete="off"
                    maxLength={256}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="asset-account-sync-interval">间隔（秒）</Label>
                  <Input
                    id="asset-account-sync-interval"
                    type="number"
                    value={syncInterval}
                    onChange={(event) => {
                      setSyncInterval(event.target.value)
                      setError('')
                    }}
                    min="5"
                    max="3600"
                    step="1"
                  />
                </div>
              </div>
            </div>
          )}
          {type === 'Okx' && autoSync && (
            <div className="grid gap-3 rounded-sm border bg-muted/20 p-4">
              <div>
                <p className="text-sm font-medium">OKX API 配置</p>
                <p
                  id="asset-account-okx-credential-description"
                  className="mt-1 text-xs text-muted-foreground"
                >
                  {account?.type === 'Okx' && integration?.provider === 'Okx'
                    ? '凭据已安全保存；全部留空保持不变，填写全部字段可替换'
                    : '仅需读取权限'}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="asset-account-okx-api-key">API Key</Label>
                <Input
                  id="asset-account-okx-api-key"
                  value={okxApiKey}
                  onChange={(event) => {
                    setOkxApiKey(event.target.value)
                    setError('')
                  }}
                  placeholder={
                    account?.type === 'Okx' && integration?.provider === 'Okx'
                      ? '已安全保存；留空保持不变'
                      : undefined
                  }
                  aria-describedby="asset-account-okx-credential-description"
                  autoComplete="off"
                  maxLength={256}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="asset-account-okx-secret-key">Secret Key</Label>
                  <Input
                    id="asset-account-okx-secret-key"
                    type="password"
                    value={okxSecretKey}
                    onChange={(event) => {
                      setOkxSecretKey(event.target.value)
                      setError('')
                    }}
                    placeholder={
                      account?.type === 'Okx' && integration?.provider === 'Okx'
                        ? '已安全保存；留空保持不变'
                        : undefined
                    }
                    aria-describedby="asset-account-okx-credential-description"
                    autoComplete="new-password"
                    maxLength={512}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="asset-account-okx-passphrase">Passphrase</Label>
                  <Input
                    id="asset-account-okx-passphrase"
                    type="password"
                    value={okxPassphrase}
                    onChange={(event) => {
                      setOkxPassphrase(event.target.value)
                      setError('')
                    }}
                    placeholder={
                      account?.type === 'Okx' && integration?.provider === 'Okx'
                        ? '已安全保存；留空保持不变'
                        : undefined
                    }
                    aria-describedby="asset-account-okx-credential-description"
                    autoComplete="new-password"
                    maxLength={256}
                  />
                </div>
              </div>
              <div className="grid max-w-40 gap-2">
                <Label htmlFor="asset-account-okx-sync-interval">间隔（秒）</Label>
                <Input
                  id="asset-account-okx-sync-interval"
                  type="number"
                  value={syncInterval}
                  onChange={(event) => {
                    setSyncInterval(event.target.value)
                    setError('')
                  }}
                  min="5"
                  max="3600"
                  step="1"
                />
              </div>
            </div>
          )}
          {type === 'Ibkr' && autoSync && (
            <div className="grid gap-3 rounded-sm border bg-muted/20 p-4">
              <div>
                <p className="text-sm font-medium">IBKR Client Portal Gateway</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  请先启动本机 Gateway，并在浏览器完成登录；仅支持回环地址
                </p>
              </div>
              <div className="grid grid-cols-[1fr_8rem] gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="asset-account-ibkr-host">地址</Label>
                  <Input
                    id="asset-account-ibkr-host"
                    value={ibkrGatewayHost}
                    onChange={(event) => {
                      setIbkrGatewayHost(event.target.value)
                      setError('')
                    }}
                    placeholder={DEFAULT_IBKR_GATEWAY_HOST}
                    maxLength={64}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="asset-account-ibkr-port">端口</Label>
                  <Input
                    id="asset-account-ibkr-port"
                    type="number"
                    value={ibkrGatewayPort}
                    onChange={(event) => {
                      setIbkrGatewayPort(event.target.value)
                      setError('')
                    }}
                    min="1"
                    max="65535"
                    step="1"
                  />
                </div>
              </div>
              <div className="grid max-w-40 gap-2">
                <Label htmlFor="asset-account-ibkr-sync-interval">间隔（秒）</Label>
                <Input
                  id="asset-account-ibkr-sync-interval"
                  type="number"
                  value={syncInterval}
                  onChange={(event) => {
                    setSyncInterval(event.target.value)
                    setError('')
                  }}
                  min="5"
                  max="3600"
                  step="1"
                />
              </div>
            </div>
          )}
          {type === 'Binance' && autoSync && (
            <div className="grid gap-3 rounded-sm border bg-muted/20 p-4">
              <div>
                <p className="text-sm font-medium">币安 API 配置</p>
                <p
                  id="asset-account-binance-credential-description"
                  className="mt-1 text-xs text-muted-foreground"
                >
                  {account?.type === 'Binance' && integration?.provider === 'Binance'
                    ? '凭据已安全保存；全部留空保持不变，填写全部字段可替换'
                    : '使用 HMAC API Key，仅需读取权限'}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="asset-account-binance-api-key">API Key</Label>
                <Input
                  id="asset-account-binance-api-key"
                  value={binanceApiKey}
                  onChange={(event) => {
                    setBinanceApiKey(event.target.value)
                    setError('')
                  }}
                  placeholder={
                    account?.type === 'Binance' && integration?.provider === 'Binance'
                      ? '已安全保存；留空保持不变'
                      : undefined
                  }
                  aria-describedby="asset-account-binance-credential-description"
                  autoComplete="off"
                  maxLength={256}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="asset-account-binance-secret-key">Secret Key</Label>
                <Input
                  id="asset-account-binance-secret-key"
                  type="password"
                  value={binanceSecretKey}
                  onChange={(event) => {
                    setBinanceSecretKey(event.target.value)
                    setError('')
                  }}
                  placeholder={
                    account?.type === 'Binance' && integration?.provider === 'Binance'
                      ? '已安全保存；留空保持不变'
                      : undefined
                  }
                  aria-describedby="asset-account-binance-credential-description"
                  autoComplete="new-password"
                  maxLength={512}
                />
              </div>
              <div className="grid max-w-40 gap-2">
                <Label htmlFor="asset-account-binance-sync-interval">间隔（秒）</Label>
                <Input
                  id="asset-account-binance-sync-interval"
                  type="number"
                  value={syncInterval}
                  onChange={(event) => {
                    setSyncInterval(event.target.value)
                    setError('')
                  }}
                  min="5"
                  max="3600"
                  step="1"
                />
              </div>
            </div>
          )}
          {error && <FieldMessage id="asset-account-error">{error}</FieldMessage>}
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
              {submitting
                ? account
                  ? '保存中…'
                  : '添加中…'
                : account
                  ? '保存'
                  : '添加'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function PositionDialog({
  open,
  onOpenChange,
  position,
  onSubmit
}: BaseDialogProps & {
  position?: Position
  onSubmit: (input: PositionInput) => Promise<string | null>
}) {
  const [market, setMarket] = useState<Market>('US')
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [error, setError] = useState<{
    field: 'identity' | 'quantity' | 'price'
    message: string
  } | null>(null)
  const { submitting, submissionInFlight, beginSubmission, endSubmission } =
    useSubmissionGuard()

  useEffect(() => {
    if (!open) return
    setMarket(position?.market ?? 'US')
    setSymbol(position?.symbol ?? '')
    setName(position?.name ?? '')
    setCurrency(position?.currency ?? 'USD')
    setQuantity(position ? String(position.quantity) : '')
    setPrice(position?.price === undefined ? '' : String(position.price))
    setError(null)
    // Preserve edits across background sync refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, position?.id])

  function handleMarketChange(value: string): void {
    const nextMarket = value as Market
    const previousDefault = defaultCurrencyByMarket[market]
    setMarket(nextMarket)
    if (!currency || currency === previousDefault) setCurrency(defaultCurrencyByMarket[nextMarket])
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (submissionInFlight.current) return
    const parsedQuantity = Number(quantity)
    const parsedPrice = Number(price)
    if (!symbol.trim() || !name.trim() || !currency.trim()) {
      setError({ field: 'identity', message: '请填写资产代码、资产名称和币种' })
      return
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError({ field: 'quantity', message: '资产数量必须大于 0' })
      return
    }
    if (!price.trim()) {
      setError({ field: 'price', message: '请填写当前价格' })
      return
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError({ field: 'price', message: '当前价格必须是大于或等于 0 的数字' })
      return
    }

    if (!beginSubmission()) return
    try {
      const submitError = await onSubmit({
        market,
        symbol,
        name,
        currency,
        quantity: parsedQuantity,
        price: parsedPrice
      })
      if (submitError) {
        reportOperationError(position ? '更新持仓失败' : '添加持仓失败', submitError)
        return
      }
      onOpenChange(false)
    } catch (submitError) {
      reportOperationError(position ? '更新持仓失败' : '添加持仓失败', submitError)
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{position ? '编辑持仓' : '添加持仓'}</DialogTitle>
          <DialogDescription className="sr-only">
            设置持仓市场、代码、币种、数量和当前价格
          </DialogDescription>
        </DialogHeader>
        <form className="contents" onSubmit={handleSubmit}>
          <DialogBody>
          <FieldGroup>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel>市场</FieldLabel>
              <Select value={market} onValueChange={handleMarketChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {marketOrder.map((value) => (
                      <SelectItem key={value} value={value}>
                        {marketMeta[value].label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field data-invalid={error?.field === 'identity'}>
              <FieldLabel htmlFor="position-symbol">资产代码</FieldLabel>
              <Input
                id="position-symbol"
                aria-invalid={error?.field === 'identity'}
                aria-describedby={
                  error?.field === 'identity' ? 'position-identity-error' : undefined
                }
                value={symbol}
                onChange={(event) => {
                  setSymbol(event.target.value.toUpperCase())
                  setError(null)
                }}
                placeholder={
                  market === 'CN'
                    ? '600519'
                    : market === 'HK'
                      ? '00700'
                      : market === 'US'
                        ? 'AAPL'
                        : 'BTC'
                }
                autoFocus
                maxLength={24}
              />
            </Field>
          </div>
          <Field data-invalid={error?.field === 'identity'}>
            <FieldLabel htmlFor="position-name">资产名称</FieldLabel>
            <Input
              id="position-name"
              aria-invalid={error?.field === 'identity'}
              aria-describedby={
                error?.field === 'identity' ? 'position-identity-error' : undefined
              }
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setError(null)
              }}
              placeholder="例如：Apple"
              maxLength={60}
            />
            {error?.field === 'identity' && (
              <FieldMessage id="position-identity-error">{error.message}</FieldMessage>
            )}
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field data-invalid={error?.field === 'identity'}>
              <FieldLabel htmlFor="position-currency">币种</FieldLabel>
              <Select
                value={currency}
                onValueChange={(value) => {
                  setCurrency(value)
                  setError(null)
                }}
              >
                <SelectTrigger
                  id="position-currency"
                  aria-invalid={error?.field === 'identity'}
                  aria-describedby={
                    error?.field === 'identity' ? 'position-identity-error' : undefined
                  }
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(POSITION_CURRENCIES.includes(currency)
                      ? POSITION_CURRENCIES
                      : [...POSITION_CURRENCIES, currency]
                    ).map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field data-invalid={error?.field === 'quantity'}>
              <FieldLabel htmlFor="position-quantity">资产数量</FieldLabel>
              <Input
                id="position-quantity"
                type="number"
                value={quantity}
                aria-invalid={error?.field === 'quantity'}
                aria-describedby={
                  error?.field === 'quantity' ? 'position-quantity-error' : undefined
                }
                onChange={(event) => {
                  setQuantity(event.target.value)
                  setError(null)
                }}
                placeholder="0"
                min="0"
                step="any"
              />
              {error?.field === 'quantity' && (
                <FieldMessage id="position-quantity-error">{error.message}</FieldMessage>
              )}
            </Field>
            <Field data-invalid={error?.field === 'price'}>
              <FieldLabel htmlFor="position-price">当前价格</FieldLabel>
              <Input
                id="position-price"
                type="number"
                value={price}
                aria-invalid={error?.field === 'price'}
                aria-describedby={
                  error?.field === 'price' ? 'position-price-error' : undefined
                }
                onChange={(event) => {
                  setPrice(event.target.value)
                  setError(null)
                }}
                placeholder="0.00"
                min="0"
                step="any"
                required
              />
              {error?.field === 'price' && (
                <FieldMessage id="position-price-error">{error.message}</FieldMessage>
              )}
            </Field>
          </div>
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
              {submitting
                ? position
                  ? '保存中…'
                  : '添加中…'
                : position
                  ? '保存'
                  : '添加'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { DeleteConfirmDialog } from './delete-confirm-dialog'
