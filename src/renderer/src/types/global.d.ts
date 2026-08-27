export {}

import type { BackupExportResult, BackupImportResult } from '../../../shared/backup'
import type { ExchangeRateSnapshot } from '../../../shared/exchange-rates'
import type { FutuSyncOptions, FutuSyncResult } from '../../../shared/futu'
import type { OkxSyncOptions, OkxSyncResult } from '../../../shared/okx'
import type { ShareImageSaveResult } from '../../../shared/share-image'

declare global {
  interface Window {
    desktop: {
      platform: string
      futu?: {
        syncPositions: (options?: FutuSyncOptions) => Promise<FutuSyncResult>
      }
      okx?: {
        syncPositions: (options: OkxSyncOptions) => Promise<OkxSyncResult>
      }
      exchangeRates?: {
        fetch: () => Promise<ExchangeRateSnapshot>
      }
      backup?: {
        exportData: (content: string) => Promise<BackupExportResult>
        importData: () => Promise<BackupImportResult>
      }
      shareImage?: {
        save: (dataUrl: string, accountName: string) => Promise<ShareImageSaveResult>
      }
    }
  }
}
