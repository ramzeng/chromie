import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  migrateDataFiles,
  resolveStoragePath,
  StorageLocationService
} from '../src/main/infra/storage-location'

class MemoryStore {
  constructor(private content: string | null) {}

  read(): Promise<string | null> {
    return Promise.resolve(this.content)
  }

  write(content: string): Promise<void> {
    this.content = content
    return Promise.resolve()
  }
}

class FailingStore extends MemoryStore {
  write(): Promise<void> {
    return Promise.reject(new Error('settings write failed'))
  }
}

test('storage location settings accept only absolute versioned paths', async () => {
  const fallback = '/Users/example/.chromie'

  assert.equal(await resolveStoragePath(new MemoryStore(null), fallback), fallback)
  assert.equal(
    await resolveStoragePath(
      new MemoryStore(JSON.stringify({ version: 1, path: '../relative' })),
      fallback
    ),
    fallback
  )
  assert.equal(
    await resolveStoragePath(
      new MemoryStore(JSON.stringify({ version: 1, path: '/Volumes/Data/Chromie' })),
      fallback
    ),
    '/Volumes/Data/Chromie'
  )
})

test('changing storage locations copies Chromie data without unrelated files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'chromie-storage-'))
  const currentPath = join(root, 'current')
  const nextPath = join(root, 'next')
  try {
    await mkdir(currentPath)
    await writeFile(join(currentPath, 'portfolio.json'), '{"version":1}', 'utf8')
    await writeFile(join(currentPath, 'notes.txt'), 'keep here', 'utf8')

    await migrateDataFiles(currentPath, nextPath)

    assert.equal(await readFile(join(nextPath, 'portfolio.json'), 'utf8'), '{"version":1}')
    await assert.rejects(readFile(join(nextPath, 'notes.txt'), 'utf8'), { code: 'ENOENT' })
    await assert.rejects(
      migrateDataFiles(currentPath, nextPath),
      /所选目录中已有 Chromie 数据/
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('manual storage paths expand home, verify writes and persist on save', async () => {
  const root = await mkdtemp(join(tmpdir(), 'chromie-storage-input-'))
  const currentPath = join(root, 'current')
  const settings = new MemoryStore(null)
  try {
    await mkdir(currentPath)
    await writeFile(join(currentPath, 'portfolio.json'), '{"version":1}', 'utf8')
    const storage = new StorageLocationService(
      currentPath,
      join(root, '.chromie'),
      settings
    )

    const validated = await storage.validateLocation('~/next')
    const updated = await storage.updateLocation('~/next')

    assert.equal(validated.path, join(root, 'next'))
    assert.equal(updated.changed, true)
    assert.equal(updated.location.path, join(root, 'next'))
    assert.equal(
      await readFile(join(root, 'next', 'portfolio.json'), 'utf8'),
      '{"version":1}'
    )
    assert.deepEqual(JSON.parse((await settings.read())!), {
      version: 1,
      path: join(root, 'next')
    })
    await assert.rejects(storage.validateLocation('../relative'), /请输入绝对路径/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a failed settings write rolls back copied storage files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'chromie-storage-rollback-'))
  const currentPath = join(root, 'current')
  const nextPath = join(root, 'next')
  try {
    await mkdir(currentPath)
    await writeFile(join(currentPath, 'portfolio-state.json'), '{"version":1}', 'utf8')
    const storage = new StorageLocationService(
      currentPath,
      join(root, '.chromie'),
      new FailingStore(null)
    )

    await assert.rejects(storage.updateLocation(nextPath), /settings write failed/)
    await assert.rejects(readFile(join(nextPath, 'portfolio-state.json')), {
      code: 'ENOENT'
    })
    assert.equal(
      await readFile(join(currentPath, 'portfolio-state.json'), 'utf8'),
      '{"version":1}'
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
