import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction
} from 'react'
import {
  Check,
  ChartCandlestick,
  Coins,
  Copy,
  Download,
  ExternalLink,
  SlidersHorizontal,
  Trash2,
  Upload,
  Wrench
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
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
  InputGroup,
  InputGroupAddon,
  InputGroupInput
} from '@/components/ui/input-group'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  DEFAULT_MCP_ACCESS_SETTINGS,
  type McpAccessSettings,
  type McpConnectionSettings
} from '@/lib/mcp'
import {
  operationErrorMessage,
  randomTagColor,
  reportOperationError,
  reportValidationError,
  useSubmissionGuard
} from './dialog-utils'
import { TagColorDot } from './tag-badge'
import { TagSelector } from './tag-selector'
import { AccountTypeIcon } from './view-helpers'
import {
  BASE_CURRENCIES,
  accountTypeLabels,
  CRYPTO_QUOTE_PROVIDERS,
  cryptoQuoteProviderLabels,
  defaultCurrencyByMarket,
  DEFAULT_BASE_CURRENCY,
  DEFAULT_CRYPTO_QUOTE_PROVIDER,
  DEFAULT_EXCHANGE_RATE_PROVIDER,
  DEFAULT_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  DEFAULT_FUTU_OPEND_HOST,
  DEFAULT_FUTU_OPEND_PORT,
  DEFAULT_HSTONG_GATEWAY_HOST,
  DEFAULT_HSTONG_GATEWAY_PORT,
  DEFAULT_IBKR_GATEWAY_HOST,
  DEFAULT_IBKR_GATEWAY_PORT,
  DEFAULT_SYNC_INTERVAL,
  DEFAULT_STOCK_QUOTE_PROVIDER,
  exchangeRateProviderLabels,
  EXCHANGE_RATE_PROVIDERS,
  MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  marketMeta,
  marketOrder,
  MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  STOCK_QUOTE_PROVIDERS,
  stockQuoteProviderLabels,
  TAG_COLORS,
  tagColorLabels,
  type Account,
  type AccountIntegrationView,
  type AccountInput,
  type AccountType,
  type BaseCurrency,
  type CryptoQuoteProvider,
  type ExchangeRateProvider,
  type Market,
  type Position,
  type PositionInput,
  type StockQuoteProvider,
  type Tag,
  type TagColor,
  type TagInput,
  type Workspace,
  type WorkspaceInput,
  type WorkspaceSettingsInput
} from '@/lib/portfolio'

type BaseDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type AutoSyncProvider = 'Futu' | 'Hstong' | 'Ibkr' | 'Okx' | 'Binance'
type StorageLocationStatus = 'loading' | 'ready' | 'unavailable' | 'error'

const OFFICIAL_INTEGRATION_DOCS: Record<AutoSyncProvider, string> = {
  Futu: 'https://openapi.futunn.com/futu-api-doc/intro/intro.html?lang=zh-cn',
  Hstong: 'https://quant-open.hstong.com/api-docs/introduction/guidelines.html',
  Ibkr:
    'https://www.interactivebrokers.com/campus/trading-lessons/launching-and-authenticating-the-gateway/',
  Okx: 'https://www.okx.com/docs-v5/zh/#overview',
  Binance:
    'https://developers.binance.com/zh-CN/docs/products/spot/rest-api#general-api-information'
}

function OfficialIntegrationDocsLink({ provider }: { provider: AutoSyncProvider }) {
  return (
    <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
      <a href={OFFICIAL_INTEGRATION_DOCS[provider]} target="_blank" rel="noopener noreferrer">
        官方接入文档
        <ExternalLink data-icon="inline-end" />
      </a>
    </Button>
  )
}

const ACCOUNT_TYPES: readonly AccountType[] = [
  'Futu',
  'Hstong',
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

function defaultAccountName(type: AccountType): string {
  return `我的${accountTypeLabels[type]}`
}

export function TagDialog({
  open,
  onOpenChange,
  tag,
  onSubmit
}: BaseDialogProps & {
  tag?: Tag
  onSubmit: (input: TagInput) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState<TagColor>()
  const [error, setError] = useState('')
  const { submitting, submissionInFlight, beginSubmission, endSubmission } =
    useSubmissionGuard()

  useEffect(() => {
    if (!open) return
    setName(tag?.name ?? '')
    setColor(tag?.color)
    setError('')
  }, [open, tag])

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    event.stopPropagation()
    if (submissionInFlight.current) return
    const normalizedName = name.trim()
    if (!normalizedName) {
      const message = '请输入名称'
      setError(message)
      reportValidationError(message)
      return
    }
    if (!beginSubmission()) return
    try {
      const resolvedColor = color ?? randomTagColor()
      setColor(resolvedColor)
      await onSubmit({ name: normalizedName, color: resolvedColor })
      onOpenChange(false)
    } catch (submitError) {
      reportOperationError(tag ? '更新标签失败' : '添加标签失败', submitError)
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
          <DialogTitle>{tag ? '编辑标签' : '添加标签'}</DialogTitle>
          <DialogDescription className="sr-only">
            {tag ? '修改标签名称和颜色' : '添加可用于账户和持仓的标签'}
          </DialogDescription>
        </DialogHeader>
        <form className="contents" onSubmit={handleSubmit}>
          <DialogBody>
            <FieldGroup>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="tag-name">名称</FieldLabel>
                <Input
                  id="tag-name"
                  value={name}
                  aria-invalid={Boolean(error)}
                  onChange={(event) => {
                    setName(event.target.value)
                    setError('')
                  }}
                  placeholder="长期投资"
                  maxLength={40}
                  autoFocus
                />
              </Field>
              <FieldSet className="gap-2">
                <FieldLegend className="leading-none">颜色</FieldLegend>
                <ToggleGroup
                  type="single"
                  value={color}
                  className="justify-start"
                  onValueChange={(value) => {
                    setColor(value ? value as TagColor : undefined)
                  }}
                >
                  {TAG_COLORS.map((tagColor) => (
                    <ToggleGroupItem
                      key={tagColor}
                      value={tagColor}
                      aria-label={tagColorLabels[tagColor]}
                      title={tagColorLabels[tagColor]}
                      className="group size-10 min-w-10 justify-start bg-transparent p-0 data-[state=on]:bg-transparent"
                    >
                      <TagColorDot
                        color={tagColor}
                        className="size-4 transition-shadow group-data-[state=on]:ring-2 group-data-[state=on]:ring-ring group-data-[state=on]:ring-offset-2 group-data-[state=on]:ring-offset-background"
                      />
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </FieldSet>
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
                ? tag
                  ? '保存中…'
                  : '添加中…'
                : tag
                  ? '保存'
                  : '添加'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TagAssignmentDialog({
  open,
  onOpenChange,
  title,
  tags,
  selectedTagIds,
  onCreateTag,
  onSubmit
}: BaseDialogProps & {
  title: string
  tags: Tag[]
  selectedTagIds: string[]
  onCreateTag: (input: TagInput) => Promise<string>
  onSubmit: (tagIds: string[]) => Promise<string | null>
}) {
  const [tagIds, setTagIds] = useState<string[]>([])
  const { submitting, beginSubmission, endSubmission } = useSubmissionGuard()

  useEffect(() => {
    if (open) setTagIds(selectedTagIds)
    // Preserve edits when adding a tag refreshes the workspace in the background.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!beginSubmission()) return
    try {
      const submitError = await onSubmit(tagIds)
      if (submitError) {
        reportOperationError('更新标签失败', submitError)
        return
      }
      onOpenChange(false)
    } catch (submitError) {
      reportOperationError('更新标签失败', submitError)
    } finally {
      endSubmission()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !submitting && onOpenChange(nextOpen)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form className="contents" onSubmit={handleSubmit}>
          <DialogBody>
            <TagSelector
              tags={tags}
              selectedIds={tagIds}
              onSelectedIdsChange={setTagIds}
              onCreateTag={onCreateTag}
              hideLabel
            />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Spinner data-icon="inline-start" />}
              {submitting ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

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
      toast.success('MCP 协议配置已复制')
    } catch (error) {
      toast.error(`复制 MCP 协议配置失败：${operationErrorMessage(error)}`)
    }
  }

  return (
    <section className="grid gap-5">
      <div>
        <h3 className="text-base font-semibold">MCP 协议</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          允许 Agent 在你授权的范围内读取或维护 Chromie 数据
        </p>
      </div>
      <div className="divide-y overflow-hidden rounded-sm border">
        <div className="flex items-center justify-between gap-6 p-4">
          <div>
            <Label htmlFor="mcp-enabled">启用 MCP 协议</Label>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              关闭后本地 MCP 协议连接立即停止
            </p>
          </div>
          <Switch
            id="mcp-enabled"
            checked={access.enabled}
            onCheckedChange={(enabled) =>
              setAccess((current) => ({ ...current, enabled }))
            }
          />
        </div>
        <div className="flex items-center justify-between gap-6 p-4">
          <div>
            <Label htmlFor="mcp-write">允许写入</Label>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              允许创建和修改资产数据
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
            <Label>MCP 协议客户端配置</Label>
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
  initialSection?: 'basic' | 'currency' | 'quotes' | 'mcp'
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
  const [stockQuoteProvider, setStockQuoteProvider] =
    useState<StockQuoteProvider>(DEFAULT_STOCK_QUOTE_PROVIDER)
  const [cryptoQuoteProvider, setCryptoQuoteProvider] =
    useState<CryptoQuoteProvider>(DEFAULT_CRYPTO_QUOTE_PROVIDER)
  const [section, setSection] =
    useState<'basic' | 'currency' | 'quotes' | 'mcp'>('basic')
  const [mcpConnection, setMcpConnection] =
    useState<McpConnectionSettings | null>(null)
  const [mcpAccess, setMcpAccess] =
    useState<McpAccessSettings>({ ...DEFAULT_MCP_ACCESS_SETTINGS })
  const [mcpLoading, setMcpLoading] = useState(false)
  const [storagePath, setStoragePath] = useState('')
  const [storageLocationStatus, setStorageLocationStatus] =
    useState<StorageLocationStatus>('loading')
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
    setStockQuoteProvider(
      STOCK_QUOTE_PROVIDERS.includes(workspace.stockQuoteProvider)
        ? workspace.stockQuoteProvider
        : DEFAULT_STOCK_QUOTE_PROVIDER
    )
    setCryptoQuoteProvider(
      CRYPTO_QUOTE_PROVIDERS.includes(workspace.cryptoQuoteProvider)
        ? workspace.cryptoQuoteProvider
        : DEFAULT_CRYPTO_QUOTE_PROVIDER
    )
    setSection(initialSection)
    setError('')
  }, [workspace.id, initialSection, open])

  useEffect(() => {
    if (!open) return
    let mounted = true
    const storage = window.desktop.storage
    setStoragePath('')
    setStorageLocationStatus('loading')
    if (!storage) {
      setStorageLocationStatus('unavailable')
      reportOperationError(
        '读取数据存储位置失败',
        '请完全退出并重新打开 Chromie 后重试'
      )
      return
    }
    const timeout = window.setTimeout(() => {
      if (!mounted) return
      setStorageLocationStatus('error')
      reportOperationError('读取数据存储位置失败', '读取超时，请重新打开设置后重试')
    }, 5000)
    void storage
      .getLocation()
      .then((location) => {
        if (!mounted) return
        window.clearTimeout(timeout)
        if (!location?.path) throw new Error('返回的数据存储位置无效')
        setStoragePath(location.path)
        setStorageLocationStatus('ready')
      })
      .catch((loadError) => {
        if (!mounted) return
        window.clearTimeout(timeout)
        setStorageLocationStatus('error')
        reportOperationError('读取数据存储位置失败', loadError)
      })
    return () => {
      mounted = false
      window.clearTimeout(timeout)
    }
  }, [open])

  const storageLocationPlaceholder =
    storageLocationStatus === 'loading'
      ? '正在读取…'
      : storageLocationStatus === 'unavailable'
        ? '数据组件未加载'
        : storageLocationStatus === 'error'
          ? '读取失败'
          : ''

  useEffect(() => {
    if (!open || section !== 'mcp') return
    let mounted = true
    const mcp = window.desktop.mcp

    setMcpConnection(null)
    setMcpAccess({ ...DEFAULT_MCP_ACCESS_SETTINGS })
    setMcpError('')
    setMcpLoading(false)
    if (!mcp) {
      const message = 'MCP 协议组件尚未加载，请重启 Chromie'
      setMcpError(message)
      reportOperationError('MCP 协议操作失败', message)
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
        reportOperationError('MCP 协议操作失败', message)
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
        const message = 'MCP 协议组件尚未加载，请重启 Chromie'
        setMcpError(message)
        reportOperationError('MCP 协议操作失败', message)
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
        reportOperationError('MCP 协议操作失败', message)
      } finally {
        endSubmission()
      }
      return
    }
    if (!name.trim()) {
      setSection('basic')
      const message = '请输入工作区名称'
      setError(message)
      reportValidationError(message)
      return
    }
    if (!storagePath.trim()) {
      setSection('basic')
      setStorageLocationStatus('error')
      reportValidationError('请输入数据存储路径')
      return
    }
    const storage = window.desktop.storage
    if (!storage) {
      setSection('basic')
      setStorageLocationStatus('unavailable')
      reportValidationError('请完全退出并重新打开 Chromie 后重试')
      return
    }
    const refreshInterval = Number(exchangeRateRefreshInterval)
    if (
      !Number.isInteger(refreshInterval) ||
      refreshInterval < MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES ||
      refreshInterval > MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES
    ) {
      setSection('currency')
      const message =
        `更新间隔请输入 ${MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES} 至 ${MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES} 分钟之间的整数`
      setError(message)
      reportValidationError(message)
      return
    }
    if (!beginSubmission()) return
    let operation: 'storage' | 'workspace' = 'storage'
    try {
      const validatedLocation = await storage.validateLocation(storagePath)
      setStoragePath(validatedLocation.path)
      setStorageLocationStatus('ready')
      operation = 'workspace'
      await onSubmit({
        name,
        baseCurrency,
        exchangeRateProvider,
        exchangeRateRefreshIntervalMinutes: refreshInterval,
        stockQuoteProvider,
        cryptoQuoteProvider
      })
      operation = 'storage'
      const result = await storage.updateLocation(validatedLocation.path)
      setStoragePath(result.location.path)
      if (result.changed) {
        toast.success('存储位置已更新，Chromie 即将重启')
      }
      onOpenChange(false)
    } catch (submitError) {
      if (operation === 'storage') {
        const message = operationErrorMessage(submitError)
        setSection('basic')
        setStorageLocationStatus('error')
        reportOperationError('保存数据存储位置失败', message)
      } else {
        reportOperationError('保存工作区设置失败', submitError)
      }
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
            管理工作区基础信息、币种与汇率、行情数据、MCP 协议和工作区状态
          </DialogDescription>
        </DialogHeader>
        <form
          className="contents"
          aria-invalid={section !== 'mcp' && Boolean(error)}
          onSubmit={handleSubmit}
        >
          <DialogBody className="grid grid-cols-[10.5rem_minmax(0,1fr)] overflow-hidden p-0">
            <aside className="border-r border-border bg-background/40 p-3 text-foreground">
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
                    section === 'quotes' &&
                      'bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent'
                  )}
                  onClick={() => setSection('quotes')}
                >
                  <ChartCandlestick className="size-4" />
                  行情数据
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
                  MCP 协议
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
                      placeholder="家庭资产"
                      maxLength={40}
                    />
                  </div>
                  <Field
                    data-disabled={
                      storageLocationStatus === 'loading' ||
                      storageLocationStatus === 'unavailable'
                    }
                    data-invalid={
                      storageLocationStatus === 'unavailable' ||
                      storageLocationStatus === 'error'
                    }
                  >
                    <FieldLabel htmlFor="workspace-settings-storage-path">
                      数据存储位置
                    </FieldLabel>
                    <Input
                      id="workspace-settings-storage-path"
                      value={storagePath}
                      placeholder={storageLocationPlaceholder || '/Users/name/.chromie'}
                      aria-invalid={
                        storageLocationStatus === 'unavailable' ||
                        storageLocationStatus === 'error'
                      }
                      disabled={
                        submitting ||
                        storageLocationStatus === 'loading' ||
                        storageLocationStatus === 'unavailable'
                      }
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={4096}
                      onChange={(event) => {
                        setStoragePath(event.target.value)
                        setStorageLocationStatus('ready')
                      }}
                    />
                    <FieldDescription>
                      支持绝对路径或 ~/ 开头的路径，保存时检查写入权限，路径变化后自动重启
                    </FieldDescription>
                  </Field>
                  <Separator />
                  <div className="flex items-center justify-between gap-5">
                    <div className="grid gap-1">
                      <p className="text-sm font-medium">导出工作区</p>
                      <p className="text-xs leading-5 text-muted-foreground">
                        导出工作区数据、历史快照与账户同步配置
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
                      placeholder={String(DEFAULT_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES)}
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

                {section === 'quotes' && (
                <section className="grid gap-5">
                  <div className="grid gap-1">
                    <h3 className="text-base font-semibold">行情数据</h3>
                    <p className="text-xs leading-5 text-muted-foreground">
                      添加或编辑持仓时，根据市场和资产代码自动填写名称、币种与当前价格
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="workspace-settings-stock-quote-provider">
                      股票资产
                    </Label>
                    <Select
                      value={stockQuoteProvider}
                      onValueChange={(value) => {
                        setStockQuoteProvider(value as StockQuoteProvider)
                        setError('')
                      }}
                    >
                      <SelectTrigger id="workspace-settings-stock-quote-provider">
                        <SelectValue placeholder="选择股票行情数据源">
                          {stockQuoteProviderLabels[stockQuoteProvider]}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {STOCK_QUOTE_PROVIDERS.map((provider) => (
                            <SelectItem key={provider} value={provider}>
                              {stockQuoteProviderLabels[provider]}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <p className="text-xs leading-5 text-muted-foreground">
                      用于中国内地、香港和美国市场，默认使用东方财富
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="workspace-settings-crypto-quote-provider">
                      加密资产
                    </Label>
                    <Select
                      value={cryptoQuoteProvider}
                      onValueChange={(value) => {
                        setCryptoQuoteProvider(value as CryptoQuoteProvider)
                        setError('')
                      }}
                    >
                      <SelectTrigger id="workspace-settings-crypto-quote-provider">
                        <SelectValue placeholder="选择加密资产行情数据源">
                          {cryptoQuoteProviderLabels[cryptoQuoteProvider]}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {CRYPTO_QUOTE_PROVIDERS.map((provider) => (
                            <SelectItem key={provider} value={provider}>
                              {cryptoQuoteProviderLabels[provider]}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <p className="text-xs leading-5 text-muted-foreground">
                      用于 CC 市场，默认使用 Coinbase，数据源不可用时可继续手动填写
                    </p>
                  </div>
                </section>
              )}

                {section === 'mcp' && (
                <div className="grid gap-4">
                  {mcpLoading ? (
                    <div className="grid gap-5" aria-label="正在加载 MCP 协议设置">
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

          <DialogFooter className="items-center sm:justify-end">
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
                  (section !== 'mcp' &&
                    (storageLocationStatus === 'loading' ||
                      storageLocationStatus === 'unavailable')) ||
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

export function ImportBackupDialog({
  open,
  onOpenChange,
  workspaceName,
  accountCount,
  tagCount,
  positionCount,
  snapshotCount,
  integrationCount,
  onConfirm
}: BaseDialogProps & {
  workspaceName: string
  accountCount: number
  tagCount: number
  positionCount: number
  snapshotCount: number
  integrationCount: number
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
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>导入“{workspaceName}”？</DialogTitle>
          <DialogDescription>
            备份将作为新的工作区导入，不会覆盖现有数据
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Alert>
            <Download aria-hidden="true" />
            <AlertTitle>备份内容</AlertTitle>
            <AlertDescription>
              {accountCount} 个账户、{tagCount} 个标签、{positionCount} 项持仓和{' '}
              {snapshotCount} 个历史快照，其中 {integrationCount} 个账户带有同步配置
            </AlertDescription>
          </Alert>
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
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>导出当前工作区？</DialogTitle>
          <DialogDescription>将生成一份可重新导入 Chromie 的备份文件</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Alert>
            <Upload aria-hidden="true" />
            <AlertTitle>备份包含同步凭据</AlertTitle>
            <AlertDescription>
              连接参数和 API 凭据会写入备份文件，请将文件保存在可信位置
            </AlertDescription>
          </Alert>
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

export function AccountDialog({
  open,
  onOpenChange,
  account,
  integration,
  tags,
  onCreateTag,
  onSubmit
}: BaseDialogProps & {
  account?: Account
  integration?: AccountIntegrationView
  tags: Tag[]
  onCreateTag: (input: TagInput) => Promise<string>
  onSubmit: (input: AccountInput) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [type, setType] = useState<AccountType>('Futu')
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
  const [hstongGatewayHost, setHstongGatewayHost] = useState(
    DEFAULT_HSTONG_GATEWAY_HOST
  )
  const [hstongGatewayPort, setHstongGatewayPort] = useState(
    String(DEFAULT_HSTONG_GATEWAY_PORT)
  )
  const [hstongTradingPassword, setHstongTradingPassword] = useState('')
  const [binanceApiKey, setBinanceApiKey] = useState('')
  const [binanceSecretKey, setBinanceSecretKey] = useState('')
  const [error, setError] = useState('')
  const { submitting, submissionInFlight, beginSubmission, endSubmission } =
    useSubmissionGuard()
  const supportsAutoSync =
    type === 'Futu' ||
    type === 'Hstong' ||
    type === 'Okx' ||
    type === 'Ibkr' ||
    type === 'Binance'
  const canKeepHstongCredential =
    account?.type === 'Hstong' &&
    integration?.provider === 'Hstong' &&
    integration.gateway.credentialConfigured

  useEffect(() => {
    if (!open) return
    setName(account?.name ?? defaultAccountName(account?.type ?? 'Futu'))
    setTagIds(account?.tagIds ?? [])
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
    setHstongGatewayHost(
      integration?.provider === 'Hstong'
        ? integration.gateway.host
        : DEFAULT_HSTONG_GATEWAY_HOST
    )
    setHstongGatewayPort(
      String(
        integration?.provider === 'Hstong'
          ? integration.gateway.port
          : DEFAULT_HSTONG_GATEWAY_PORT
      )
    )
    setHstongTradingPassword('')
    setBinanceApiKey('')
    setBinanceSecretKey('')
    setError('')
    // Background syncs refresh account props while this dialog is open. Do not
    // discard credential replacements or other edits that the user is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id, open])

  function handleAccountTypeChange(nextType: AccountType): void {
    setName((currentName) =>
      !currentName.trim() || currentName === defaultAccountName(type)
        ? defaultAccountName(nextType)
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

  function failValidation(message: string): void {
    setError(message)
    reportValidationError(message)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (submissionInFlight.current) return
    if (!name.trim()) {
      failValidation('请输入账户名称')
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
    const hasHstongTradingPassword = hstongTradingPassword.length > 0
    if (type === 'Futu' && syncEnabled && !syncHost.trim()) {
      failValidation('请输入 Futu OpenD 地址')
      return
    }
    if (
      type === 'Futu' &&
      syncEnabled &&
      (!Number.isInteger(parsedSyncPort) || parsedSyncPort < 1 || parsedSyncPort > 65535)
    ) {
      failValidation('Futu OpenD 端口需为 1 至 65535')
      return
    }
    if (
      syncEnabled &&
      (!Number.isInteger(parsedSyncInterval) || parsedSyncInterval < 5 || parsedSyncInterval > 3600)
    ) {
      failValidation('同步间隔需为 5 至 3600 秒')
      return
    }
    if (
      type === 'Okx' &&
      syncEnabled &&
      ((!canKeepOkxCredential && !hasAnyOkxCredential) ||
        (hasAnyOkxCredential &&
          (!okxApiKey.trim() || !okxSecretKey || !okxPassphrase)))
    ) {
      failValidation('请填写完整的 OKX API 配置')
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
      failValidation('IBKR Client Portal Gateway 地址必须是本地回环地址')
      return
    }
    if (
      type === 'Ibkr' &&
      syncEnabled &&
      (!Number.isInteger(parsedIbkrGatewayPort) ||
        parsedIbkrGatewayPort < 1 ||
        parsedIbkrGatewayPort > 65535)
    ) {
      failValidation('IBKR Client Portal Gateway 端口需为 1 至 65535')
      return
    }
    if (
      type === 'Binance' &&
      syncEnabled &&
      ((!canKeepBinanceCredential && !hasAnyBinanceCredential) ||
        (hasAnyBinanceCredential &&
          (!binanceApiKey.trim() || !binanceSecretKey)))
    ) {
      failValidation('请填写完整的币安 API 配置')
      return
    }
    const parsedHstongGatewayPort = Number(hstongGatewayPort)
    const normalizedHstongGatewayHost = hstongGatewayHost
      .trim()
      .toLowerCase()
      .replace(/^\[|\]$/g, '')
    if (
      type === 'Hstong' &&
      syncEnabled &&
      !['127.0.0.1', 'localhost', '::1'].includes(normalizedHstongGatewayHost)
    ) {
      failValidation('华盛 OpenAPI Gateway 地址必须是本地回环地址')
      return
    }
    if (
      type === 'Hstong' &&
      syncEnabled &&
      (!Number.isInteger(parsedHstongGatewayPort) ||
        parsedHstongGatewayPort < 1 ||
        parsedHstongGatewayPort > 65535)
    ) {
      failValidation('华盛 OpenAPI Gateway 端口需为 1 至 65535')
      return
    }
    const lastSyncedAt =
      account?.type === type ? account.sync?.lastSyncedAt : undefined
    if (!beginSubmission()) return
    try {
      await onSubmit({
          name: name.trim(),
          type,
          tagIds,
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
                  : type === 'Hstong'
                    ? {
                        provider: 'Hstong' as const,
                        gateway: {
                          host: normalizedHstongGatewayHost,
                          port: parsedHstongGatewayPort,
                          credential: hasHstongTradingPassword
                            ? {
                                mode: 'replace' as const,
                                value: {
                                  tradingPassword: hstongTradingPassword
                                }
                              }
                            : canKeepHstongCredential
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
      reportOperationError(account ? '更新账户失败' : '添加账户失败', submitError)
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
      <DialogContent className="max-h-[92vh] max-w-2xl">
        <DialogHeader>
          <DialogTitle>{account ? '编辑账户' : '添加账户'}</DialogTitle>
          <DialogDescription className="sr-only">
            设置账户名称、类型、标签和同步来源
          </DialogDescription>
        </DialogHeader>
        <form
          className="contents"
          aria-invalid={Boolean(error)}
          onSubmit={handleSubmit}
        >
          <DialogBody>
          <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="account-type">账户类型</FieldLabel>
            <Combobox
              items={ACCOUNT_TYPES}
              value={type}
              onValueChange={(nextType) => {
                if (nextType) handleAccountTypeChange(nextType)
              }}
              itemToStringLabel={(accountType) => accountTypeLabels[accountType]}
              itemToStringValue={(accountType) => accountType}
              filter={(accountType, query) =>
                `${accountType} ${accountTypeLabels[accountType]}`
                  .toLocaleLowerCase()
                  .includes(query.trim().toLocaleLowerCase())
              }
            >
              <ComboboxInput
                id="account-type"
                className="w-full"
                placeholder="搜索账户类型…"
                autoFocus
              />
              <ComboboxContent>
                <ComboboxEmpty>未找到账户类型</ComboboxEmpty>
                <ComboboxList>
                  {(accountType: AccountType) => (
                    <ComboboxItem key={accountType} value={accountType}>
                      <AccountTypeIcon type={accountType} className="size-4" />
                      <span>{accountTypeLabels[accountType]}</span>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </Field>
          <Field>
            <FieldLabel htmlFor="account-name">账户名称</FieldLabel>
            <Input
              id="account-name"
              className="h-9"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setError('')
              }}
              placeholder="我的美股账户"
              maxLength={50}
            />
          </Field>
          <TagSelector
            tags={tags}
            selectedIds={tagIds}
            onSelectedIdsChange={setTagIds}
            onCreateTag={onCreateTag}
          />
          {supportsAutoSync && (
            <Field>
              <FieldLabel htmlFor="account-auto-sync">自动同步</FieldLabel>
              <Select
                value={autoSync ? 'enabled' : 'disabled'}
                onValueChange={(value) => {
                  setAutoSync(value === 'enabled')
                  setError('')
                }}
              >
                <SelectTrigger id="account-auto-sync" className="h-9">
                  <SelectValue placeholder="选择自动同步状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="disabled">关闭</SelectItem>
                    <SelectItem value="enabled">开启</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          )}
          {type === 'Futu' && autoSync && (
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Futu OpenD 配置</p>
                <OfficialIntegrationDocsLink provider="Futu" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="account-sync-host">地址</FieldLabel>
                  <Input
                    id="account-sync-host"
                    value={syncHost}
                    onChange={(event) => {
                      setSyncHost(event.target.value)
                      setError('')
                    }}
                    placeholder={DEFAULT_FUTU_OPEND_HOST}
                    maxLength={253}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="account-sync-port">端口</FieldLabel>
                  <Input
                    id="account-sync-port"
                    type="number"
                    placeholder={String(DEFAULT_FUTU_OPEND_PORT)}
                    value={syncPort}
                    onChange={(event) => {
                      setSyncPort(event.target.value)
                      setError('')
                    }}
                    min="1"
                    max="65535"
                    step="1"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="account-sync-key">密钥</FieldLabel>
                  <Input
                    id="account-sync-key"
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
                        ? '已保存，留空保持不变'
                        : 'WebSocket Authentication Key'
                    }
                    autoComplete="off"
                    maxLength={256}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="account-sync-interval">间隔（秒）</FieldLabel>
                  <Input
                    id="account-sync-interval"
                    type="number"
                    placeholder={String(DEFAULT_SYNC_INTERVAL)}
                    value={syncInterval}
                    onChange={(event) => {
                      setSyncInterval(event.target.value)
                      setError('')
                    }}
                    min="5"
                    max="3600"
                    step="1"
                  />
                </Field>
              </div>
            </div>
          )}
          {type === 'Okx' && autoSync && (
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">OKX API 配置</p>
                <OfficialIntegrationDocsLink provider="Okx" />
              </div>
              <Field>
                <FieldLabel htmlFor="account-okx-api-key">API Key</FieldLabel>
                <Input
                  id="account-okx-api-key"
                  value={okxApiKey}
                  onChange={(event) => {
                    setOkxApiKey(event.target.value)
                    setError('')
                  }}
                  placeholder={
                    account?.type === 'Okx' && integration?.provider === 'Okx'
                      ? '已保存，留空保持不变'
                      : '请输入 API Key'
                  }
                  autoComplete="off"
                  maxLength={256}
                />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="account-okx-secret-key">Secret Key</FieldLabel>
                  <Input
                    id="account-okx-secret-key"
                    type="password"
                    value={okxSecretKey}
                    onChange={(event) => {
                      setOkxSecretKey(event.target.value)
                      setError('')
                    }}
                    placeholder={
                      account?.type === 'Okx' && integration?.provider === 'Okx'
                        ? '已保存，留空保持不变'
                        : '请输入 Secret Key'
                    }
                    autoComplete="new-password"
                    maxLength={512}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="account-okx-passphrase">Passphrase</FieldLabel>
                  <Input
                    id="account-okx-passphrase"
                    type="password"
                    value={okxPassphrase}
                    onChange={(event) => {
                      setOkxPassphrase(event.target.value)
                      setError('')
                    }}
                    placeholder={
                      account?.type === 'Okx' && integration?.provider === 'Okx'
                        ? '已保存，留空保持不变'
                        : '请输入 Passphrase'
                    }
                    autoComplete="new-password"
                    maxLength={256}
                  />
                </Field>
              </div>
              <Field className="max-w-72">
                <FieldLabel htmlFor="account-okx-sync-interval">间隔（秒）</FieldLabel>
                <Input
                  id="account-okx-sync-interval"
                  type="number"
                  placeholder={String(DEFAULT_SYNC_INTERVAL)}
                  value={syncInterval}
                  onChange={(event) => {
                    setSyncInterval(event.target.value)
                    setError('')
                  }}
                  min="5"
                  max="3600"
                  step="1"
                />
              </Field>
            </div>
          )}
          {type === 'Ibkr' && autoSync && (
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">IBKR Client Portal Gateway 配置</p>
                <OfficialIntegrationDocsLink provider="Ibkr" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="account-ibkr-host">地址</FieldLabel>
                  <Input
                    id="account-ibkr-host"
                    value={ibkrGatewayHost}
                    onChange={(event) => {
                      setIbkrGatewayHost(event.target.value)
                      setError('')
                    }}
                    placeholder={DEFAULT_IBKR_GATEWAY_HOST}
                    maxLength={64}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="account-ibkr-port">端口</FieldLabel>
                  <Input
                    id="account-ibkr-port"
                    type="number"
                    placeholder={String(DEFAULT_IBKR_GATEWAY_PORT)}
                    value={ibkrGatewayPort}
                    onChange={(event) => {
                      setIbkrGatewayPort(event.target.value)
                      setError('')
                    }}
                    min="1"
                    max="65535"
                    step="1"
                  />
                </Field>
              </div>
              <Field className="max-w-72">
                <FieldLabel htmlFor="account-ibkr-sync-interval">间隔（秒）</FieldLabel>
                <Input
                  id="account-ibkr-sync-interval"
                  type="number"
                  placeholder={String(DEFAULT_SYNC_INTERVAL)}
                  value={syncInterval}
                  onChange={(event) => {
                    setSyncInterval(event.target.value)
                    setError('')
                  }}
                  min="5"
                  max="3600"
                  step="1"
                />
              </Field>
            </div>
          )}
          {type === 'Hstong' && autoSync && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">华盛 OpenAPI Gateway 配置</p>
                <OfficialIntegrationDocsLink provider="Hstong" />
              </div>
              <FieldGroup className="gap-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="account-hstong-host">地址</FieldLabel>
                    <Input
                      id="account-hstong-host"
                      value={hstongGatewayHost}
                      onChange={(event) => {
                        setHstongGatewayHost(event.target.value)
                        setError('')
                      }}
                      placeholder={DEFAULT_HSTONG_GATEWAY_HOST}
                      maxLength={64}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="account-hstong-port">端口</FieldLabel>
                    <Input
                      id="account-hstong-port"
                      type="number"
                      placeholder={String(DEFAULT_HSTONG_GATEWAY_PORT)}
                      value={hstongGatewayPort}
                      onChange={(event) => {
                        setHstongGatewayPort(event.target.value)
                        setError('')
                      }}
                      min="1"
                      max="65535"
                      step="1"
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="account-hstong-password">
                      交易密码（可选）
                    </FieldLabel>
                    <Input
                      id="account-hstong-password"
                      type="password"
                      value={hstongTradingPassword}
                      onChange={(event) => {
                        setHstongTradingPassword(event.target.value)
                        setError('')
                      }}
                      placeholder={
                        canKeepHstongCredential
                          ? '已保存，留空保持不变'
                          : '请输入交易密码'
                      }
                      autoComplete="new-password"
                      maxLength={256}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="account-hstong-sync-interval">
                      间隔（秒）
                    </FieldLabel>
                    <Input
                      id="account-hstong-sync-interval"
                      type="number"
                      placeholder={String(DEFAULT_SYNC_INTERVAL)}
                      value={syncInterval}
                      onChange={(event) => {
                        setSyncInterval(event.target.value)
                        setError('')
                      }}
                      min="5"
                      max="3600"
                      step="1"
                    />
                  </Field>
                </div>
              </FieldGroup>
            </div>
          )}
          {type === 'Binance' && autoSync && (
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">币安 API 配置</p>
                <OfficialIntegrationDocsLink provider="Binance" />
              </div>
              <Field>
                <FieldLabel htmlFor="account-binance-api-key">API Key</FieldLabel>
                <Input
                  id="account-binance-api-key"
                  value={binanceApiKey}
                  onChange={(event) => {
                    setBinanceApiKey(event.target.value)
                    setError('')
                  }}
                  placeholder={
                    account?.type === 'Binance' && integration?.provider === 'Binance'
                      ? '已保存，留空保持不变'
                      : '请输入 API Key'
                  }
                  autoComplete="off"
                  maxLength={256}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="account-binance-secret-key">Secret Key</FieldLabel>
                <Input
                  id="account-binance-secret-key"
                  type="password"
                  value={binanceSecretKey}
                  onChange={(event) => {
                    setBinanceSecretKey(event.target.value)
                    setError('')
                  }}
                  placeholder={
                    account?.type === 'Binance' && integration?.provider === 'Binance'
                      ? '已保存，留空保持不变'
                      : '请输入 Secret Key'
                  }
                  autoComplete="new-password"
                  maxLength={512}
                />
              </Field>
              <Field className="max-w-72">
                <FieldLabel htmlFor="account-binance-sync-interval">间隔（秒）</FieldLabel>
                <Input
                  id="account-binance-sync-interval"
                  type="number"
                  placeholder={String(DEFAULT_SYNC_INTERVAL)}
                  value={syncInterval}
                  onChange={(event) => {
                    setSyncInterval(event.target.value)
                    setError('')
                  }}
                  min="5"
                  max="3600"
                  step="1"
                />
              </Field>
            </div>
          )}
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

type PositionField = 'symbol' | 'name' | 'currency' | 'quantity' | 'price'
type AssetQuoteLookupStatus =
  | 'idle'
  | 'loading'
  | 'not-found'

const ASSET_QUOTE_LOOKUP_DELAY_MS = 600

export function PositionDialog({
  open,
  onOpenChange,
  position,
  tags,
  stockQuoteProvider,
  cryptoQuoteProvider,
  onCreateTag,
  onSubmit
}: BaseDialogProps & {
  position?: Position
  tags: Tag[]
  stockQuoteProvider: StockQuoteProvider
  cryptoQuoteProvider: CryptoQuoteProvider
  onCreateTag: (input: TagInput) => Promise<string>
  onSubmit: (input: PositionInput) => Promise<string | null>
}) {
  const [market, setMarket] = useState<Market>('US')
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [errors, setErrors] = useState<Partial<Record<PositionField, string>>>({})
  const [quoteLookupEnabled, setQuoteLookupEnabled] = useState(false)
  const [quoteLookupStatus, setQuoteLookupStatus] =
    useState<AssetQuoteLookupStatus>('idle')
  const quoteLookupRequestRef = useRef(0)
  const quoteFieldEditedRef = useRef({
    name: false,
    currency: false,
    price: false
  })
  const { submitting, submissionInFlight, beginSubmission, endSubmission } =
    useSubmissionGuard()
  const quoteLookupLoading = quoteLookupStatus === 'loading'

  useEffect(() => {
    if (!open) return
    setMarket(position?.market ?? 'US')
    setSymbol(position?.symbol ?? '')
    setName(position?.name ?? '')
    setCurrency(position?.currency ?? 'USD')
    setQuantity(position ? String(position.quantity) : '')
    setPrice(position?.price === undefined ? '' : String(position.price))
    setTagIds(position?.tagIds ?? [])
    setErrors({})
    setQuoteLookupEnabled(false)
    setQuoteLookupStatus('idle')
    quoteLookupRequestRef.current += 1
    quoteFieldEditedRef.current = { name: false, currency: false, price: false }
    // Preserve edits across background sync refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, position?.id])

  useEffect(() => {
    const requestId = ++quoteLookupRequestRef.current
    const normalizedSymbol = symbol.trim()
    if (!open || !quoteLookupEnabled || !normalizedSymbol) {
      setQuoteLookupStatus('idle')
      return
    }

    const timer = window.setTimeout(() => {
      setQuoteLookupStatus('loading')
      const lookup = window.desktop.assetQuotes?.lookup
      if (!lookup) {
        setQuoteLookupStatus('idle')
        return
      }

      const provider = market === 'CC'
        ? cryptoQuoteProvider
        : stockQuoteProvider
      void lookup({ market, symbol: normalizedSymbol, provider })
        .then((result) => {
          if (requestId !== quoteLookupRequestRef.current) return
          if (result.status !== 'found') {
            setQuoteLookupStatus(
              result.status === 'not-found' ? 'not-found' : 'idle'
            )
            return
          }

          const filledFields: PositionField[] = []
          if (result.quote.name && !quoteFieldEditedRef.current.name) {
            setName(result.quote.name.slice(0, 60))
            filledFields.push('name')
          }
          if (result.quote.currency && !quoteFieldEditedRef.current.currency) {
            setCurrency(result.quote.currency)
            filledFields.push('currency')
          }
          if (result.quote.price !== undefined && !quoteFieldEditedRef.current.price) {
            setPrice(String(result.quote.price))
            filledFields.push('price')
          }
          if (filledFields.length > 0) {
            setErrors((current) => {
              const next = { ...current }
              filledFields.forEach((field) => delete next[field])
              return next
            })
            toast.success('行情数据获取成功', {
              id: 'position-quote-autofill'
            })
          }
          setQuoteLookupStatus('idle')
        })
        .catch(() => {
          if (requestId === quoteLookupRequestRef.current) {
            setQuoteLookupStatus('idle')
          }
        })
    }, ASSET_QUOTE_LOOKUP_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [cryptoQuoteProvider, market, open, quoteLookupEnabled, stockQuoteProvider, symbol])

  function clearError(field: PositionField): void {
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  function failValidation(field: PositionField, message: string): void {
    setErrors({ [field]: message })
    reportValidationError(message)
  }

  function handleMarketChange(value: string): void {
    const nextMarket = value as Market
    const previousDefault = defaultCurrencyByMarket[market]
    quoteLookupRequestRef.current += 1
    quoteFieldEditedRef.current = { name: false, currency: false, price: false }
    setQuoteLookupEnabled(true)
    setQuoteLookupStatus('idle')
    setMarket(nextMarket)
    if (!currency || currency === previousDefault) {
      setCurrency(defaultCurrencyByMarket[nextMarket])
      clearError('currency')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (submissionInFlight.current || quoteLookupLoading) return
    const parsedQuantity = Number(quantity)
    const parsedPrice = Number(price)
    if (!symbol.trim()) {
      failValidation('symbol', '请填写资产代码')
      return
    }
    if (!name.trim()) {
      failValidation('name', '请填写资产名称')
      return
    }
    if (!currency.trim()) {
      failValidation('currency', '请选择币种')
      return
    }
    if (!quantity.trim()) {
      failValidation('quantity', '请填写资产数量')
      return
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      failValidation('quantity', '资产数量必须大于 0')
      return
    }
    if (!price.trim()) {
      failValidation('price', '请填写当前价格')
      return
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      failValidation('price', '当前价格必须是大于或等于 0 的数字')
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
        price: parsedPrice,
        tagIds
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
            设置持仓市场、代码、币种、数量、当前价格和标签
          </DialogDescription>
        </DialogHeader>
        <form className="contents" noValidate onSubmit={handleSubmit}>
          <DialogBody>
          <FieldGroup>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field data-disabled={quoteLookupLoading}>
              <FieldLabel>市场</FieldLabel>
              <Select
                value={market}
                disabled={quoteLookupLoading}
                onValueChange={handleMarketChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择市场" />
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
            <Field
              data-invalid={Boolean(errors.symbol)}
              data-disabled={quoteLookupLoading}
            >
              <FieldLabel htmlFor="position-symbol">资产代码</FieldLabel>
              <InputGroup data-disabled={quoteLookupLoading}>
                <InputGroupInput
                  id="position-symbol"
                  aria-invalid={Boolean(errors.symbol)}
                  aria-describedby={
                    quoteLookupStatus === 'not-found'
                      ? 'position-quote-status'
                      : undefined
                  }
                  aria-busy={quoteLookupLoading}
                  disabled={quoteLookupLoading}
                  value={symbol}
                  onChange={(event) => {
                    quoteLookupRequestRef.current += 1
                    quoteFieldEditedRef.current = {
                      name: false,
                      currency: false,
                      price: false
                    }
                    setQuoteLookupEnabled(true)
                    setQuoteLookupStatus('idle')
                    setSymbol(event.target.value.toUpperCase())
                    clearError('symbol')
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
                {quoteLookupStatus === 'loading' && (
                  <InputGroupAddon align="inline-end">
                    <Spinner aria-label="正在获取行情" />
                  </InputGroupAddon>
                )}
              </InputGroup>
              {quoteLookupStatus === 'not-found' && (
                <FieldDescription
                  id="position-quote-status"
                  aria-live="polite"
                >
                  未找到该资产，可手动填写
                </FieldDescription>
              )}
            </Field>
          </div>
          <Field
            data-invalid={Boolean(errors.name)}
            data-disabled={quoteLookupLoading}
          >
            <FieldLabel htmlFor="position-name">资产名称</FieldLabel>
            <Input
              id="position-name"
              aria-invalid={Boolean(errors.name)}
              disabled={quoteLookupLoading}
              value={name}
              onChange={(event) => {
                quoteFieldEditedRef.current.name = true
                setName(event.target.value)
                clearError('name')
              }}
              placeholder="Apple"
              maxLength={60}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field
              data-invalid={Boolean(errors.currency)}
              data-disabled={quoteLookupLoading}
            >
              <FieldLabel htmlFor="position-currency">币种</FieldLabel>
              <Select
                value={currency}
                disabled={quoteLookupLoading}
                onValueChange={(value) => {
                  quoteFieldEditedRef.current.currency = true
                  setCurrency(value)
                  clearError('currency')
                }}
              >
                <SelectTrigger
                  id="position-currency"
                  aria-invalid={Boolean(errors.currency)}
                >
                  <SelectValue placeholder="选择币种" />
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
            <Field
              data-invalid={Boolean(errors.quantity)}
              data-disabled={quoteLookupLoading}
            >
              <FieldLabel htmlFor="position-quantity">资产数量</FieldLabel>
              <Input
                id="position-quantity"
                type="number"
                value={quantity}
                aria-invalid={Boolean(errors.quantity)}
                disabled={quoteLookupLoading}
                onChange={(event) => {
                  setQuantity(event.target.value)
                  clearError('quantity')
                }}
                placeholder="0"
                min="0"
                step="any"
              />
            </Field>
            <Field
              data-invalid={Boolean(errors.price)}
              data-disabled={quoteLookupLoading}
            >
              <FieldLabel htmlFor="position-price">当前价格</FieldLabel>
              <Input
                id="position-price"
                type="number"
                value={price}
                aria-invalid={Boolean(errors.price)}
                disabled={quoteLookupLoading}
                onChange={(event) => {
                  quoteFieldEditedRef.current.price = true
                  setPrice(event.target.value)
                  clearError('price')
                }}
                placeholder="0.00"
                min="0"
                step="any"
                required
              />
            </Field>
          </div>
          <TagSelector
            tags={tags}
            selectedIds={tagIds}
            onSelectedIdsChange={setTagIds}
            onCreateTag={onCreateTag}
            disabled={quoteLookupLoading}
          />
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
            <Button
              type="submit"
              disabled={submitting || quoteLookupLoading}
              aria-busy={submitting}
            >
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
