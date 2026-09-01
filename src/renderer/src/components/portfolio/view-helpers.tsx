import type { ReactNode } from 'react'
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

export function MaskedAssetValue({ children }: { children: ReactNode }) {
  return <>{children}</>
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
        <rect width="48" height="48" rx="5" fill="#1677ff" />
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
        className={cn('shrink-0 rounded-sm', className)}
      />
    )
  }

  if (type === 'Boc') {
    return (
      <img
        aria-hidden="true"
        src={BOC_ICON_DATA_URL}
        alt=""
        className={cn('shrink-0 rounded-sm', className)}
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
        className={cn('shrink-0 rounded-sm', className)}
      />
    )
  }

  if (type === 'Ibkr') {
    return (
      <svg
        viewBox="0 0 48 48"
        aria-hidden="true"
        className={cn(
          'shrink-0 overflow-hidden rounded-sm',
          className
        )}
      >
        <rect width="48" height="48" rx="8" fill="#111116" />
        <path d="M0 48 8.3 22.2 31.8 48Z" fill="#b20b1d" />
        <path d="M0 14.2 13.4 0H22L0 47Z" fill="#e40b21" />
        <circle cx="27.5" cy="23.7" r="8.8" fill="#e40b21" />
      </svg>
    )
  }

  if (type === 'Binance') {
    return (
      <svg
        viewBox="0 0 48 48"
        aria-hidden="true"
        className={cn('shrink-0 overflow-hidden rounded-sm', className)}
      >
        <rect width="48" height="48" rx="8" fill="#0b0e11" />
        <path
          fill="#fcd535"
          transform="translate(6 6) scale(1.5)"
          d="m16.624 13.92 2.718 2.716-7.353 7.353-7.353-7.352 2.717-2.717 4.636 4.66 4.635-4.66Zm4.637-4.636L24 12l-2.715 2.716L18.568 12l2.693-2.716Zm-9.272 0 2.716 2.692-2.717 2.717L9.272 12l2.716-2.715Zm-9.273 0L5.409 12l-2.692 2.692L0 12l2.716-2.716ZM11.989.012l7.353 7.329-2.718 2.715-4.635-4.636-4.636 4.66-2.717-2.716L11.989.012Z"
        />
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
