import { contextBridge, ipcRenderer } from 'electron'

import type { BackupExportResult, BackupImportResult } from '../shared/backup'
import type { ExchangeRateSnapshot } from '../shared/exchange-rates'
import type { FutuSyncOptions, FutuSyncResult } from '../shared/futu'
import type { OkxSyncOptions, OkxSyncResult } from '../shared/okx'
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
  exchangeRates: {
    fetch: (): Promise<ExchangeRateSnapshot> => ipcRenderer.invoke('exchange-rates:fetch')
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
