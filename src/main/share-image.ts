import { writeFile } from 'node:fs/promises'

import {
  BrowserWindow,
  dialog,
  nativeImage,
  type SaveDialogOptions,
  type WebContents
} from 'electron'

import type { ShareImageSaveResult } from '../shared/share-image'

const MAX_IMAGE_DATA_URL_SIZE = 40 * 1024 * 1024
const PNG_DATA_URL_PREFIX = 'data:image/png;base64,'

function ownerWindow(webContents: WebContents): BrowserWindow | null {
  return BrowserWindow.fromWebContents(webContents)
}

function imageFromDataUrl(value: unknown): Electron.NativeImage {
  if (
    typeof value !== 'string' ||
    !value.startsWith(PNG_DATA_URL_PREFIX) ||
    value.length > MAX_IMAGE_DATA_URL_SIZE
  ) {
    throw new Error('分享图片数据无效或文件过大')
  }
  const image = nativeImage.createFromDataURL(value)
  if (image.isEmpty()) throw new Error('分享图片生成失败')
  return image
}

function defaultShareImageName(accountName: unknown): string {
  const safeAccountName =
    typeof accountName === 'string'
      ? accountName.trim().replace(/[\\/:*?"<>|]/g, '-').slice(0, 40)
      : ''
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `Chromie-${safeAccountName || 'portfolio'}-${year}-${month}-${day}.png`
}

export async function saveShareImage(
  webContents: WebContents,
  dataUrl: unknown,
  accountName: unknown
): Promise<ShareImageSaveResult> {
  const image = imageFromDataUrl(dataUrl)
  const options: SaveDialogOptions = {
    title: '保存分享图片',
    defaultPath: defaultShareImageName(accountName),
    filters: [{ name: 'PNG 图片', extensions: ['png'] }]
  }
  const owner = ownerWindow(webContents)
  const result = owner
    ? await dialog.showSaveDialog(owner, options)
    : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return { canceled: true }

  await writeFile(result.filePath, image.toPNG())
  return { canceled: false }
}
