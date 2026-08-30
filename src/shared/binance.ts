export type BinanceSyncedPosition = {
  market: 'CC'
  symbol: string
  name: string
  currency: 'USD'
  quantity: number
  price?: number
}

export type BinanceSyncResult = {
  positions: BinanceSyncedPosition[]
  syncedAt: string
}

export type BinanceSyncOptions = {
  apiKey: string
  secretKey: string
}
