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
  ExternalLink,
  Plus,
  SlidersHorizontal,
  Trash2,
  Upload,
  Wrench
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor
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
import type { McpAccessSettings, McpConnectionSettings } from '@/lib/mcp'
import { TagColorDot } from './tag-badge'
import { AccountTypeIcon } from './view-helpers'
import {
  BASE_CURRENCIES,
  accountTypeLabels,
  defaultCurrencyByMarket,
  DEFAULT_BASE_CURRENCY,
  DEFAULT_EXCHANGE_RATE_PROVIDER,
  DEFAULT_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  DEFAULT_FUTU_OPEND_HOST,
  DEFAULT_FUTU_OPEND_PORT,
  DEFAULT_HSTONG_GATEWAY_HOST,
  DEFAULT_HSTONG_GATEWAY_PORT,
  DEFAULT_IBKR_GATEWAY_HOST,
  DEFAULT_IBKR_GATEWAY_PORT,
  DEFAULT_SYNC_INTERVAL,
  DEFAULT_TAG_COLOR,
  exchangeRateProviderLabels,
  EXCHANGE_RATE_PROVIDERS,
  MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  marketMeta,
  marketOrder,
  MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  TAG_COLORS,
  tagColorLabels,
  type Account,
  type AccountIntegrationView,
  type AccountInput,
  type AccountType,
  type BaseCurrency,
  type ExchangeRateProvider,
  type Market,
  type Position,
  type PositionInput,
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
    <Button asChild variant="link" size="sm" className="mt-2 h-auto justify-start p-0 text-xs">
      <a href={OFFICIAL_INTEGRATION_DOCS[provider]} target="_blank" rel="noopener noreferrer">
        官方接入文档
        <ExternalLink data-icon="inline-end" />
      </a>
    </Button>
  )
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

function randomTagColor(): TagColor {
  const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]
  return color ?? DEFAULT_TAG_COLOR
}

function TagSelector({
  tags,
  selectedIds,
  onSelectedIdsChange,
  onCreateTag
}: {
  tags: Tag[]
  selectedIds: string[]
  onSelectedIdsChange: (tagIds: string[]) => void
  onCreateTag: (input: TagInput) => Promise<string>
}) {
  const fieldId = useId()
  const anchor = useComboboxAnchor()
  const [open, setOpen] = useState(false)
  const [tagDialogOpen, setTagDialogOpen] = useState(false)
  const tagIds = tags.map((tag) => tag.id)

  function findTag(tagId: string): Tag | undefined {
    return tags.find((tag) => tag.id === tagId)
  }

  return (
    <Field>
      <FieldLabel htmlFor={fieldId}>标签</FieldLabel>
      <Combobox
        multiple
        autoHighlight
        items={tagIds}
        value={selectedIds}
        open={open}
        onOpenChange={setOpen}
        onValueChange={onSelectedIdsChange}
        itemToStringLabel={(tagId) => findTag(tagId)?.name ?? ''}
        itemToStringValue={(tagId) => tagId}
        filter={(tagId, query) =>
          (findTag(tagId)?.name ?? '')
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase())
        }
      >
        <ComboboxChips ref={anchor}>
          <ComboboxValue>
            {(values: string[]) => (
              <>
                {values.map((tagId) => {
                  const tag = findTag(tagId)
                  return tag ? (
                    <ComboboxChip key={tagId}>
                      <TagColorDot color={tag.color} />
                      {tag.name}
                    </ComboboxChip>
                  ) : null
                })}
                <ComboboxChipsInput
                  id={fieldId}
                  placeholder={selectedIds.length ? undefined : '选择标签…'}
                />
              </>
            )}
          </ComboboxValue>
          <ComboboxTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="选择标签"
              />
            }
          />
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          {tags.length > 0 && (
            <>
              <ComboboxEmpty>未找到标签</ComboboxEmpty>
              <ComboboxList>
                {(tagId: string) => {
                  const tag = findTag(tagId)
                  return tag ? (
                    <ComboboxItem key={tagId} value={tagId}>
                      <TagColorDot color={tag.color} />
                      {tag.name}
                    </ComboboxItem>
                  ) : null
                }}
              </ComboboxList>
              <Separator />
            </>
          )}
          <div className="p-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                setOpen(false)
                setTagDialogOpen(true)
              }}
            >
              <Plus data-icon="inline-start" />
              添加标签
            </Button>
          </div>
        </ComboboxContent>
      </Combobox>
      <TagDialog
        open={tagDialogOpen}
        onOpenChange={setTagDialogOpen}
        onSubmit={async (input) => {
          const tagId = await onCreateTag(input)
          if (!selectedIds.includes(tagId)) {
            onSelectedIdsChange([...selectedIds, tagId])
          }
        }}
      />
    </Field>
  )
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
    if (submissionInFlight.current) return
    const normalizedName = name.trim()
    if (!normalizedName) {
      setError('请输入名称')
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
            {tag ? '修改标签名称和颜色' : '添加可用于资产账户和持仓的标签'}
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
                  aria-describedby={error ? 'tag-name-error' : undefined}
                  onChange={(event) => {
                    setName(event.target.value)
                    setError('')
                  }}
                  placeholder="输入名称"
                  maxLength={40}
                  autoFocus
                />
                {error && <FieldMessage id="tag-name-error">{error}</FieldMessage>}
              </Field>
              <Field>
                <FieldLabel id="tag-color-label">颜色</FieldLabel>
                <ToggleGroup
                  type="single"
                  value={color}
                  aria-labelledby="tag-color-label"
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
                      className="group size-10 min-w-10 rounded-full bg-transparent p-0 data-[state=on]:bg-transparent"
                    >
                      <TagColorDot
                        color={tagColor}
                        className="size-4 transition-shadow group-data-[state=on]:ring-2 group-data-[state=on]:ring-ring group-data-[state=on]:ring-offset-2 group-data-[state=on]:ring-offset-background"
                      />
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
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
      toast.error('复制 MCP 协议配置失败', {
        description: operationErrorMessage(error)
      })
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
              默认只读；关闭后本机 MCP 协议连接立即停止
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
                <FieldLabel htmlFor="workspace-name" className="sr-only">
                  工作区名称
                </FieldLabel>
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
            管理工作区基础信息、币种与汇率、MCP 协议和工作区状态
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

export function ImportBackupDialog({
  open,
  onOpenChange,
  workspaceName,
  accountCount,
  tagCount,
  positionCount,
  snapshotCount,
  onConfirm
}: BaseDialogProps & {
  workspaceName: string
  accountCount: number
  tagCount: number
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
            包含 {accountCount} 个资产账户、{tagCount} 个标签、{positionCount}{' '}
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
    const hasHstongTradingPassword = hstongTradingPassword.length > 0
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
      setError('华盛 OpenAPI Gateway 地址必须是本机回环地址')
      return
    }
    if (
      type === 'Hstong' &&
      syncEnabled &&
      (!Number.isInteger(parsedHstongGatewayPort) ||
        parsedHstongGatewayPort < 1 ||
        parsedHstongGatewayPort > 65535)
    ) {
      setError('华盛 OpenAPI Gateway 端口需为 1–65535')
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
      <DialogContent className="max-h-[92vh] max-w-2xl">
        <DialogHeader>
          <DialogTitle>{account ? '编辑资产账户' : '添加资产账户'}</DialogTitle>
          <DialogDescription className="sr-only">
            设置资产账户名称、类型、标签和同步来源
          </DialogDescription>
        </DialogHeader>
        <form
          className="contents"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'account-error' : undefined}
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
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setError('')
              }}
              placeholder="例如：我的美股账户"
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
            <Field className="flex-row items-center justify-between gap-4 rounded-sm border bg-muted/20 px-4 py-3.5">
              <FieldLabel htmlFor="account-auto-sync">自动同步</FieldLabel>
              <Switch
                id="account-auto-sync"
                checked={autoSync}
                onCheckedChange={(checked) => {
                  setAutoSync(checked)
                  setError('')
                }}
              />
            </Field>
          )}
          {type === 'Futu' && autoSync && (
            <div className="grid gap-3 rounded-sm border bg-muted/20 p-4">
              <div>
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
                        ? '已安全保存；留空保持不变'
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
            <div className="grid gap-3 rounded-sm border bg-muted/20 p-4">
              <div>
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
                      ? '已安全保存；留空保持不变'
                      : undefined
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
                        ? '已安全保存；留空保持不变'
                        : undefined
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
                        ? '已安全保存；留空保持不变'
                        : undefined
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
            <div className="grid gap-3 rounded-sm border bg-muted/20 p-4">
              <div>
                <p className="text-sm font-medium">IBKR Client Portal Gateway</p>
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
            <div className="flex flex-col gap-3 rounded-sm border bg-muted/20 p-4">
              <div>
                <p className="text-sm font-medium">华盛 OpenAPI Gateway</p>
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
                          ? '已安全保存；留空保持不变'
                          : undefined
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
            <div className="grid gap-3 rounded-sm border bg-muted/20 p-4">
              <div>
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
                      ? '已安全保存；留空保持不变'
                      : undefined
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
                      ? '已安全保存；留空保持不变'
                      : undefined
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
          {error && <FieldMessage id="account-error">{error}</FieldMessage>}
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

export function PositionDialog({
  open,
  onOpenChange,
  position,
  tags,
  onCreateTag,
  onSubmit
}: BaseDialogProps & {
  position?: Position
  tags: Tag[]
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
    setTagIds(position?.tagIds ?? [])
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
        <form className="contents" onSubmit={handleSubmit}>
          <DialogBody>
          <FieldGroup>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          <TagSelector
            tags={tags}
            selectedIds={tagIds}
            onSelectedIdsChange={setTagIds}
            onCreateTag={onCreateTag}
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
