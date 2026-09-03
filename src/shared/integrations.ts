export type FutuIntegration = {
  accountId: string
  provider: 'Futu'
  websocket: {
    host: string
    port: number
    key?: string
  }
}

export type IbkrIntegration = {
  accountId: string
  provider: 'Ibkr'
  gateway: {
    host: string
    port: number
  }
}

export type HstongIntegration = {
  accountId: string
  provider: 'Hstong'
  gateway: {
    host: string
    port: number
    tradingPassword?: string
  }
}

export type OkxIntegration = {
  accountId: string
  provider: 'Okx'
  api: {
    apiKey: string
    secretKey: string
    passphrase: string
  }
}

export type BinanceIntegration = {
  accountId: string
  provider: 'Binance'
  api: {
    apiKey: string
    secretKey: string
  }
}

export type AccountIntegration =
  | FutuIntegration
  | IbkrIntegration
  | HstongIntegration
  | OkxIntegration
  | BinanceIntegration

export type CredentialUpdate<T> =
  | { mode: 'keep' }
  | { mode: 'replace'; value: T }

export type OptionalCredentialUpdate<T> =
  | CredentialUpdate<T>
  | { mode: 'clear' }

export type AccountIntegrationInput =
  | {
      provider: 'Futu'
      websocket: {
        host: string
        port: number
        credential: OptionalCredentialUpdate<{ key: string }>
      }
    }
  | Omit<IbkrIntegration, 'accountId'>
  | {
      provider: 'Hstong'
      gateway: {
        host: string
        port: number
        credential: OptionalCredentialUpdate<{ tradingPassword: string }>
      }
    }
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

export type AccountIntegrationView =
  | {
      accountId: string
      provider: 'Futu'
      websocket: {
        host: string
        port: number
        credentialConfigured: boolean
      }
    }
  | {
      accountId: string
      provider: 'Ibkr'
      gateway: {
        host: string
        port: number
      }
    }
  | {
      accountId: string
      provider: 'Hstong'
      gateway: {
        host: string
        port: number
        credentialConfigured: boolean
      }
    }
  | {
      accountId: string
      provider: 'Okx'
      credentialConfigured: true
    }
  | {
      accountId: string
      provider: 'Binance'
      credentialConfigured: true
    }

export type IntegrationData = {
  version: 1
  integrations: AccountIntegration[]
}

export const EMPTY_INTEGRATION_DATA: IntegrationData = {
  version: 1,
  integrations: []
}
