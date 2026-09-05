import { useEffect, useState, type FormEvent } from 'react'

import {
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
  type AccountNetworkRoute,
  type AccountType,
  type ProxyProfileView
} from '@/lib/portfolio'
import { reportOperationError, reportValidationError, useSubmissionGuard } from './dialog-utils'
import { defaultAccountName, type BaseDialogProps } from './dialog-shared'

export function useAccountDialogForm({
  open,
  onOpenChange,
  account,
  integration,
  proxyProfiles,
  onSubmit
}: BaseDialogProps & {
  account?: Account
  integration?: AccountIntegrationView
  proxyProfiles: ProxyProfileView[]
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
  const [ibkrGatewayPort, setIbkrGatewayPort] = useState(String(DEFAULT_IBKR_GATEWAY_PORT))
  const [hstongGatewayHost, setHstongGatewayHost] = useState(DEFAULT_HSTONG_GATEWAY_HOST)
  const [hstongGatewayPort, setHstongGatewayPort] = useState(String(DEFAULT_HSTONG_GATEWAY_PORT))
  const [hstongTradingPassword, setHstongTradingPassword] = useState('')
  const [binanceApiKey, setBinanceApiKey] = useState('')
  const [binanceSecretKey, setBinanceSecretKey] = useState('')
  const [networkRoute, setNetworkRoute] = useState('system')
  const [error, setError] = useState('')
  const { submitting, submissionInFlight, beginSubmission, endSubmission } = useSubmissionGuard()
  const supportsAutoSync =
    type === 'Futu' || type === 'Hstong' || type === 'Okx' || type === 'Ibkr' || type === 'Binance'
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
      integration?.provider === 'Futu' ? integration.websocket.host : DEFAULT_FUTU_OPEND_HOST
    )
    setSyncPort(
      String(
        integration?.provider === 'Futu' ? integration.websocket.port : DEFAULT_FUTU_OPEND_PORT
      )
    )
    setSyncInterval(String(account?.sync?.interval ?? DEFAULT_SYNC_INTERVAL))
    setSyncKey('')
    setOkxApiKey('')
    setOkxSecretKey('')
    setOkxPassphrase('')
    setIbkrGatewayHost(
      integration?.provider === 'Ibkr' ? integration.gateway.host : DEFAULT_IBKR_GATEWAY_HOST
    )
    setIbkrGatewayPort(
      String(
        integration?.provider === 'Ibkr' ? integration.gateway.port : DEFAULT_IBKR_GATEWAY_PORT
      )
    )
    setHstongGatewayHost(
      integration?.provider === 'Hstong' ? integration.gateway.host : DEFAULT_HSTONG_GATEWAY_HOST
    )
    setHstongGatewayPort(
      String(
        integration?.provider === 'Hstong' ? integration.gateway.port : DEFAULT_HSTONG_GATEWAY_PORT
      )
    )
    setHstongTradingPassword('')
    setBinanceApiKey('')
    setBinanceSecretKey('')
    const storedNetwork =
      integration?.provider === 'Okx' || integration?.provider === 'Binance'
        ? integration.network
        : undefined
    setNetworkRoute(
      storedNetwork?.mode === 'proxy'
        ? `proxy:${storedNetwork.proxyProfileId}`
        : (storedNetwork?.mode ?? 'system')
    )
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
    const canKeepOkxCredential = account?.type === 'Okx' && integration?.provider === 'Okx'
    const hasAnyOkxCredential = Boolean(okxApiKey.trim() || okxSecretKey || okxPassphrase)
    const canKeepBinanceCredential =
      account?.type === 'Binance' && integration?.provider === 'Binance'
    const hasAnyBinanceCredential = Boolean(binanceApiKey.trim() || binanceSecretKey)
    const hasHstongTradingPassword = hstongTradingPassword.length > 0
    const network: AccountNetworkRoute = networkRoute.startsWith('proxy:')
      ? { mode: 'proxy', proxyProfileId: networkRoute.slice('proxy:'.length) }
      : networkRoute === 'direct'
        ? { mode: 'direct' }
        : { mode: 'system' }
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
        (hasAnyOkxCredential && (!okxApiKey.trim() || !okxSecretKey || !okxPassphrase)))
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
      failValidation('IB Gateway 地址必须是本地回环地址')
      return
    }
    if (
      type === 'Ibkr' &&
      syncEnabled &&
      (!Number.isInteger(parsedIbkrGatewayPort) ||
        parsedIbkrGatewayPort < 1 ||
        parsedIbkrGatewayPort > 65535)
    ) {
      failValidation('IB Gateway 端口需为 1 至 65535')
      return
    }
    if (
      type === 'Binance' &&
      syncEnabled &&
      ((!canKeepBinanceCredential && !hasAnyBinanceCredential) ||
        (hasAnyBinanceCredential && (!binanceApiKey.trim() || !binanceSecretKey)))
    ) {
      failValidation('请填写完整的币安 API 配置')
      return
    }
    if (
      (type === 'Okx' || type === 'Binance') &&
      syncEnabled &&
      network.mode === 'proxy' &&
      !proxyProfiles.some((profile) => profile.id === network.proxyProfileId)
    ) {
      failValidation('请选择有效的代理配置')
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
    const lastSyncedAt = account?.type === type ? account.sync?.lastSyncedAt : undefined
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
                            },
                            network
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
                            },
                            network
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

  return {
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
  }
}
