import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import {
  DEFAULT_MCP_ACCESS_SETTINGS,
  type McpAccessSettings,
  type McpConnectionSettings
} from '@/lib/mcp'
import {
  CRYPTO_QUOTE_PROVIDERS,
  DEFAULT_BASE_CURRENCY,
  DEFAULT_CRYPTO_QUOTE_PROVIDER,
  DEFAULT_EXCHANGE_RATE_PROVIDER,
  DEFAULT_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  DEFAULT_STOCK_QUOTE_PROVIDER,
  EXCHANGE_RATE_PROVIDERS,
  MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  STOCK_QUOTE_PROVIDERS,
  type BaseCurrency,
  type CryptoQuoteProvider,
  type ExchangeRateProvider,
  type StockQuoteProvider,
  type Workspace,
  type WorkspaceSettingsInput
} from '@/lib/portfolio'
import {
  operationErrorMessage,
  reportOperationError,
  reportValidationError,
  useSubmissionGuard
} from './dialog-utils'
import type { BaseDialogProps, StorageLocationStatus } from './dialog-shared'

export type WorkspaceSettingsSection = 'basic' | 'currency' | 'quotes' | 'proxy' | 'mcp'

export function useWorkspaceSettingsForm({
  open,
  onOpenChange,
  workspace,
  initialSection,
  onSubmit
}: BaseDialogProps & {
  workspace: Workspace
  initialSection: WorkspaceSettingsSection
  onSubmit: (input: WorkspaceSettingsInput) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [baseCurrency, setBaseCurrency] = useState<BaseCurrency>(DEFAULT_BASE_CURRENCY)
  const [exchangeRateProvider, setExchangeRateProvider] = useState<ExchangeRateProvider>(
    DEFAULT_EXCHANGE_RATE_PROVIDER
  )
  const [exchangeRateRefreshInterval, setExchangeRateRefreshInterval] = useState(
    String(DEFAULT_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES)
  )
  const [stockQuoteProvider, setStockQuoteProvider] = useState<StockQuoteProvider>(
    DEFAULT_STOCK_QUOTE_PROVIDER
  )
  const [cryptoQuoteProvider, setCryptoQuoteProvider] = useState<CryptoQuoteProvider>(
    DEFAULT_CRYPTO_QUOTE_PROVIDER
  )
  const [section, setSection] = useState<WorkspaceSettingsSection>('basic')
  const [mcpConnection, setMcpConnection] = useState<McpConnectionSettings | null>(null)
  const [mcpAccess, setMcpAccess] = useState<McpAccessSettings>({
    ...DEFAULT_MCP_ACCESS_SETTINGS
  })
  const [mcpLoading, setMcpLoading] = useState(false)
  const [storagePath, setStoragePath] = useState('')
  const [storageLocationStatus, setStorageLocationStatus] =
    useState<StorageLocationStatus>('loading')
  const { submitting, submissionInFlight, beginSubmission, endSubmission } = useSubmissionGuard()
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
          workspace.exchangeRateRefreshIntervalMinutes <= MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES
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
      reportOperationError('读取数据存储位置失败', '请完全退出并重新打开 Chromie 后重试')
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
      const message = `更新间隔请输入 ${MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES} 至 ${MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES} 分钟之间的整数`
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

  return {
    name,
    setName,
    baseCurrency,
    setBaseCurrency,
    exchangeRateProvider,
    setExchangeRateProvider,
    exchangeRateRefreshInterval,
    setExchangeRateRefreshInterval,
    stockQuoteProvider,
    setStockQuoteProvider,
    cryptoQuoteProvider,
    setCryptoQuoteProvider,
    section,
    setSection,
    mcpConnection,
    mcpAccess,
    setMcpAccess,
    mcpLoading,
    storagePath,
    setStoragePath,
    storageLocationStatus,
    setStorageLocationStatus,
    submitting,
    mcpError,
    error,
    setError,
    storageLocationPlaceholder,
    handleSubmit
  }
}
