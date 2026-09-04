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

export const PROXY_PROTOCOLS = ['http', 'https', 'socks5', 'socks5h'] as const

export type ProxyProtocol = (typeof PROXY_PROTOCOLS)[number]

export type ProxyProfile = {
  id: string
  name: string
  protocol: ProxyProtocol
  host: string
  port: number
  username?: string
  password?: string
}

export type CredentialUpdate<T> =
  | { mode: 'keep' }
  | { mode: 'replace'; value: T }

export type OptionalCredentialUpdate<T> =
  | CredentialUpdate<T>
  | { mode: 'clear' }

export type ProxyProfileInput = Omit<ProxyProfile, 'id' | 'username' | 'password'> & {
  credential: OptionalCredentialUpdate<{
    username: string
    password: string
  }>
}

export type ProxyProfileView = Omit<ProxyProfile, 'password'> & {
  credentialConfigured: boolean
}

export type ProxyTestTarget = 'okx' | 'binance'

export type ProxyTestResult = {
  target: ProxyTestTarget
  latencyMs: number
}

export type AccountNetworkRoute =
  | { mode: 'system' }
  | { mode: 'direct' }
  | { mode: 'proxy'; proxyProfileId: string }

export type OkxIntegration = {
  accountId: string
  provider: 'Okx'
  api: {
    apiKey: string
    secretKey: string
    passphrase: string
  }
  network: AccountNetworkRoute
}

export type BinanceIntegration = {
  accountId: string
  provider: 'Binance'
  api: {
    apiKey: string
    secretKey: string
  }
  network: AccountNetworkRoute
}

export type AccountIntegration =
  | FutuIntegration
  | IbkrIntegration
  | HstongIntegration
  | OkxIntegration
  | BinanceIntegration

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
      network?: AccountNetworkRoute
    }
  | {
      provider: 'Binance'
      api: {
        credential: CredentialUpdate<{
          apiKey: string
          secretKey: string
        }>
      }
      network?: AccountNetworkRoute
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
      network: AccountNetworkRoute
    }
  | {
      accountId: string
      provider: 'Binance'
      credentialConfigured: true
      network: AccountNetworkRoute
    }

export type IntegrationData = {
  version: 1
  integrations: AccountIntegration[]
  proxyProfiles: ProxyProfile[]
}

export const EMPTY_INTEGRATION_DATA: IntegrationData = {
  version: 1,
  integrations: [],
  proxyProfiles: []
}

export const DEFAULT_ACCOUNT_NETWORK_ROUTE: AccountNetworkRoute = { mode: 'system' }

export const proxyProtocolLabels: Record<ProxyProtocol, string> = {
  http: 'HTTP',
  https: 'HTTPS',
  socks5: 'SOCKS5',
  socks5h: 'SOCKS5H'
}
