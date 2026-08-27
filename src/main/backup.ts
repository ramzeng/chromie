import { readFile, stat, writeFile } from 'node:fs/promises'

import {
  BrowserWindow,
  dialog,
  type OpenDialogOptions,
  type SaveDialogOptions,
  type WebContents
} from 'electron'

import type { BackupExportResult, BackupImportResult } from '../shared/backup'

const MAX_BACKUP_SIZE = 10 * 1024 * 1024

function ownerWindow(webContents: WebContents): BrowserWindow | null {
  return BrowserWindow.fromWebContents(webContents)
}

function defaultBackupName(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `Chromie-account-${year}-${month}-${day}.json`
}

export async function exportBackup(
  webContents: WebContents,
  content: unknown
): Promise<BackupExportResult> {
  if (typeof content !== 'string' || !content || Buffer.byteLength(content) > MAX_BACKUP_SIZE) {
    throw new Error('备份数据无效或文件过大')
  }

  const options: SaveDialogOptions = {
    title: '导出账户',
    defaultPath: defaultBackupName(),
    filters: [{ name: 'Chromie 账户', extensions: ['json'] }]
  }
  const owner = ownerWindow(webContents)
  const result = owner
    ? await dialog.showSaveDialog(owner, options)
    : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return { canceled: true }

  await writeFile(result.filePath, content, 'utf8')
  return { canceled: false }
}

export async function importBackup(
  webContents: WebContents
): Promise<BackupImportResult> {
  const options: OpenDialogOptions = {
    title: '导入账户',
    filters: [{ name: 'Chromie 账户', extensions: ['json'] }],
    properties: ['openFile']
  }
  const owner = ownerWindow(webContents)
  const result = owner
    ? await dialog.showOpenDialog(owner, options)
    : await dialog.showOpenDialog(options)
  const filePath = result.filePaths[0]
  if (result.canceled || !filePath) return { canceled: true }

  const fileStat = await stat(filePath)
  if (!fileStat.isFile() || fileStat.size > MAX_BACKUP_SIZE) {
    throw new Error('备份文件无效或超过 10 MB')
  }
  return {
    canceled: false,
    content: await readFile(filePath, 'utf8')
  }
}
