import { contextBridge, ipcRenderer } from 'electron'

import type {
  BackupExportResult,
  BackupImportConfirmResult,
  BackupImportResult
} from '../shared/backup'
import type {
  ExchangeRateProvider,
  ExchangeRateSnapshot
} from '../shared/exchange-rates'
import type {
  McpAccessSettings,
  McpConnectionSettings
} from '../shared/mcp'
import type {
  StorageLocation,
  StorageLocationChangeResult
} from '../shared/storage'
import type {
  PortfolioCommand,
  PortfolioClientCommandResponse,
  PortfolioClientLoadResponse,
  PortfolioPriceRefreshResponse,
  PortfolioSyncResponse
} from '../shared/portfolio'
import type {
  AssetQuoteLookupInput,
  AssetQuoteLookupResult
} from '../shared/asset-quotes'
import type { ProxyTestResult, ProxyTestTarget } from '../shared/integrations'

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  exchangeRates: {
    load: (legacyContent?: string): Promise<ExchangeRateSnapshot | null> =>
      ipcRenderer.invoke('exchange-rates:load', legacyContent),
    fetch: (provider: ExchangeRateProvider): Promise<ExchangeRateSnapshot> =>
      ipcRenderer.invoke('exchange-rates:fetch', provider)
  },
  assetQuotes: {
    lookup: (input: AssetQuoteLookupInput): Promise<AssetQuoteLookupResult> =>
      ipcRenderer.invoke('asset-quotes:lookup', input)
  },
  portfolio: {
    load: (): Promise<PortfolioClientLoadResponse> => ipcRenderer.invoke('portfolio:load'),
    execute: (command: PortfolioCommand): Promise<PortfolioClientCommandResponse> =>
      ipcRenderer.invoke('portfolio:execute', command),
    syncAccount: (
      workspaceId: string,
      accountId: string
    ): Promise<PortfolioSyncResponse> =>
      ipcRenderer.invoke(
        'portfolio:sync-account',
        workspaceId,
        accountId
      ),
    refreshPositionPrices: (
      workspaceId: string,
      accountId?: string
    ): Promise<PortfolioPriceRefreshResponse> =>
      ipcRenderer.invoke(
        'portfolio:refresh-position-prices',
        workspaceId,
        accountId
      ),
    testProxy: (profileId: string, target: ProxyTestTarget): Promise<ProxyTestResult> =>
      ipcRenderer.invoke('portfolio:test-proxy', profileId, target),
    onChanged: (listener: () => void): (() => void) => {
      const handleChange = () => {
        listener()
      }
      ipcRenderer.on('portfolio:changed', handleChange)
      return () => ipcRenderer.removeListener('portfolio:changed', handleChange)
    }
  },
  backup: {
    exportData: (): Promise<BackupExportResult> =>
      ipcRenderer.invoke('backup:export'),
    importData: (): Promise<BackupImportResult> => ipcRenderer.invoke('backup:import'),
    confirmImport: (token: string): Promise<BackupImportConfirmResult> =>
      ipcRenderer.invoke('backup:confirm-import', token),
    discardImport: (token: string): Promise<void> =>
      ipcRenderer.invoke('backup:discard-import', token)
  },
  storage: {
    getLocation: (): Promise<StorageLocation> =>
      ipcRenderer.invoke('storage:get-location'),
    validateLocation: (path: string): Promise<StorageLocation> =>
      ipcRenderer.invoke('storage:validate-location', path),
    updateLocation: (path: string): Promise<StorageLocationChangeResult> =>
      ipcRenderer.invoke('storage:update-location', path)
  },
  mcp: {
    loadSettings: (): Promise<McpConnectionSettings> =>
      ipcRenderer.invoke('mcp:load-settings'),
    updateSettings: (
      settings: McpAccessSettings
    ): Promise<McpConnectionSettings> =>
      ipcRenderer.invoke('mcp:update-settings', settings)
  }
})
