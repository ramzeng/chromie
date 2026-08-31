import { createContext, useContext, type ReactNode } from 'react'
import { ShieldCheck } from 'lucide-react'

import { BOC_ICON_DATA_URL } from '@/lib/boc-icon'
import { BOCI_ICON_DATA_URL } from '@/lib/boci-icon'
import { CMB_ICON_DATA_URL } from '@/lib/cmb-icon'
import { FUTU_ICON_DATA_URL } from '@/lib/futu-icon'
import { OKX_ICON_DATA_URL } from '@/lib/okx-icon'
import type { ExchangeRateState } from '@/lib/exchange-rates'
import {
  DEFAULT_SYNC_INTERVAL,
  type AssetAccount
} from '@/lib/portfolio'
import { cn } from '@/lib/utils'

export const ASSET_VALUE_MASK_STORAGE_KEY = 'chromie.asset-values-masked'
export const AssetValueMaskContext = createContext(false)

export function MaskedAssetValue({ children }: { children: ReactNode }) {
  const masked = useContext(AssetValueMaskContext)
  return masked ? (
    <span
      aria-label="资产数据已遮蔽"
      className="select-none tracking-[0.12em] text-muted-foreground"
    >
      ••••••
    </span>
  ) : (
    <>{children}</>
  )
}

export function loadAssetValueMask(): boolean {
  try {
    return window.localStorage.getItem(ASSET_VALUE_MASK_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function accountSyncInterval(account: AssetAccount): number {
  const value = account.sync?.interval
  return typeof value === 'number' && Number.isFinite(value) && value >= 5
    ? Math.min(Math.round(value), 3600)
    : DEFAULT_SYNC_INTERVAL
}

export function formatAmount(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

export function formatExchangeRate(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(value)
}

export function compareOptionalValuesDescending(
  left: number | undefined,
  right: number | undefined
): number {
  if (left === undefined) return right === undefined ? 0 : 1
  if (right === undefined) return -1
  return right - left
}

export function formatLastSyncedAt(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date)
}

export function cleanErrorMessage(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error)
  return rawMessage.replace(/^Error invoking remote method '[^']+': Error: /, '')
}

export function shortSnapshotHash(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 7)
}

export type ExchangeRateView = Pick<ExchangeRateState, 'snapshot' | 'status' | 'error'> &
  Partial<Pick<ExchangeRateState, 'refresh'>>

export function AccountTypeIcon({ type, className }: { type: string; className?: string }) {
  if (type === 'Futu') {
    return (
      <img
        src={FUTU_ICON_DATA_URL}
        alt=""
        aria-hidden="true"
        className={cn('shrink-0', className)}
      />
    )
  }

  if (type === 'Alipay') {
    return (
      <svg
        viewBox="0 0 48 48"
        aria-hidden="true"
        className={cn('shrink-0', className)}
      >
        <rect width="48" height="48" rx="7" fill="#1677ff" />
        <text
          x="24"
          y="32"
          fill="white"
          fontSize="25"
          fontWeight="700"
          textAnchor="middle"
        >
          支
        </text>
      </svg>
    )
  }

  if (type === 'Boci') {
    return (
      <img
        aria-hidden="true"
        src={BOCI_ICON_DATA_URL}
        alt=""
        className={cn('shrink-0 rounded-[14%]', className)}
      />
    )
  }

  if (type === 'Boc') {
    return (
      <img
        aria-hidden="true"
        src={BOC_ICON_DATA_URL}
        alt=""
        className={cn('shrink-0 rounded-[14%]', className)}
      />
    )
  }

  if (type === 'General') {
    return <ShieldCheck aria-hidden="true" className={cn('shrink-0 text-foreground', className)} />
  }

  if (type === 'Cmb') {
    return (
      <img
        aria-hidden="true"
        src={CMB_ICON_DATA_URL}
        alt=""
        className={cn('shrink-0 rounded-[14%]', className)}
      />
    )
  }

  if (type === 'Ibkr') {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'grid shrink-0 place-items-center rounded-[18%] bg-[#d81222] text-[0.42em] font-bold tracking-[-0.04em] text-white',
          className
        )}
      >
        IB
      </span>
    )
  }

  if (type === 'Binance') {
    return (
      <svg
        viewBox="0 0 48 48"
        aria-hidden="true"
        className={cn('shrink-0', className)}
      >
        <rect width="48" height="48" rx="9" fill="#181a20" />
        <g fill="#f3ba2f">
          <path d="M24 10l5.1 5.1L24 20.2l-5.1-5.1L24 10Z" />
          <path d="m15.1 18.9 5.1 5.1-5.1 5.1L10 24l5.1-5.1Z" />
          <path d="m32.9 18.9 5.1 5.1-5.1 5.1-5.1-5.1 5.1-5.1Z" />
          <path d="m24 27.8 5.1 5.1L24 38l-5.1-5.1 5.1-5.1Z" />
          <path d="m24 20.3 3.7 3.7-3.7 3.7-3.7-3.7 3.7-3.7Z" />
        </g>
      </svg>
    )
  }

  if (type === 'Okx') {
    return (
      <img
        src={OKX_ICON_DATA_URL}
        alt=""
        aria-hidden="true"
        className={cn('shrink-0', className)}
      />
    )
  }

  return <ShieldCheck aria-hidden="true" className={cn('shrink-0', className)} />
}
