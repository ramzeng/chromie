import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { access, copyFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, normalize, parse } from 'node:path'

import type {
  StorageLocation,
  StorageLocationChangeResult
} from '../../shared/storage'
import type { StringStore } from './file-store'

const DATA_FILE_NAMES = [
  'portfolio-state.json',
  'portfolio.json',
  'integrations.json',
  'exchange-rates.json',
  'mcp-settings.json'
] as const

type StoredStorageLocation = {
  version: 1
  path: string
}

function normalizedAbsolutePath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim() || !isAbsolute(value.trim())) {
    return null
  }
  return normalize(value.trim())
}

function normalizedRequestedPath(value: unknown, homePath: string): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const trimmed = value.trim()
  const expanded =
    trimmed === '~'
      ? homePath
      : trimmed.startsWith('~/')
        ? join(homePath, trimmed.slice(2))
        : trimmed
  return normalizedAbsolutePath(expanded)
}

export async function resolveStoragePath(
  settings: StringStore,
  defaultPath: string
): Promise<string> {
  const fallback = normalize(defaultPath)
  try {
    const content = await settings.read()
    if (!content) return fallback
    const stored = JSON.parse(content) as Partial<StoredStorageLocation>
    return stored.version === 1
      ? normalizedAbsolutePath(stored.path) ?? fallback
      : fallback
  } catch {
    return fallback
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

export async function migrateDataFiles(
  currentPath: string,
  nextPath: string
): Promise<string[]> {
  await mkdir(nextPath, { recursive: true, mode: 0o700 })
  const targetFiles = DATA_FILE_NAMES.map((name) => join(nextPath, name))
  if ((await Promise.all(targetFiles.map(fileExists))).some(Boolean)) {
    throw new Error('所选目录中已有 Chromie 数据，请选择一个空目录')
  }

  const copiedFiles: string[] = []
  try {
    for (const name of DATA_FILE_NAMES) {
      const source = join(currentPath, name)
      if (!(await fileExists(source))) continue
      const target = join(nextPath, name)
      await copyFile(source, target, constants.COPYFILE_EXCL)
      copiedFiles.push(target)
    }
  } catch (error) {
    await Promise.all(copiedFiles.map((path) => rm(path, { force: true })))
    throw error
  }
  return copiedFiles
}

async function assertWritableDirectory(path: string): Promise<void> {
  const probePath = join(
    path,
    `.chromie-write-test-${process.pid}-${randomUUID()}.tmp`
  )
  try {
    await mkdir(path, { recursive: true, mode: 0o700 })
    await access(path, constants.W_OK)
    await writeFile(probePath, '', { flag: 'wx', mode: 0o600 })
    await rm(probePath)
  } catch (error) {
    await rm(probePath, { force: true }).catch(() => undefined)
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`数据存储位置不可写：${reason}`)
  }
}

export interface StorageLocationOperations {
  getLocation(): StorageLocation
  validateLocation(path: unknown): Promise<StorageLocation>
  updateLocation(path: unknown): Promise<StorageLocationChangeResult>
}

export class StorageLocationService implements StorageLocationOperations {
  constructor(
    private readonly currentPath: string,
    private readonly defaultPath: string,
    private readonly settings: StringStore
  ) {}

  getLocation(): StorageLocation {
    return {
      path: this.currentPath,
      isDefault: this.currentPath === normalize(this.defaultPath)
    }
  }

  async validateLocation(path: unknown): Promise<StorageLocation> {
    const selectedPath = normalizedRequestedPath(path, dirname(this.defaultPath))
    if (!selectedPath) {
      throw new Error('请输入绝对路径，或使用 ~/ 开头的路径')
    }
    if (selectedPath === parse(selectedPath).root) {
      throw new Error('不能将磁盘根目录作为 Chromie 数据存储位置')
    }
    await assertWritableDirectory(selectedPath)
    return {
      path: selectedPath,
      isDefault: selectedPath === normalize(this.defaultPath)
    }
  }

  async updateLocation(path: unknown): Promise<StorageLocationChangeResult> {
    const location = await this.validateLocation(path)
    const selectedPath = location.path
    if (selectedPath === this.currentPath) {
      return { changed: false, location: this.getLocation() }
    }

    const copiedFiles = await migrateDataFiles(this.currentPath, selectedPath)
    try {
      await this.settings.write(
        JSON.stringify({ version: 1, path: selectedPath }, null, 2)
      )
    } catch (error) {
      await Promise.all(copiedFiles.map((file) => rm(file, { force: true })))
      throw error
    }
    return {
      changed: true,
      location
    }
  }
}
