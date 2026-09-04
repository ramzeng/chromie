import { useEffect, useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { TableEmptyState } from '@/components/portfolio/table-empty-state'
import { SavedCredentialInput } from '@/components/portfolio/saved-credential-input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import {
  PROXY_PROTOCOLS,
  proxyProtocolLabels,
  type ProxyProfileInput,
  type ProxyProfileView,
  type ProxyProtocol,
  type ProxyTestResult,
  type ProxyTestTarget
} from '@/lib/portfolio'

type ProxyProfileDialogState = { open: boolean; profile?: ProxyProfileView }

function cleanError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/^Error invoking remote method '[^']+': Error: /, '')
}

function ProxyProfileDialog({
  state,
  onOpenChange,
  onCreate,
  onUpdate
}: {
  state: ProxyProfileDialogState
  onOpenChange: (open: boolean) => void
  onCreate: (input: ProxyProfileInput) => Promise<string>
  onUpdate: (id: string, input: ProxyProfileInput) => Promise<void>
}) {
  const profile = state.profile
  const [name, setName] = useState('')
  const [protocol, setProtocol] = useState<ProxyProtocol>('socks5h')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('1080')
  const [authentication, setAuthentication] = useState<'none' | 'password'>('none')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!state.open) return
    setName(profile?.name ?? '')
    setProtocol(profile?.protocol ?? 'socks5h')
    setHost(profile?.host ?? '')
    setPort(String(profile?.port ?? 1080))
    setAuthentication(profile?.credentialConfigured ? 'password' : 'none')
    setUsername(profile?.username ?? '')
    setPassword('')
    setError('')
  }, [profile, state.open])

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (submitting) return
    const parsedPort = Number(port)
    if (!name.trim()) return setError('请输入代理名称')
    if (!host.trim()) return setError('请输入代理服务器地址')
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      return setError('端口需为 1 至 65535')
    }
    const hasNewCredential = Boolean(
      password || username.trim() !== (profile?.username ?? '')
    )
    if (authentication === 'password' && hasNewCredential && (!username.trim() || !password)) {
      return setError('请同时填写用户名和密码')
    }
    if (authentication === 'password' && !hasNewCredential && !profile?.credentialConfigured) {
      return setError('请填写用户名和密码')
    }

    const input: ProxyProfileInput = {
      name: name.trim(),
      protocol,
      host: host.trim(),
      port: parsedPort,
      credential:
        authentication === 'none'
          ? { mode: 'clear' }
          : hasNewCredential
            ? { mode: 'replace', value: { username: username.trim(), password } }
            : { mode: 'keep' }
    }
    setSubmitting(true)
    try {
      if (profile) {
        await onUpdate(profile.id, input)
        toast.success('代理配置已更新')
      } else {
        await onCreate(input)
        toast.success('代理配置已添加')
      }
      onOpenChange(false)
    } catch (submitError) {
      const message = cleanError(submitError)
      setError(message)
      toast.error(`保存代理配置失败：${message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={state.open} onOpenChange={(open) => !submitting && onOpenChange(open)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{profile ? '编辑代理' : '添加代理'}</DialogTitle>
          <DialogDescription>代理凭据将以明文保存在本地，并随引用它的工作区备份导出</DialogDescription>
        </DialogHeader>
        <form className="contents" onSubmit={handleSubmit}>
          <DialogBody>
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="proxy-profile-name">名称</FieldLabel>
                <Input
                  id="proxy-profile-name"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value)
                    setError('')
                  }}
                  placeholder="香港远端代理"
                  autoFocus
                  maxLength={50}
                />
              </Field>
              <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
                <Field>
                  <FieldLabel htmlFor="proxy-profile-protocol">协议</FieldLabel>
                  <Select
                    value={protocol}
                    onValueChange={(value) => setProtocol(value as ProxyProtocol)}
                  >
                    <SelectTrigger id="proxy-profile-protocol">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {PROXY_PROTOCOLS.map((value) => (
                          <SelectItem key={value} value={value}>
                            {proxyProtocolLabels[value]}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="proxy-profile-port">端口</FieldLabel>
                  <Input
                    id="proxy-profile-port"
                    type="number"
                    min="1"
                    max="65535"
                    value={port}
                    onChange={(event) => setPort(event.target.value)}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="proxy-profile-host">服务器地址</FieldLabel>
                <Input
                  id="proxy-profile-host"
                  value={host}
                  onChange={(event) => {
                    setHost(event.target.value)
                    setError('')
                  }}
                  placeholder="IP 或域名"
                  spellCheck={false}
                  maxLength={253}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="proxy-profile-authentication">身份认证</FieldLabel>
                <Select
                  value={authentication}
                  onValueChange={(value) => {
                    setAuthentication(value as 'none' | 'password')
                    setError('')
                  }}
                >
                  <SelectTrigger id="proxy-profile-authentication">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="none">无需认证</SelectItem>
                      <SelectItem value="password">用户名和密码</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              {authentication === 'password' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="proxy-profile-username">用户名</FieldLabel>
                    <Input
                      id="proxy-profile-username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="gentoo"
                      autoComplete="off"
                      maxLength={256}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="proxy-profile-password">密码</FieldLabel>
                    <SavedCredentialInput
                      id="proxy-profile-password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      credentialConfigured={Boolean(profile?.credentialConfigured)}
                      placeholder="请输入密码"
                      autoComplete="new-password"
                      maxLength={512}
                    />
                  </Field>
                </div>
              )}
              {error && <FieldError>{error}</FieldError>}
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
              {submitting ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ProxySettingsSection({
  profiles,
  onCreate,
  onUpdate,
  onDelete,
  onTest
}: {
  profiles: ProxyProfileView[]
  onCreate: (input: ProxyProfileInput) => Promise<string>
  onUpdate: (id: string, input: ProxyProfileInput) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onTest: (id: string, target: ProxyTestTarget) => Promise<ProxyTestResult>
}) {
  const [dialog, setDialog] = useState<ProxyProfileDialogState>({ open: false })
  const [deleteTarget, setDeleteTarget] = useState<ProxyProfileView>()
  const [testing, setTesting] = useState<string>()

  async function test(profile: ProxyProfileView, target: ProxyTestTarget): Promise<void> {
    const key = `${profile.id}:${target}`
    setTesting(key)
    try {
      const result = await onTest(profile.id, target)
      toast.success(`${target === 'okx' ? 'OKX' : '币安'} 连接成功，${result.latencyMs} ms`)
    } catch (error) {
      toast.error(cleanError(error))
    } finally {
      setTesting(undefined)
    }
  }

  return (
    <section className="grid gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <h3 className="text-base font-semibold">网络代理</h3>
          <p className="text-xs leading-5 text-muted-foreground">
            为欧易、币安等远端数据源创建可复用代理，再在账户中单独选择
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setDialog({ open: true })}>
          <Plus data-icon="inline-start" />
          添加代理
        </Button>
      </div>

      {profiles.length === 0 ? (
        <TableEmptyState>暂无代理配置</TableEmptyState>
      ) : (
        <div className="grid gap-3">
          {profiles.map((profile) => (
            <Card key={profile.id} size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  {profile.name}
                  <Badge variant="secondary">{proxyProtocolLabels[profile.protocol]}</Badge>
                </CardTitle>
                <CardDescription>
                  {profile.host}:{profile.port}
                  {profile.username ? ` · ${profile.username}` : ' · 无认证'}
                </CardDescription>
                <CardAction className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setDialog({ open: true, profile })}
                  >
                    <Pencil data-icon="inline-start" />编辑
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteTarget(profile)}
                  >
                    <Trash2 data-icon="inline-start" />删除
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="flex gap-2">
                {(['okx', 'binance'] as const).map((target) => {
                  const key = `${profile.id}:${target}`
                  return (
                    <Button
                      key={target}
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={Boolean(testing)}
                      onClick={() => void test(profile, target)}
                    >
                      {testing === key && <Spinner data-icon="inline-start" />}
                      测试 {target === 'okx' ? 'OKX' : '币安'}
                    </Button>
                  )
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ProxyProfileDialog
        state={dialog}
        onOpenChange={(open) => setDialog(open ? dialog : { open: false })}
        onCreate={onCreate}
        onUpdate={onUpdate}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除代理“{deleteTarget?.name}”？</AlertDialogTitle>
            <AlertDialogDescription>如果仍有账户使用该代理，删除操作会被拒绝。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteTarget) return
                void onDelete(deleteTarget.id)
                  .then(() => toast.success('代理配置已删除'))
                  .catch((error) => toast.error(cleanError(error)))
                  .finally(() => setDeleteTarget(undefined))
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
