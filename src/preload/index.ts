import { contextBridge, ipcRenderer } from 'electron'

import type { BackupExportResult, BackupImportResult } from '../shared/backup'
import type { BinanceSyncOptions, BinanceSyncResult } from '../shared/binance'
import type {
  ExchangeRateProvider,
  ExchangeRateSnapshot
} from '../shared/exchange-rates'
import type { FutuSyncOptions, FutuSyncResult } from '../shared/futu'
import type { IbkrSyncOptions, IbkrSyncResult } from '../shared/ibkr'
import type { OkxSyncOptions, OkxSyncResult } from '../shared/okx'
import type {
  AccountBackup,
  PortfolioCommand,
  PortfolioCommandResponse,
  PortfolioLoadResponse
} from '../shared/portfolio'
import type { ShareImageSaveResult } from '../shared/share-image'

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
  exchangeRates: {
    load: (legacyContent?: string): Promise<ExchangeRateSnapshot | null> =>
      ipcRenderer.invoke('exchange-rates:load', legacyContent),
    fetch: (provider: ExchangeRateProvider): Promise<ExchangeRateSnapshot> =>
      ipcRenderer.invoke('exchange-rates:fetch', provider)
  },
  portfolio: {
    load: (legacyContent?: string): Promise<PortfolioLoadResponse> =>
      ipcRenderer.invoke('portfolio:load', legacyContent),
    execute: (command: PortfolioCommand): Promise<PortfolioCommandResponse> =>
      ipcRenderer.invoke('portfolio:execute', command),
    inspectBackup: (content: string): Promise<AccountBackup | null> =>
      ipcRenderer.invoke('portfolio:inspect-backup', content),
    exportActiveAccount: (): Promise<string> =>
      ipcRenderer.invoke('portfolio:export-active-account')
  },
  backup: {
    exportData: (content: string): Promise<BackupExportResult> =>
      ipcRenderer.invoke('backup:export', content),
    importData: (): Promise<BackupImportResult> => ipcRenderer.invoke('backup:import')
  },
  shareImage: {
    save: (dataUrl: string, accountName: string): Promise<ShareImageSaveResult> =>
      ipcRenderer.invoke('share-image:save', dataUrl, accountName)
  }
})
