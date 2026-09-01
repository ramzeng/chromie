import {
  DEFAULT_MCP_ACCESS_SETTINGS,
  type McpAccessSettings
} from '../../shared/mcp'
import type { McpSettingsRepository } from '../repository/mcp-settings-repository'

export interface McpSettingsOperations {
  load(): Promise<McpAccessSettings>
  save(settings: McpAccessSettings): Promise<McpAccessSettings>
}

function normalizeSettings(value: unknown): McpAccessSettings {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_MCP_ACCESS_SETTINGS }
  }
  const input = value as Partial<McpAccessSettings>
  const enabled = input.enabled === true
  const allowWrite = enabled && input.allowWrite === true
  return {
    enabled,
    allowWrite
  }
}

export class McpSettingsService implements McpSettingsOperations {
  constructor(private readonly repository: McpSettingsRepository) {}

  async load(): Promise<McpAccessSettings> {
    try {
      const content = await this.repository.load()
      return content
        ? normalizeSettings(JSON.parse(content))
        : { ...DEFAULT_MCP_ACCESS_SETTINGS }
    } catch {
      return { ...DEFAULT_MCP_ACCESS_SETTINGS }
    }
  }

  async save(settings: McpAccessSettings): Promise<McpAccessSettings> {
    const normalized = normalizeSettings(settings)
    await this.repository.save(JSON.stringify(normalized))
    return normalized
  }
}
