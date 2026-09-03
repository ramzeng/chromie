import type { StringStore } from '../infra/file-store'
import type { IntegrationRepository } from './integration-repository'
import type { PortfolioRepository } from './portfolio-repository'

const PORTFOLIO_STATE_FORMAT = 'chromie-portfolio-state'
const PORTFOLIO_STATE_VERSION = 1

export type PortfolioStateContents = {
  portfolio: string | null
  integrations: string | null
  source: 'state' | 'legacy'
}

export interface PortfolioStateRepository {
  load(): Promise<PortfolioStateContents>
  save(portfolio: string, integrations: string): Promise<void>
}

type StoredPortfolioState = {
  format: typeof PORTFOLIO_STATE_FORMAT
  version: typeof PORTFOLIO_STATE_VERSION
  portfolio: unknown
  integrations: unknown
}

function parseStoredState(content: string): StoredPortfolioState {
  let value: unknown
  try {
    value = JSON.parse(content)
  } catch {
    throw new Error('资产状态文件损坏：无法解析 JSON')
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('资产状态文件损坏：文件结构无效')
  }
  const state = value as Partial<StoredPortfolioState>
  if (
    state.format !== PORTFOLIO_STATE_FORMAT ||
    state.version !== PORTFOLIO_STATE_VERSION ||
    !state.portfolio ||
    typeof state.portfolio !== 'object' ||
    Array.isArray(state.portfolio) ||
    !state.integrations ||
    typeof state.integrations !== 'object' ||
    Array.isArray(state.integrations)
  ) {
    throw new Error('资产状态文件损坏：文件格式或版本无效')
  }
  return state as StoredPortfolioState
}

export class FilePortfolioStateRepository implements PortfolioStateRepository {
  constructor(
    private readonly stateStore: StringStore,
    private readonly legacyPortfolioRepository: PortfolioRepository,
    private readonly legacyIntegrationRepository: IntegrationRepository
  ) {}

  async load(): Promise<PortfolioStateContents> {
    const storedState = await this.stateStore.read()
    if (storedState !== null) {
      const state = parseStoredState(storedState)
      return {
        portfolio: JSON.stringify(state.portfolio),
        integrations: JSON.stringify(state.integrations),
        source: 'state'
      }
    }

    const [portfolio, integrations] = await Promise.all([
      this.legacyPortfolioRepository.load(),
      this.legacyIntegrationRepository.load()
    ])
    return { portfolio, integrations, source: 'legacy' }
  }

  async save(portfolio: string, integrations: string): Promise<void> {
    const state: StoredPortfolioState = {
      format: PORTFOLIO_STATE_FORMAT,
      version: PORTFOLIO_STATE_VERSION,
      portfolio: JSON.parse(portfolio) as unknown,
      integrations: JSON.parse(integrations) as unknown
    }
    await this.stateStore.write(JSON.stringify(state))
  }
}

export class LegacyPortfolioStateRepository implements PortfolioStateRepository {
  constructor(
    private readonly portfolioRepository: PortfolioRepository,
    private readonly integrationRepository: IntegrationRepository
  ) {}

  async load(): Promise<PortfolioStateContents> {
    const [portfolio, integrations] = await Promise.all([
      this.portfolioRepository.load(),
      this.integrationRepository.load()
    ])
    return { portfolio, integrations, source: 'legacy' }
  }

  async save(portfolio: string, integrations: string): Promise<void> {
    await this.portfolioRepository.save(portfolio)
    await this.integrationRepository.save(integrations)
  }
}
