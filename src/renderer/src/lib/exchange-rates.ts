import { useCallback, useEffect, useRef, useState } from 'react'

import type { ExchangeRateSnapshot } from '../../../shared/exchange-rates'

const STORAGE_KEY = 'chromie.exchange-rates.v1'
const REFRESH_INTERVAL_MS = 15 * 60 * 1000

export type ExchangeRateStatus = 'idle' | 'loading' | 'ready' | 'refreshing' | 'error'

export type ExchangeRateState = {
  snapshot: ExchangeRateSnapshot | null
  status: ExchangeRateStatus
  error: string
  refresh: () => Promise<void>
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

function loadSnapshot(): ExchangeRateSnapshot | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? normalizeSnapshot(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

function cleanIpcError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error)
  return rawMessage.replace(/^Error invoking remote method '[^']+': Error: /, '')
}

export function useExchangeRates(enabled = true): ExchangeRateState {
  const [snapshot, setSnapshot] = useState<ExchangeRateSnapshot | null>(loadSnapshot)
  const [status, setStatus] = useState<ExchangeRateStatus>(snapshot ? 'ready' : 'idle')
  const [error, setError] = useState('')
  const refreshing = useRef(false)

  const refresh = useCallback(async (): Promise<void> => {
    if (refreshing.current) return
    refreshing.current = true
    setStatus((current) => current === 'ready' || current === 'error' ? 'refreshing' : 'loading')
    try {
      if (!window.desktop.exchangeRates?.fetch) {
        throw new Error('汇率组件尚未加载，请重启 Chromie')
      }
      const result = normalizeSnapshot(await window.desktop.exchangeRates.fetch())
      if (!result) throw new Error('汇率服务返回的数据无效')
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(result))
      setSnapshot(result)
      setError('')
      setStatus('ready')
    } catch (refreshError) {
      setError(cleanIpcError(refreshError))
      setStatus('error')
    } finally {
      refreshing.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void refresh()
    const timer = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [enabled, refresh])

  return { snapshot, status, error, refresh }
}
