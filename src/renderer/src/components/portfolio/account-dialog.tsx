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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
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
  accountTypeLabels,
  DEFAULT_FUTU_OPEND_HOST,
  DEFAULT_FUTU_OPEND_PORT,
  DEFAULT_HSTONG_GATEWAY_HOST,
  DEFAULT_HSTONG_GATEWAY_PORT,
  DEFAULT_IBKR_GATEWAY_HOST,
  DEFAULT_IBKR_GATEWAY_PORT,
  DEFAULT_SYNC_INTERVAL,
  type Account,
  type AccountInput,
  type AccountIntegrationView,
  type AccountType,
  type ProxyProfileView,
  type Tag,
  type TagInput
} from '@/lib/portfolio'
import { TagSelector } from './tag-selector'
import { SavedCredentialInput } from './saved-credential-input'
import { AccountTypeIcon } from './view-helpers'
import { useAccountDialogForm } from './use-account-dialog-form'

import { ACCOUNT_TYPES, OfficialIntegrationDocsLink, type BaseDialogProps } from './dialog-shared'
export function AccountDialog({
  open,
  onOpenChange,
  account,
  integration,
  proxyProfiles,
  tags,
  onCreateTag,
  onSubmit
}: BaseDialogProps & {
  account?: Account
  integration?: AccountIntegrationView
  proxyProfiles: ProxyProfileView[]
  tags: Tag[]
  onCreateTag: (input: TagInput) => Promise<string>
  onSubmit: (input: AccountInput) => Promise<void>
}) {
  const {
    name,
    setName,
    tagIds,
    setTagIds,
    type,
    autoSync,
    setAutoSync,
    syncHost,
    setSyncHost,
    syncPort,
    setSyncPort,
    syncInterval,
    setSyncInterval,
    syncKey,
    setSyncKey,
    okxApiKey,
    setOkxApiKey,
    okxSecretKey,
    setOkxSecretKey,
    okxPassphrase,
    setOkxPassphrase,
    ibkrGatewayHost,
    setIbkrGatewayHost,
    ibkrGatewayPort,
    setIbkrGatewayPort,
    hstongGatewayHost,
    setHstongGatewayHost,
    hstongGatewayPort,
    setHstongGatewayPort,
    hstongTradingPassword,
    setHstongTradingPassword,
    binanceApiKey,
    setBinanceApiKey,
    binanceSecretKey,
    setBinanceSecretKey,
    networkRoute,
    setNetworkRoute,
    error,
    setError,
    submitting,
    supportsAutoSync,
    canKeepHstongCredential,
    handleAccountTypeChange,
    handleSubmit
  } = useAccountDialogForm({
    open,
    onOpenChange,
    account,
    integration,
    proxyProfiles,
    onSubmit
  })

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
        <form className="contents" aria-invalid={Boolean(error)} onSubmit={handleSubmit}>
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
                    <SelectTrigger id="account-auto-sync">
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
              {type === 'Futu' && (
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
                      <SavedCredentialInput
                        id="account-sync-key"
                        type="password"
                        value={syncKey}
                        onChange={(event) => {
                          setSyncKey(event.target.value)
                          setError('')
                        }}
                        credentialConfigured={Boolean(
                          account?.type === 'Futu' &&
                            integration?.provider === 'Futu' &&
                            integration.websocket.credentialConfigured
                        )}
                        placeholder="WebSocket Authentication Key"
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
              {type === 'Okx' && (
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">OKX API 配置</p>
                    <OfficialIntegrationDocsLink provider="Okx" />
                  </div>
                  <Field>
                    <FieldLabel htmlFor="account-okx-api-key">API Key</FieldLabel>
                    <SavedCredentialInput
                      id="account-okx-api-key"
                      value={okxApiKey}
                      onChange={(event) => {
                        setOkxApiKey(event.target.value)
                        setError('')
                      }}
                      credentialConfigured={Boolean(
                        account?.type === 'Okx' && integration?.provider === 'Okx'
                      )}
                      placeholder="请输入 API Key"
                      autoComplete="off"
                      maxLength={256}
                    />
                  </Field>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="account-okx-secret-key">Secret Key</FieldLabel>
                      <SavedCredentialInput
                        id="account-okx-secret-key"
                        type="password"
                        value={okxSecretKey}
                        onChange={(event) => {
                          setOkxSecretKey(event.target.value)
                          setError('')
                        }}
                        credentialConfigured={Boolean(
                          account?.type === 'Okx' && integration?.provider === 'Okx'
                        )}
                        placeholder="请输入 Secret Key"
                        autoComplete="new-password"
                        maxLength={512}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="account-okx-passphrase">Passphrase</FieldLabel>
                      <SavedCredentialInput
                        id="account-okx-passphrase"
                        type="password"
                        value={okxPassphrase}
                        onChange={(event) => {
                          setOkxPassphrase(event.target.value)
                          setError('')
                        }}
                        credentialConfigured={Boolean(
                          account?.type === 'Okx' && integration?.provider === 'Okx'
                        )}
                        placeholder="请输入 Passphrase"
                        autoComplete="new-password"
                        maxLength={256}
                      />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="account-okx-network">网络连接</FieldLabel>
                    <Select
                      value={networkRoute}
                      onValueChange={(value) => {
                        setNetworkRoute(value)
                        setError('')
                      }}
                    >
                      <SelectTrigger id="account-okx-network">
                        <SelectValue placeholder="选择网络连接" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="system">跟随系统</SelectItem>
                          <SelectItem value="direct">强制直连</SelectItem>
                          {proxyProfiles.map((profile) => (
                            <SelectItem key={profile.id} value={`proxy:${profile.id}`}>
                              {profile.name}（{profile.host}:{profile.port}）
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
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
              {type === 'Ibkr' && (
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">IB Gateway 配置</p>
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
              {type === 'Hstong' && (
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
                        <FieldLabel htmlFor="account-hstong-password">交易密码（可选）</FieldLabel>
                        <SavedCredentialInput
                          id="account-hstong-password"
                          type="password"
                          value={hstongTradingPassword}
                          onChange={(event) => {
                            setHstongTradingPassword(event.target.value)
                            setError('')
                          }}
                          credentialConfigured={canKeepHstongCredential}
                          placeholder="请输入交易密码"
                          autoComplete="new-password"
                          maxLength={256}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="account-hstong-sync-interval">间隔（秒）</FieldLabel>
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
              {type === 'Binance' && (
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">币安 API 配置</p>
                    <OfficialIntegrationDocsLink provider="Binance" />
                  </div>
                  <Field>
                    <FieldLabel htmlFor="account-binance-api-key">API Key</FieldLabel>
                    <SavedCredentialInput
                      id="account-binance-api-key"
                      value={binanceApiKey}
                      onChange={(event) => {
                        setBinanceApiKey(event.target.value)
                        setError('')
                      }}
                      credentialConfigured={Boolean(
                        account?.type === 'Binance' && integration?.provider === 'Binance'
                      )}
                      placeholder="请输入 API Key"
                      autoComplete="off"
                      maxLength={256}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="account-binance-secret-key">Secret Key</FieldLabel>
                    <SavedCredentialInput
                      id="account-binance-secret-key"
                      type="password"
                      value={binanceSecretKey}
                      onChange={(event) => {
                        setBinanceSecretKey(event.target.value)
                        setError('')
                      }}
                      credentialConfigured={Boolean(
                        account?.type === 'Binance' && integration?.provider === 'Binance'
                      )}
                      placeholder="请输入 Secret Key"
                      autoComplete="new-password"
                      maxLength={512}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="account-binance-network">网络连接</FieldLabel>
                    <Select
                      value={networkRoute}
                      onValueChange={(value) => {
                        setNetworkRoute(value)
                        setError('')
                      }}
                    >
                      <SelectTrigger id="account-binance-network">
                        <SelectValue placeholder="选择网络连接" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="system">跟随系统</SelectItem>
                          <SelectItem value="direct">强制直连</SelectItem>
                          {proxyProfiles.map((profile) => (
                            <SelectItem key={profile.id} value={`proxy:${profile.id}`}>
                              {profile.name}（{profile.host}:{profile.port}）
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
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
              {submitting ? (account ? '保存中…' : '添加中…') : account ? '保存' : '添加'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
