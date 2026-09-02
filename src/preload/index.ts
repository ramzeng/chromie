import { contextBridge, ipcRenderer } from 'electron'

import type { BackupExportResult, BackupImportResult } from '../shared/backup'
import type { BinanceSyncOptions, BinanceSyncResult } from '../shared/binance'
import type {
  ExchangeRateProvider,
  ExchangeRateSnapshot
} from '../shared/exchange-rates'
import type { FutuSyncOptions, FutuSyncResult } from '../shared/futu'
import type { IbkrSyncOptions, IbkrSyncResult } from '../shared/ibkr'
import type { HstongSyncOptions, HstongSyncResult } from '../shared/hstong'
import type {
  McpAccessSettings,
  McpConnectionSettings
} from '../shared/mcp'
import type { OkxSyncOptions, OkxSyncResult } from '../shared/okx'
import type {
  WorkspaceBackup,
  PortfolioCommand,
  PortfolioClientCommandResponse,
  PortfolioClientLoadResponse,
  PortfolioSyncResponse
} from '../shared/portfolio'

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  futu: {
    syncPositions: (options?: FutuSyncOptions): Promise<FutuSyncResult> =>
      ipcRenderer.invoke('futu:sync-positions', options)
  },
  okx: {
    syncPositions: (options: OkxSyncOptions): Promise<OkxSyncResult> =>
      ipcRenderer.invoke('okx:sync-positions', options)
  },
  binance: {
    syncPositions: (options: BinanceSyncOptions): Promise<BinanceSyncResult> =>
      ipcRenderer.invoke('binance:sync-positions', options)
  },
  ibkr: {
    syncPositions: (options?: IbkrSyncOptions): Promise<IbkrSyncResult> =>
      ipcRenderer.invoke('ibkr:sync-positions', options)
  },
  hstong: {
    syncPositions: (options?: HstongSyncOptions): Promise<HstongSyncResult> =>
      ipcRenderer.invoke('hstong:sync-positions', options)
  },
  exchangeRates: {
    load: (legacyContent?: string): Promise<ExchangeRateSnapshot | null> =>
      ipcRenderer.invoke('exchange-rates:load', legacyContent),
    fetch: (provider: ExchangeRateProvider): Promise<ExchangeRateSnapshot> =>
      ipcRenderer.invoke('exchange-rates:fetch', provider)
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
    onChanged: (listener: () => void): (() => void) => {
      const handleChange = () => {
        listener()
      }
      ipcRenderer.on('portfolio:changed', handleChange)
      return () => ipcRenderer.removeListener('portfolio:changed', handleChange)
    },
    inspectBackup: (content: string): Promise<WorkspaceBackup | null> =>
      ipcRenderer.invoke('portfolio:inspect-backup', content),
    exportActiveWorkspace: (): Promise<string> =>
      ipcRenderer.invoke('portfolio:export-active-workspace')
  },
  backup: {
    exportData: (content: string): Promise<BackupExportResult> =>
      ipcRenderer.invoke('backup:export', content),
    importData: (): Promise<BackupImportResult> => ipcRenderer.invoke('backup:import')
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
