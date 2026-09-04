import type {
  AccountIntegration,
  AccountIntegrationView,
  ProxyProfile,
  ProxyProfileView
} from '../../shared/integrations'
import type {
  PortfolioClientCommandResponse,
  PortfolioClientLoadResponse,
  PortfolioCommand,
  PortfolioCommandResponse,
  PortfolioLoadResponse
} from '../../shared/portfolio'
import type { PortfolioOperations } from '../service/portfolio-service'

type ClientPortfolioOperations = Pick<PortfolioOperations, 'execute' | 'load'>

export function toAccountIntegrationView(
  integration: AccountIntegration
): AccountIntegrationView {
  if (integration.provider === 'Futu') {
    return {
      accountId: integration.accountId,
      provider: 'Futu',
      websocket: {
        host: integration.websocket.host,
        port: integration.websocket.port,
        credentialConfigured: Boolean(integration.websocket.key)
      }
    }
  }
  if (integration.provider === 'Ibkr') {
    return {
      accountId: integration.accountId,
      provider: 'Ibkr',
      gateway: { ...integration.gateway }
    }
  }
  if (integration.provider === 'Hstong') {
    return {
      accountId: integration.accountId,
      provider: 'Hstong',
      gateway: {
        host: integration.gateway.host,
        port: integration.gateway.port,
        credentialConfigured: Boolean(integration.gateway.tradingPassword)
      }
    }
  }
  return {
    accountId: integration.accountId,
    provider: integration.provider,
    credentialConfigured: true,
    network: structuredClone(integration.network)
  }
}

export function toProxyProfileView(profile: ProxyProfile): ProxyProfileView {
  const { password: _password, ...view } = profile
  return {
    ...view,
    credentialConfigured: Boolean(profile.username && profile.password)
  }
}

function redactIntegrations(
  integrations: AccountIntegration[]
): AccountIntegrationView[] {
  return integrations.map(toAccountIntegrationView)
}

function toClientLoadResponse(
  response: PortfolioLoadResponse
): PortfolioClientLoadResponse {
  return {
    data: response.data,
    integrations: redactIntegrations(response.integrations),
    proxyProfiles: response.proxyProfiles.map(toProxyProfileView)
  }
}

function toClientCommandResponse(
  response: PortfolioCommandResponse
): PortfolioClientCommandResponse {
  return {
    data: response.data,
    integrations: redactIntegrations(response.integrations),
    proxyProfiles: response.proxyProfiles.map(toProxyProfileView),
    ...(response.result === undefined ? {} : { result: response.result })
  }
}

export async function loadPortfolioClientState(
  portfolio: ClientPortfolioOperations
): Promise<PortfolioClientLoadResponse> {
  return toClientLoadResponse(await portfolio.load())
}

export async function executePortfolioClientCommand(
  portfolio: ClientPortfolioOperations,
  command: PortfolioCommand
): Promise<PortfolioClientCommandResponse> {
  return toClientCommandResponse(await portfolio.execute(command))
}
