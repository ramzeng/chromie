import assert from 'node:assert/strict'
import test from 'node:test'

import { DEFAULT_MCP_ACCESS_SETTINGS } from '../src/shared/mcp'
import { McpSettingsService } from '../src/main/service/mcp-settings-service'

class MemorySettingsRepository {
  content: string | null = null

  load(): Promise<string | null> {
    return Promise.resolve(this.content)
  }

  save(content: string): Promise<void> {
    this.content = content
    return Promise.resolve()
  }
}

test('MCP settings default to disabled and normalize dependent permissions', async () => {
  const repository = new MemorySettingsRepository()
  const service = new McpSettingsService(repository)

  assert.deepEqual(await service.load(), DEFAULT_MCP_ACCESS_SETTINGS)
  assert.deepEqual(
    await service.save({
      enabled: true,
      allowWrite: false,
      allowSync: true,
      allowDelete: true
    }),
    {
      enabled: true,
      allowWrite: false,
      allowSync: false,
      allowDelete: false
    }
  )
  assert.deepEqual(
    await service.save({
      enabled: false,
      allowWrite: true,
      allowSync: true,
      allowDelete: true
    }),
    DEFAULT_MCP_ACCESS_SETTINGS
  )
})

test('malformed MCP settings fail closed', async () => {
  const repository = new MemorySettingsRepository()
  repository.content = '{invalid json'
  const service = new McpSettingsService(repository)

  assert.deepEqual(await service.load(), DEFAULT_MCP_ACCESS_SETTINGS)
})
