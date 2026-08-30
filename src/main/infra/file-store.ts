import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import { safeStorage } from 'electron'

export interface StringStore {
  read(): Promise<string | null>
  write(content: string): Promise<void>
}

async function readOptionalFile(path: string): Promise<Buffer | null> {
  try {
    return await readFile(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function atomicWrite(path: string, content: Uint8Array | string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`
  try {
    await writeFile(temporaryPath, content, { mode: 0o600 })
    await rename(temporaryPath, path)
  } catch (error) {
    await rm(temporaryPath, { force: true })
    throw error
  }
}

export class PlainTextFileStore implements StringStore {
  constructor(private readonly path: string) {}

  async read(): Promise<string | null> {
    const content = await readOptionalFile(this.path)
    return content?.toString('utf8') ?? null
  }

  async write(content: string): Promise<void> {
    await atomicWrite(this.path, content)
  }
}

export class SecureFileStore implements StringStore {
  constructor(private readonly path: string) {}

  async read(): Promise<string | null> {
    const encrypted = await readOptionalFile(this.path)
    if (!encrypted) return null
    if (!(await safeStorage.isAsyncEncryptionAvailable())) {
      throw new Error('系统安全存储当前不可用，无法读取资产数据')
    }
    const decrypted = await safeStorage.decryptStringAsync(encrypted)
    if (decrypted.shouldReEncrypt) await this.write(decrypted.result)
    return decrypted.result
  }

  async write(content: string): Promise<void> {
    if (!(await safeStorage.isAsyncEncryptionAvailable())) {
      throw new Error('系统安全存储当前不可用，无法保存资产数据')
    }
    await atomicWrite(this.path, await safeStorage.encryptStringAsync(content))
  }
}
