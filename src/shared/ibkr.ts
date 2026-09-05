export type IbkrSyncedPosition = {
  market: 'CN' | 'HK' | 'US' | 'CC'
  symbol: string
  name: string
  currency: string
  quantity: number
  price?: number
}

export type IbkrSyncResult = {
  positions: IbkrSyncedPosition[]
  accountCount: number
  syncedAt: string
}

export const DEFAULT_IBKR_GATEWAY_HOST = '127.0.0.1'
export const DEFAULT_IBKR_GATEWAY_PORT = 4002

export type IbkrSyncOptions = {
  host?: string
  port?: number
}
