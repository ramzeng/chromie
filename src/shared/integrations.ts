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

export type CredentialUpdate<T> =
  | { mode: 'keep' }
  | { mode: 'replace'; value: T }

export type OptionalCredentialUpdate<T> =
  | CredentialUpdate<T>
  | { mode: 'clear' }

export type AssetAccountIntegrationInput =
  | {
      provider: 'Futu'
      websocket: {
        host: string
        port: number
        credential: OptionalCredentialUpdate<{ key: string }>
      }
    }
  | Omit<IbkrIntegration, 'assetAccountId'>
  | {
      provider: 'Okx'
      api: {
        credential: CredentialUpdate<{
          apiKey: string
          secretKey: string
          passphrase: string
        }>
      }
    }
  | {
      provider: 'Binance'
      api: {
        credential: CredentialUpdate<{
          apiKey: string
          secretKey: string
        }>
      }
    }

export type AssetAccountIntegrationView =
  | {
      assetAccountId: string
      provider: 'Futu'
      websocket: {
        host: string
        port: number
        credentialConfigured: boolean
      }
    }
  | {
      assetAccountId: string
      provider: 'Ibkr'
      gateway: {
        host: string
        port: number
      }
    }
  | {
      assetAccountId: string
      provider: 'Okx'
      credentialConfigured: true
    }
  | {
      assetAccountId: string
      provider: 'Binance'
      credentialConfigured: true
    }

export type IntegrationData = {
  version: 1
  integrations: AssetAccountIntegration[]
}

export const EMPTY_INTEGRATION_DATA: IntegrationData = {
  version: 1,
  integrations: []
}
