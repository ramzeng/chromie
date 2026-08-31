import type { StringStore } from '../infra/file-store'

export interface McpSettingsRepository {
  load(): Promise<string | null>
  save(content: string): Promise<void>
}

export class FileMcpSettingsRepository implements McpSettingsRepository {
  constructor(private readonly storage: StringStore) {}

  load(): Promise<string | null> {
    return this.storage.read()
  }

  save(content: string): Promise<void> {
    return this.storage.write(content)
  }
}
