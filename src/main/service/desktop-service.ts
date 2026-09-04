import type { BackupExportResult } from '../../shared/backup'
import type { BackupFileImportResult } from '../infra/backup'
import type {
  AssetQuote,
  AssetQuoteLookupInput,
  AssetQuoteLookupResult
} from '../../shared/asset-quotes'
import {
  CRYPTO_QUOTE_PROVIDERS,
  STOCK_QUOTE_PROVIDERS,
  type CryptoQuoteProvider,
  type StockQuoteProvider
} from '../../shared/asset-quotes'
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
import type { HstongSyncOptions, HstongSyncResult } from '../../shared/hstong'
import type { OkxSyncOptions, OkxSyncResult } from '../../shared/okx'

export type AssetSyncRequest =
  | { provider: 'futu'; options?: FutuSyncOptions }
  | { provider: 'okx'; options?: OkxSyncOptions }
  | { provider: 'binance'; options?: BinanceSyncOptions }
  | { provider: 'ibkr'; options?: IbkrSyncOptions }
  | { provider: 'hstong'; options?: HstongSyncOptions }

export type AssetSyncResult =
  | FutuSyncResult
  | OkxSyncResult
  | BinanceSyncResult
  | IbkrSyncResult
  | HstongSyncResult

export type DesktopServiceDependencies = {
  syncFutuPositions: (options?: FutuSyncOptions) => Promise<FutuSyncResult>
  syncOkxPositions: (options?: OkxSyncOptions) => Promise<OkxSyncResult>
  syncBinancePositions: (options?: BinanceSyncOptions) => Promise<BinanceSyncResult>
  syncIbkrPositions: (options?: IbkrSyncOptions) => Promise<IbkrSyncResult>
  syncHstongPositions: (options?: HstongSyncOptions) => Promise<HstongSyncResult>
  fetchExchangeRates: (provider: ExchangeRateProvider) => Promise<ExchangeRateSnapshot>
  loadExchangeRates: (legacyContent?: unknown) => Promise<ExchangeRateSnapshot | null>
  lookupAssetQuote?: (input: AssetQuoteLookupInput) => Promise<AssetQuote | null>
  exportBackup: (ownerId: number, content: unknown) => Promise<BackupExportResult>
  importBackup: (ownerId: number) => Promise<BackupFileImportResult>
}

export interface DesktopOperations {
  syncPositions(request: AssetSyncRequest): Promise<AssetSyncResult>
  loadExchangeRates(legacyContent?: unknown): Promise<ExchangeRateSnapshot | null>
  fetchExchangeRates(provider: unknown): Promise<ExchangeRateSnapshot>
  lookupAssetQuote?(input: unknown): Promise<AssetQuoteLookupResult>
  exportBackup(ownerId: number, content: unknown): Promise<BackupExportResult>
  importBackup(ownerId: number): Promise<BackupFileImportResult>
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
      case 'hstong':
        return this.dependencies.syncHstongPositions(request.options)
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

  async lookupAssetQuote(input: unknown): Promise<AssetQuoteLookupResult> {
    if (!input || typeof input !== 'object') throw new Error('行情查询请求无效')
    const request = input as Partial<AssetQuoteLookupInput>
    const market = request.market
    const provider = request.provider
    const symbol = typeof request.symbol === 'string'
      ? request.symbol.trim().toUpperCase()
      : ''
    if (
      (market !== 'CN' &&
        market !== 'CN_OTC' &&
        market !== 'HK' &&
        market !== 'US' &&
        market !== 'CC') ||
      !symbol ||
      symbol.length > 24 ||
      !/^[A-Z0-9.^=/:_-]+$/.test(symbol) ||
      (market === 'CN_OTC'
        ? provider !== 'eastmoney'
        : market === 'CC'
          ? !CRYPTO_QUOTE_PROVIDERS.includes(provider as CryptoQuoteProvider)
          : !STOCK_QUOTE_PROVIDERS.includes(provider as StockQuoteProvider))
    ) {
      throw new Error('行情查询请求无效')
    }
    if (!this.dependencies.lookupAssetQuote) return { status: 'unavailable' }

    try {
      const quote = await this.dependencies.lookupAssetQuote({
        market,
        symbol,
        provider: provider as AssetQuoteLookupInput['provider']
      })
      return quote ? { status: 'found', quote } : { status: 'not-found' }
    } catch {
      return { status: 'unavailable' }
    }
  }

  exportBackup(ownerId: number, content: unknown): Promise<BackupExportResult> {
    return this.dependencies.exportBackup(ownerId, content)
  }

  importBackup(ownerId: number): Promise<BackupFileImportResult> {
    return this.dependencies.importBackup(ownerId)
  }

}
