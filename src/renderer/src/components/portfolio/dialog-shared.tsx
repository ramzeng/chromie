import { ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  BASE_CURRENCIES,
  accountTypeLabels,
  defaultCurrencyByMarket,
  type AccountType
} from '@/lib/portfolio'

export type BaseDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type AutoSyncProvider = 'Futu' | 'Hstong' | 'Ibkr' | 'Okx' | 'Binance'
export type StorageLocationStatus = 'loading' | 'ready' | 'unavailable' | 'error'

const OFFICIAL_INTEGRATION_DOCS: Record<AutoSyncProvider, string> = {
  Futu: 'https://openapi.futunn.com/futu-api-doc/intro/intro.html?lang=zh-cn',
  Hstong: 'https://quant-open.hstong.com/api-docs/introduction/guidelines.html',
  Ibkr: 'https://ibkrcampus.com/campus/trading-lessons/installing-configuring-tws-for-the-api/',
  Okx: 'https://www.okx.com/docs-v5/zh/#overview',
  Binance:
    'https://developers.binance.com/zh-CN/docs/products/spot/rest-api#general-api-information'
}

export function OfficialIntegrationDocsLink({ provider }: { provider: AutoSyncProvider }) {
  return (
    <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
      <a href={OFFICIAL_INTEGRATION_DOCS[provider]} target="_blank" rel="noopener noreferrer">
        官方接入文档
        <ExternalLink data-icon="inline-end" />
      </a>
    </Button>
  )
}

export const ACCOUNT_TYPES: readonly AccountType[] = [
  'Futu',
  'Hstong',
  'Ibkr',
  'Boci',
  'Okx',
  'Binance',
  'Alipay',
  'Cmb',
  'Boc',
  'General'
]

export const POSITION_CURRENCIES = [
  ...new Set([...BASE_CURRENCIES, ...Object.values(defaultCurrencyByMarket)])
].filter((currency) => currency !== 'USDT')

export function defaultAccountName(type: AccountType): string {
  return `我的${accountTypeLabels[type]}`
}
