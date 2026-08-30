import { useCallback, useEffect, useRef, useState } from 'react'

import {
  DEFAULT_EXCHANGE_RATE_PROVIDER,
  DEFAULT_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  type ExchangeRateProvider,
  type ExchangeRateSnapshot
} from '../../../shared/exchange-rates'

const LEGACY_EXCHANGE_RATE_STORAGE_KEY = 'chromie.exchange-rates.v1'

export type ExchangeRateStatus = 'idle' | 'loading' | 'ready' | 'refreshing' | 'error'

export type ExchangeRateState = {
  snapshot: ExchangeRateSnapshot | null
  status: ExchangeRateStatus
  error: string
  refresh: () => Promise<void>
}

function cleanIpcError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error)
  return rawMessage.replace(/^Error invoking remote method '[^']+': Error: /, '')
}

export function useExchangeRates(
  provider: ExchangeRateProvider = DEFAULT_EXCHANGE_RATE_PROVIDER,
  refreshIntervalMinutes = DEFAULT_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  enabled = true
): ExchangeRateState {
  const [snapshot, setSnapshot] = useState<ExchangeRateSnapshot | null>(null)
  const [status, setStatus] = useState<ExchangeRateStatus>('idle')
  const [error, setError] = useState('')
  const refreshing = useRef(false)

  const refresh = useCallback(async (): Promise<void> => {
    if (refreshing.current) return
    refreshing.current = true
    setStatus((current) => current === 'ready' || current === 'error' ? 'refreshing' : 'loading')
    try {
      if (!window.desktop.exchangeRates) {
        throw new Error('汇率组件尚未加载，请重启 Chromie')
      }
      const result = await window.desktop.exchangeRates.fetch(provider)
      setSnapshot(result)
      setError('')
      setStatus('ready')
    } catch (refreshError) {
      setError(cleanIpcError(refreshError))
      setStatus('error')
    } finally {
      refreshing.current = false
    }
  }, [provider])

  useEffect(() => {
    let active = true

    async function loadCachedSnapshot(): Promise<void> {
      try {
        if (!window.desktop.exchangeRates) return
        const legacyContent = window.localStorage.getItem(
          LEGACY_EXCHANGE_RATE_STORAGE_KEY
        )
        const cached = await window.desktop.exchangeRates.load(
          legacyContent ?? undefined
        )
        if (!active) return
        if (cached) {
          setSnapshot((current) => current ?? cached)
          setStatus((current) => current === 'idle' ? 'ready' : current)
        }
        if (legacyContent !== null) {
          window.localStorage.removeItem(LEGACY_EXCHANGE_RATE_STORAGE_KEY)
        }
      } catch {
        // Refresh below remains the source of user-facing errors.
      }
    }

    void loadCachedSnapshot()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void refresh()
    const timer = window.setInterval(
      () => void refresh(),
      refreshIntervalMinutes * 60 * 1000
    )
    return () => window.clearInterval(timer)
  }, [enabled, refresh, refreshIntervalMinutes])

  return { snapshot, status, error, refresh }
}
