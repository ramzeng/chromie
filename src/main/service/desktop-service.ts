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
import type {
  AccountNetworkRoute,
  ProxyProfile,
  ProxyTestResult,
  ProxyTestTarget
} from '../../shared/integrations'
import type { FetchLike } from '../infra/proxy-http'
import {
  diagnosticErrorMessage,
  type SyncDiagnosticLogger
} from './sync-diagnostics'

type NetworkSyncConfig = {
  route: AccountNetworkRoute
  proxyProfile?: ProxyProfile
}

export type AssetSyncRequest =
  | { provider: 'futu'; options?: FutuSyncOptions }
  | { provider: 'okx'; options?: OkxSyncOptions; network: NetworkSyncConfig }
  | { provider: 'binance'; options?: BinanceSyncOptions; network: NetworkSyncConfig }
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
  syncOkxPositions: (options: OkxSyncOptions | undefined, fetchImpl: FetchLike) => Promise<OkxSyncResult>
  syncBinancePositions: (
    options: BinanceSyncOptions | undefined,
    fetchImpl: FetchLike
  ) => Promise<BinanceSyncResult>
  syncIbkrPositions: (options?: IbkrSyncOptions) => Promise<IbkrSyncResult>
  syncHstongPositions: (options?: HstongSyncOptions) => Promise<HstongSyncResult>
  fetchExchangeRates: (provider: ExchangeRateProvider) => Promise<ExchangeRateSnapshot>
  loadExchangeRates: (legacyContent?: unknown) => Promise<ExchangeRateSnapshot | null>
  lookupAssetQuote?: (input: AssetQuoteLookupInput) => Promise<AssetQuote | null>
  exportBackup: (ownerId: number, content: unknown) => Promise<BackupExportResult>
  importBackup: (ownerId: number) => Promise<BackupFileImportResult>
  systemFetch: FetchLike
  directFetch: FetchLike
  createProxyFetch: (profile: ProxyProfile) => FetchLike
  testProxyConnection: (
    profile: ProxyProfile,
    target: ProxyTestTarget
  ) => Promise<ProxyTestResult>
}

export interface DesktopOperations {
  syncPositions(request: AssetSyncRequest): Promise<AssetSyncResult>
  loadExchangeRates(legacyContent?: unknown): Promise<ExchangeRateSnapshot | null>
  fetchExchangeRates(provider: unknown): Promise<ExchangeRateSnapshot>
  lookupAssetQuote?(input: unknown): Promise<AssetQuoteLookupResult>
  exportBackup(ownerId: number, content: unknown): Promise<BackupExportResult>
  importBackup(ownerId: number): Promise<BackupFileImportResult>
  testProxy?(profile: ProxyProfile, target: ProxyTestTarget): Promise<ProxyTestResult>
}

export class DesktopService implements DesktopOperations {
  constructor(
    private readonly dependencies: DesktopServiceDependencies,
    private readonly diagnostics?: SyncDiagnosticLogger
  ) {}

  syncPositions(request: AssetSyncRequest): Promise<AssetSyncResult> {
    switch (request.provider) {
      case 'futu':
        return this.dependencies.syncFutuPositions(request.options)
      case 'okx':
        return this.dependencies.syncOkxPositions(
          request.options,
          this.resolveNetworkFetch(request.network)
        )
      case 'binance':
        return this.dependencies.syncBinancePositions(
          request.options,
          this.resolveNetworkFetch(request.network)
        )
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
    if (!input || typeof input !== 'object') {
      this.diagnostics?.('warn', 'quote.lookup.rejected', {
        reason: 'request-is-not-an-object'
      })
      throw new Error('行情查询请求无效')
    }
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
      this.diagnostics?.('warn', 'quote.lookup.rejected', {
        reason: 'invalid-market-symbol-or-provider',
        market,
        symbol,
        provider
      })
      throw new Error('行情查询请求无效')
    }
    if (!this.dependencies.lookupAssetQuote) {
      this.diagnostics?.('warn', 'quote.lookup.unavailable', {
        reason: 'quote-adapter-not-configured',
        market,
        symbol,
        provider
      })
      return { status: 'unavailable' }
    }

    const startedAt = Date.now()
    this.diagnostics?.('info', 'quote.lookup.started', {
      market,
      symbol,
      provider
    })
    try {
      const quote = await this.dependencies.lookupAssetQuote({
        market,
        symbol,
        provider: provider as AssetQuoteLookupInput['provider']
      })
      if (!quote) {
        this.diagnostics?.('warn', 'quote.lookup.not-found', {
          market,
          symbol,
          provider,
          durationMs: Date.now() - startedAt
        })
        return { status: 'not-found' }
      }
      this.diagnostics?.('info', 'quote.lookup.found', {
        market,
        symbol,
        provider,
        quoteMarket: quote.market,
        quoteSymbol: quote.symbol,
        quoteSource: quote.source,
        price: quote.price,
        currency: quote.currency,
        durationMs: Date.now() - startedAt
      })
      return { status: 'found', quote }
    } catch (error) {
      this.diagnostics?.('error', 'quote.lookup.failed', {
        market,
        symbol,
        provider,
        error: diagnosticErrorMessage(error),
        durationMs: Date.now() - startedAt
      })
      return { status: 'unavailable' }
    }
  }

  exportBackup(ownerId: number, content: unknown): Promise<BackupExportResult> {
    return this.dependencies.exportBackup(ownerId, content)
  }

  importBackup(ownerId: number): Promise<BackupFileImportResult> {
    return this.dependencies.importBackup(ownerId)
  }

  testProxy(profile: ProxyProfile, target: ProxyTestTarget): Promise<ProxyTestResult> {
    return this.dependencies.testProxyConnection(profile, target)
  }

  private resolveNetworkFetch(network: NetworkSyncConfig): FetchLike {
    if (network.route.mode === 'system') return this.dependencies.systemFetch
    if (network.route.mode === 'direct') return this.dependencies.directFetch
    if (!network.proxyProfile || network.proxyProfile.id !== network.route.proxyProfileId) {
      throw new Error('账户引用的代理配置已不存在')
    }
    return this.dependencies.createProxyFetch(network.proxyProfile)
  }
}
