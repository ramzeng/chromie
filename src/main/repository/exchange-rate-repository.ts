import type { StringStore } from '../infra/file-store'

export interface ExchangeRateRepository {
  load(): Promise<string | null>
  save(content: string): Promise<void>
}

export class FileExchangeRateRepository implements ExchangeRateRepository {
  constructor(private readonly storage: StringStore) {}

  load(): Promise<string | null> {
    return this.storage.read()
  }

  save(content: string): Promise<void> {
    return this.storage.write(content)
  }
}
