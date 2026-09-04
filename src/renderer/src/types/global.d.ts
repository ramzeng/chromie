export {}

import type {
  BackupExportResult,
  BackupImportConfirmResult,
  BackupImportResult
} from '../../../shared/backup'
import type {
  ExchangeRateProvider,
  ExchangeRateSnapshot
} from '../../../shared/exchange-rates'
import type {
  McpAccessSettings,
  McpConnectionSettings
} from '../../../shared/mcp'
import type {
  StorageLocation,
  StorageLocationChangeResult
} from '../../../shared/storage'
import type {
  PortfolioCommand,
  PortfolioClientCommandResponse,
  PortfolioClientLoadResponse,
  PortfolioSyncResponse
} from '../../../shared/portfolio'
import type {
  AssetQuoteLookupInput,
  AssetQuoteLookupResult
} from '../../../shared/asset-quotes'
import type { ProxyTestResult, ProxyTestTarget } from '../../../shared/integrations'

declare global {
  interface Window {
    desktop: {
      platform: string
      exchangeRates?: {
        load: (legacyContent?: string) => Promise<ExchangeRateSnapshot | null>
        fetch: (provider: ExchangeRateProvider) => Promise<ExchangeRateSnapshot>
      }
      assetQuotes?: {
        lookup: (input: AssetQuoteLookupInput) => Promise<AssetQuoteLookupResult>
      }
      portfolio?: {
        load: () => Promise<PortfolioClientLoadResponse>
        execute: (command: PortfolioCommand) => Promise<PortfolioClientCommandResponse>
        syncAccount: (
          workspaceId: string,
          accountId: string
        ) => Promise<PortfolioSyncResponse>
        testProxy: (profileId: string, target: ProxyTestTarget) => Promise<ProxyTestResult>
        onChanged: (listener: () => void) => () => void
      }
      backup?: {
        exportData: () => Promise<BackupExportResult>
        importData: () => Promise<BackupImportResult>
        confirmImport: (token: string) => Promise<BackupImportConfirmResult>
        discardImport: (token: string) => Promise<void>
      }
      storage?: {
        getLocation: () => Promise<StorageLocation>
        validateLocation: (path: string) => Promise<StorageLocation>
        updateLocation: (path: string) => Promise<StorageLocationChangeResult>
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
