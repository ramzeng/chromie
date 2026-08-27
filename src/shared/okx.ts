export type OkxSyncedPosition = {
  market: 'CC'
  symbol: string
  name: string
  currency: 'USD'
  quantity: number
  price?: number
}

export type OkxSyncResult = {
  positions: OkxSyncedPosition[]
  syncedAt: string
}

export type OkxSyncOptions = {
  apiKey: string
  secretKey: string
  passphrase: string
}
