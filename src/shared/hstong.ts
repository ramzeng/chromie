export type HstongSyncedPosition = {
  market: 'CN' | 'HK' | 'US'
  symbol: string
  name: string
  currency: string
  quantity: number
  price?: number
}

export type HstongSyncResult = {
  positions: HstongSyncedPosition[]
  marketCount: number
  syncedAt: string
}

export const DEFAULT_HSTONG_GATEWAY_HOST = '127.0.0.1'
export const DEFAULT_HSTONG_GATEWAY_PORT = 11111

export type HstongSyncOptions = {
  host?: string
  port?: number
  tradingPassword?: string
}
