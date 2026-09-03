import { randomUUID } from 'node:crypto'
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

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
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`
  try {
    await writeFile(temporaryPath, content, { mode: 0o600 })
    await rename(temporaryPath, path)
  } catch (error) {
    await rm(temporaryPath, { force: true })
    throw error
  }
}

export async function ensurePrivateDirectory(
  path: string,
  enforcePermissions = true
): Promise<void> {
  await mkdir(path, { recursive: true, mode: 0o700 })
  if (enforcePermissions) await chmod(path, 0o700)
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
