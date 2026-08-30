import type { ExchangeRateRepository } from '../repository/exchange-rate-repository'
import type {
  ExchangeRateProvider,
  ExchangeRateSnapshot
} from '../../shared/exchange-rates'

export interface ExchangeRateSource {
  fetch(provider: ExchangeRateProvider): Promise<ExchangeRateSnapshot>
}

function normalizeSnapshot(value: unknown): ExchangeRateSnapshot | null {
  if (!value || typeof value !== 'object') return null
  const snapshot = value as Partial<ExchangeRateSnapshot>
  if (
    snapshot.provider !== 'coinbase' ||
    snapshot.baseCurrency !== 'USD' ||
    typeof snapshot.fetchedAt !== 'string' ||
    !Number.isFinite(Date.parse(snapshot.fetchedAt)) ||
    !snapshot.rates ||
    typeof snapshot.rates !== 'object' ||
    Array.isArray(snapshot.rates)
  ) {
    return null
  }

  const rates: Record<string, number> = { USD: 1 }
  Object.entries(snapshot.rates).forEach(([rawCurrency, rawRate]) => {
    const currency = rawCurrency.trim().toUpperCase()
    if (
      /^[A-Z0-9]{2,12}$/.test(currency) &&
      typeof rawRate === 'number' &&
      Number.isFinite(rawRate) &&
      rawRate > 0
    ) {
      rates[currency] = rawRate
    }
  })
  if (Object.keys(rates).length < 2) return null

  return {
    provider: 'coinbase',
    baseCurrency: 'USD',
    rates,
    fetchedAt: snapshot.fetchedAt
  }
}

export class ExchangeRateService {
  constructor(private readonly repository: ExchangeRateRepository) {}

  async load(legacyContent?: unknown): Promise<ExchangeRateSnapshot | null> {
    try {
      const raw = await this.repository.load()
      if (raw) return normalizeSnapshot(JSON.parse(raw))
      if (typeof legacyContent !== 'string') return null
      const legacySnapshot = normalizeSnapshot(JSON.parse(legacyContent))
      if (legacySnapshot) await this.repository.save(JSON.stringify(legacySnapshot))
      return legacySnapshot
    } catch {
      return null
    }
  }

  async refresh(
    provider: ExchangeRateProvider,
    source?: ExchangeRateSource
  ): Promise<ExchangeRateSnapshot> {
    if (!source) throw new Error('汇率组件尚未加载，请重启 Chromie')
    const snapshot = normalizeSnapshot(await source.fetch(provider))
    if (!snapshot) throw new Error('汇率服务返回的数据无效')
    await this.repository.save(JSON.stringify(snapshot))
    return snapshot
  }
}
