export {}

import type { BackupExportResult, BackupImportResult } from '../../../shared/backup'
import type {
  BinanceSyncOptions,
  BinanceSyncResult
} from '../../../shared/binance'
import type {
  ExchangeRateProvider,
  ExchangeRateSnapshot
} from '../../../shared/exchange-rates'
import type { FutuSyncOptions, FutuSyncResult } from '../../../shared/futu'
import type { IbkrSyncOptions, IbkrSyncResult } from '../../../shared/ibkr'
import type {
  McpAccessSettings,
  McpConnectionSettings
} from '../../../shared/mcp'
import type { OkxSyncOptions, OkxSyncResult } from '../../../shared/okx'
import type {
  AccountBackup,
  PortfolioCommand,
  PortfolioClientCommandResponse,
  PortfolioClientLoadResponse,
  PortfolioSyncResponse
} from '../../../shared/portfolio'
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
      binance?: {
        syncPositions: (options: BinanceSyncOptions) => Promise<BinanceSyncResult>
      }
      ibkr?: {
        syncPositions: (options?: IbkrSyncOptions) => Promise<IbkrSyncResult>
      }
      exchangeRates?: {
        load: (legacyContent?: string) => Promise<ExchangeRateSnapshot | null>
        fetch: (provider: ExchangeRateProvider) => Promise<ExchangeRateSnapshot>
      }
      portfolio?: {
        load: () => Promise<PortfolioClientLoadResponse>
        execute: (command: PortfolioCommand) => Promise<PortfolioClientCommandResponse>
        syncAssetAccount: (
          accountId: string,
          assetAccountId: string
        ) => Promise<PortfolioSyncResponse>
        onChanged: (listener: () => void) => () => void
        inspectBackup: (content: string) => Promise<AccountBackup | null>
        exportActiveAccount: () => Promise<string>
      }
      backup?: {
        exportData: (content: string) => Promise<BackupExportResult>
        importData: () => Promise<BackupImportResult>
      }
      shareImage?: {
        save: (dataUrl: string, accountName: string) => Promise<ShareImageSaveResult>
      }
      mcp?: {
        loadSettings: () => Promise<McpConnectionSettings>
        updateSettings: (
          settings: McpAccessSettings
        ) => Promise<McpConnectionSettings>
      }
    }
  }
}
