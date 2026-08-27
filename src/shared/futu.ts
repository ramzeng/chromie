export type FutuSyncedPosition = {
  market: 'US' | 'HK'
  symbol: string
  name: string
  currency: string
  quantity: number
  price?: number
}

export type FutuSyncResult = {
  positions: FutuSyncedPosition[]
  accountCount: number
  syncedAt: string
}

export const DEFAULT_FUTU_OPEND_HOST = '127.0.0.1'
export const DEFAULT_FUTU_OPEND_PORT = 33333

export type FutuSyncOptions = {
  host?: string
  port?: number
  key?: string
}
