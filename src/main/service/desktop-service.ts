import type { BackupExportResult, BackupImportResult } from '../../shared/backup'
import type {
  BinanceSyncOptions,
  BinanceSyncResult
} from '../../shared/binance'
import {
  DEFAULT_EXCHANGE_RATE_PROVIDER,
  EXCHANGE_RATE_PROVIDERS,
  type ExchangeRateProvider,
  type ExchangeRateSnapshot
} from '../../shared/exchange-rates'
import type { FutuSyncOptions, FutuSyncResult } from '../../shared/futu'
import type { IbkrSyncOptions, IbkrSyncResult } from '../../shared/ibkr'
import type { OkxSyncOptions, OkxSyncResult } from '../../shared/okx'

export type AssetSyncRequest =
  | { provider: 'futu'; options?: FutuSyncOptions }
  | { provider: 'okx'; options?: OkxSyncOptions }
  | { provider: 'binance'; options?: BinanceSyncOptions }
  | { provider: 'ibkr'; options?: IbkrSyncOptions }

export type AssetSyncResult =
  | FutuSyncResult
  | OkxSyncResult
  | BinanceSyncResult
  | IbkrSyncResult

export type DesktopServiceDependencies = {
  syncFutuPositions: (options?: FutuSyncOptions) => Promise<FutuSyncResult>
  syncOkxPositions: (options?: OkxSyncOptions) => Promise<OkxSyncResult>
  syncBinancePositions: (options?: BinanceSyncOptions) => Promise<BinanceSyncResult>
  syncIbkrPositions: (options?: IbkrSyncOptions) => Promise<IbkrSyncResult>
  fetchExchangeRates: (provider: ExchangeRateProvider) => Promise<ExchangeRateSnapshot>
  loadExchangeRates: (legacyContent?: unknown) => Promise<ExchangeRateSnapshot | null>
  exportBackup: (ownerId: number, content: unknown) => Promise<BackupExportResult>
  importBackup: (ownerId: number) => Promise<BackupImportResult>
}

export interface DesktopOperations {
  syncPositions(request: AssetSyncRequest): Promise<AssetSyncResult>
  loadExchangeRates(legacyContent?: unknown): Promise<ExchangeRateSnapshot | null>
  fetchExchangeRates(provider: unknown): Promise<ExchangeRateSnapshot>
  exportBackup(ownerId: number, content: unknown): Promise<BackupExportResult>
  importBackup(ownerId: number): Promise<BackupImportResult>
}

export class DesktopService implements DesktopOperations {
  constructor(private readonly dependencies: DesktopServiceDependencies) {}

  syncPositions(request: AssetSyncRequest): Promise<AssetSyncResult> {
    switch (request.provider) {
      case 'futu':
        return this.dependencies.syncFutuPositions(request.options)
      case 'okx':
        return this.dependencies.syncOkxPositions(request.options)
      case 'binance':
        return this.dependencies.syncBinancePositions(request.options)
      case 'ibkr':
        return this.dependencies.syncIbkrPositions(request.options)
    }
  }

  loadExchangeRates(legacyContent?: unknown): Promise<ExchangeRateSnapshot | null> {
    return this.dependencies.loadExchangeRates(legacyContent)
  }

  fetchExchangeRates(provider: unknown): Promise<ExchangeRateSnapshot> {
    const selectedProvider = provider ?? DEFAULT_EXCHANGE_RATE_PROVIDER
    if (!EXCHANGE_RATE_PROVIDERS.includes(selectedProvider as ExchangeRateProvider)) {
      throw new Error('不支持的汇率数据源')
    }
    return this.dependencies.fetchExchangeRates(selectedProvider as ExchangeRateProvider)
  }

  exportBackup(ownerId: number, content: unknown): Promise<BackupExportResult> {
    return this.dependencies.exportBackup(ownerId, content)
  }

  importBackup(ownerId: number): Promise<BackupImportResult> {
    return this.dependencies.importBackup(ownerId)
  }

}
