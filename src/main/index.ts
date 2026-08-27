import { join } from 'node:path'

import { app, BrowserWindow, ipcMain, shell } from 'electron'

import { exportBackup, importBackup } from './backup'
import { fetchExchangeRates } from './exchange-rates'
import { syncFutuPositions } from './futu'
import type { FutuSyncOptions } from '../shared/futu'
import { saveShareImage } from './share-image'
import { syncOkxPositions } from './okx'
import type { OkxSyncOptions } from '../shared/okx'

app.setName('Chromie')

ipcMain.handle('futu:sync-positions', (_event, options?: FutuSyncOptions) =>
  syncFutuPositions(options)
)
ipcMain.handle('okx:sync-positions', (_event, options?: OkxSyncOptions) =>
  syncOkxPositions(options)
)
ipcMain.handle('exchange-rates:fetch', () => fetchExchangeRates())
ipcMain.handle('backup:export', (event, content: unknown) =>
  exportBackup(event.sender, content)
)
ipcMain.handle('backup:import', (event) => importBackup(event.sender))
ipcMain.handle(
  'share-image:save',
  (event, dataUrl: unknown, accountName: unknown) =>
    saveShareImage(event.sender, dataUrl, accountName)
)

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'Chromie',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f7f7f5',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  window.on('ready-to-show', () => window.show())

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
