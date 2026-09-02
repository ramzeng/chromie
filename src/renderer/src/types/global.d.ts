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
  HstongSyncOptions,
  HstongSyncResult
} from '../../../shared/hstong'
import type {
  McpAccessSettings,
  McpConnectionSettings
} from '../../../shared/mcp'
import type { OkxSyncOptions, OkxSyncResult } from '../../../shared/okx'
import type {
  WorkspaceBackup,
  PortfolioCommand,
  PortfolioClientCommandResponse,
  PortfolioClientLoadResponse,
  PortfolioSyncResponse
} from '../../../shared/portfolio'

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
      hstong?: {
        syncPositions: (options?: HstongSyncOptions) => Promise<HstongSyncResult>
      }
      exchangeRates?: {
        load: (legacyContent?: string) => Promise<ExchangeRateSnapshot | null>
        fetch: (provider: ExchangeRateProvider) => Promise<ExchangeRateSnapshot>
      }
      portfolio?: {
        load: () => Promise<PortfolioClientLoadResponse>
        execute: (command: PortfolioCommand) => Promise<PortfolioClientCommandResponse>
        syncAccount: (
          workspaceId: string,
          accountId: string
        ) => Promise<PortfolioSyncResponse>
        onChanged: (listener: () => void) => () => void
        inspectBackup: (content: string) => Promise<WorkspaceBackup | null>
        exportActiveWorkspace: () => Promise<string>
      }
      backup?: {
        exportData: (content: string) => Promise<BackupExportResult>
        importData: () => Promise<BackupImportResult>
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
