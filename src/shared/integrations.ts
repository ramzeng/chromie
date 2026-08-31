export type FutuIntegration = {
  assetAccountId: string
  provider: 'Futu'
  websocket: {
    host: string
    port: number
    key?: string
  }
}

export type IbkrIntegration = {
  assetAccountId: string
  provider: 'Ibkr'
  gateway: {
    host: string
    port: number
  }
}

export type OkxIntegration = {
  assetAccountId: string
  provider: 'Okx'
  api: {
    apiKey: string
    secretKey: string
    passphrase: string
  }
}

export type BinanceIntegration = {
  assetAccountId: string
  provider: 'Binance'
  api: {
    apiKey: string
    secretKey: string
  }
}

export type AssetAccountIntegration =
  | FutuIntegration
  | IbkrIntegration
  | OkxIntegration
  | BinanceIntegration

export type AssetAccountIntegrationInput =
  | Omit<FutuIntegration, 'assetAccountId'>
  | Omit<IbkrIntegration, 'assetAccountId'>
  | Omit<OkxIntegration, 'assetAccountId'>
  | Omit<BinanceIntegration, 'assetAccountId'>

export type IntegrationData = {
  version: 1
  integrations: AssetAccountIntegration[]
}

export const EMPTY_INTEGRATION_DATA: IntegrationData = {
  version: 1,
  integrations: []
}
