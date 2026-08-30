import { join } from 'node:path'

import { app, BrowserWindow, shell } from 'electron'

import { exportBackup, importBackup } from './infra/backup'
import { syncBinancePositions } from './infra/binance'
import { fetchExchangeRates } from './infra/exchange-rates'
import { PlainTextFileStore, SecureFileStore } from './infra/file-store'
import { syncFutuPositions } from './infra/futu'
import { syncIbkrPositions } from './infra/ibkr'
import { syncOkxPositions } from './infra/okx'
import { saveShareImage } from './infra/share-image'
import { FileExchangeRateRepository } from './repository/exchange-rate-repository'
import { SecurePortfolioRepository } from './repository/portfolio-repository'
import { DesktopService } from './service/desktop-service'
import { ExchangeRateService } from './service/exchange-rate-service'
import { PortfolioService } from './service/portfolio-service'
import { registerDesktopIpc } from './transport/electron-ipc'

app.setName('Chromie')

const trustedWebContentsIds = new Set<number>()

function isSafeExternalUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

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
  const webContentsId = window.webContents.id
  trustedWebContentsIds.add(webContentsId)
  window.webContents.once('destroyed', () => {
    trustedWebContentsIds.delete(webContentsId)
  })

  window.on('ready-to-show', () => window.show())

  window.webContents.on('will-navigate', (event) => event.preventDefault())

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  const portfolioRepository = new SecurePortfolioRepository(
    new SecureFileStore(join(app.getPath('userData'), 'portfolio.secure'))
  )
  const exchangeRateRepository = new FileExchangeRateRepository(
    new PlainTextFileStore(join(app.getPath('userData'), 'exchange-rates.json'))
  )
  const portfolioService = new PortfolioService(portfolioRepository)
  const exchangeRateService = new ExchangeRateService(exchangeRateRepository)
  const desktopService = new DesktopService({
    syncFutuPositions,
    syncOkxPositions,
    syncBinancePositions,
    syncIbkrPositions,
    fetchExchangeRates: (provider) =>
      exchangeRateService.refresh(provider, { fetch: fetchExchangeRates }),
    loadExchangeRates: (legacyContent) => exchangeRateService.load(legacyContent),
    exportBackup,
    importBackup,
    saveShareImage
  })

  registerDesktopIpc(
    desktopService,
    portfolioService,
    (sender) => trustedWebContentsIds.has(sender.id)
  )
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
