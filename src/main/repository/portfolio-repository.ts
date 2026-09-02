import type { StringStore } from '../infra/file-store'

export interface PortfolioRepository {
  load(): Promise<string | null>
  save(content: string): Promise<void>
}

export class FilePortfolioRepository implements PortfolioRepository {
  constructor(private readonly storage: StringStore) {}

  load(): Promise<string | null> {
    return this.storage.read()
  }

  save(content: string): Promise<void> {
    return this.storage.write(content)
  }
}
