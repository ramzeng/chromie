import type {
  AssetAccountIntegration,
  AssetAccountIntegrationView
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

export function toAssetAccountIntegrationView(
  integration: AssetAccountIntegration
): AssetAccountIntegrationView {
  if (integration.provider === 'Futu') {
    return {
      assetAccountId: integration.assetAccountId,
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
      assetAccountId: integration.assetAccountId,
      provider: 'Ibkr',
      gateway: { ...integration.gateway }
    }
  }
  if (integration.provider === 'Hstong') {
    return {
      assetAccountId: integration.assetAccountId,
      provider: 'Hstong',
      gateway: {
        host: integration.gateway.host,
        port: integration.gateway.port,
        credentialConfigured: Boolean(integration.gateway.tradingPassword)
      }
    }
  }
  return {
    assetAccountId: integration.assetAccountId,
    provider: integration.provider,
    credentialConfigured: true
  }
}

function redactIntegrations(
  integrations: AssetAccountIntegration[]
): AssetAccountIntegrationView[] {
  return integrations.map(toAssetAccountIntegrationView)
}

function toClientLoadResponse(
  response: PortfolioLoadResponse
): PortfolioClientLoadResponse {
  return {
    data: response.data,
    integrations: redactIntegrations(response.integrations)
  }
}

function toClientCommandResponse(
  response: PortfolioCommandResponse
): PortfolioClientCommandResponse {
  return {
    data: response.data,
    integrations: redactIntegrations(response.integrations),
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
