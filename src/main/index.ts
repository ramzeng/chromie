import { join } from 'node:path'

import { app, BrowserWindow, nativeImage, nativeTheme, shell } from 'electron'

import { exportBackup, importBackup } from './infra/backup'
import { syncBinancePositions } from './infra/binance'
import { fetchExchangeRates } from './infra/exchange-rates'
import { PlainTextFileStore, SecureFileStore } from './infra/file-store'
import { syncFutuPositions } from './infra/futu'
import { syncIbkrPositions } from './infra/ibkr'
import { syncHstongPositions } from './infra/hstong'
import { syncOkxPositions } from './infra/okx'
import { FileExchangeRateRepository } from './repository/exchange-rate-repository'
import { SecureIntegrationRepository } from './repository/integration-repository'
import { FileMcpSettingsRepository } from './repository/mcp-settings-repository'
import { SecurePortfolioRepository } from './repository/portfolio-repository'
import { DesktopService } from './service/desktop-service'
import { ExchangeRateService } from './service/exchange-rate-service'
import { McpSettingsService } from './service/mcp-settings-service'
import { PortfolioModule } from './service/portfolio-module'
import { PortfolioService } from './service/portfolio-service'
import { registerDesktopIpc } from './transport/electron-ipc'
import { McpSocketHost, type McpHostOperations } from './transport/mcp-socket'

app.setName('Chromie')

const mcpMode = process.argv.includes('--mcp')
const userDataPath = app.getPath('userData')
const mcpSocketPath = join(userDataPath, 'mcp.sock')
const mcpTokenPath = join(userDataPath, 'mcp-token')

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
    backgroundColor: '#0a0a0a',
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

  window.on('ready-to-show', () => {
    window.maximize()
    window.show()
  })

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

function setDevelopmentAppIcon(): void {
  if (process.platform !== 'darwin' || app.isPackaged) return

  const icon = nativeImage.createFromPath(
    join(__dirname, '../../resources/chromie-app-icon-knot.png')
  )
  if (!icon.isEmpty()) app.dock?.setIcon(icon)
}

async function startApplication(): Promise<void> {
  const portfolioRepository = new SecurePortfolioRepository(
    new SecureFileStore(join(userDataPath, 'portfolio.secure'))
  )
  const integrationRepository = new SecureIntegrationRepository(
    new SecureFileStore(join(userDataPath, 'integrations.secure'))
  )
  const exchangeRateRepository = new FileExchangeRateRepository(
    new PlainTextFileStore(join(userDataPath, 'exchange-rates.json'))
  )
  const mcpSettingsRepository = new FileMcpSettingsRepository(
    new PlainTextFileStore(join(userDataPath, 'mcp-settings.json'))
  )
  const portfolioService = new PortfolioService(
    portfolioRepository,
    integrationRepository
  )
  const exchangeRateService = new ExchangeRateService(exchangeRateRepository)
  const desktopService = new DesktopService({
    syncFutuPositions,
    syncOkxPositions,
    syncBinancePositions,
    syncIbkrPositions,
    syncHstongPositions,
    fetchExchangeRates: (provider) =>
      exchangeRateService.refresh(provider, { fetch: fetchExchangeRates }),
    loadExchangeRates: (legacyContent) => exchangeRateService.load(legacyContent),
    exportBackup,
    importBackup
  })
  const portfolioModule = new PortfolioModule(portfolioService, desktopService)
  const mcpSettingsService = new McpSettingsService(mcpSettingsRepository)
  const mcpHost = new McpSocketHost(
    portfolioModule,
    mcpSettingsService,
    {
      socketPath: mcpSocketPath,
      tokenPath: mcpTokenPath,
      command: process.execPath,
      args: app.isPackaged ? ['--mcp'] : [app.getAppPath(), '--mcp']
    }
  )
  await mcpHost.initialize()
  activeMcpHost = mcpHost

  registerDesktopIpc(
    desktopService,
    portfolioModule,
    mcpHost,
    (sender) => trustedWebContentsIds.has(sender.id)
  )
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}

let activeMcpHost: McpHostOperations | null = null

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark'
  if (mcpMode) {
    void import('./mcp-server').then(({ runChromieMcpServer }) => {
      runChromieMcpServer({
        socketPath: mcpSocketPath,
        tokenPath: mcpTokenPath,
        onClosed: () => app.quit()
      })
    })
    return
  }
  setDevelopmentAppIcon()
  void startApplication()
})

app.on('window-all-closed', () => {
  if (!mcpMode && process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  void activeMcpHost?.close()
})
