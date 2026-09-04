import { join } from 'node:path'

import { app, BrowserWindow, nativeImage, nativeTheme, net, session, shell } from 'electron'

import { exportBackup, importBackup } from './infra/backup'
import { syncBinancePositions } from './infra/binance'
import { fetchExchangeRates } from './infra/exchange-rates'
import {
  ensurePrivateDirectory,
  PlainTextFileStore
} from './infra/file-store'
import { syncFutuPositions } from './infra/futu'
import { syncIbkrPositions } from './infra/ibkr'
import { syncHstongPositions } from './infra/hstong'
import { syncOkxPositions } from './infra/okx'
import { fetchAssetQuote } from './infra/asset-quotes'
import { createProxyFetch, testProxyConnection } from './infra/proxy-http'
import {
  resolveStoragePath,
  StorageLocationService
} from './infra/storage-location'
import { FileExchangeRateRepository } from './repository/exchange-rate-repository'
import { FileIntegrationRepository } from './repository/integration-repository'
import { FileMcpSettingsRepository } from './repository/mcp-settings-repository'
import { FilePortfolioRepository } from './repository/portfolio-repository'
import { FilePortfolioStateRepository } from './repository/portfolio-state-repository'
import { DesktopService } from './service/desktop-service'
import { ExchangeRateService } from './service/exchange-rate-service'
import { McpSettingsService } from './service/mcp-settings-service'
import { PortfolioModule } from './service/portfolio-module'
import { PortfolioService } from './service/portfolio-service'
import { registerDesktopIpc } from './transport/electron-ipc'
import { McpSocketHost, type McpHostOperations } from './transport/mcp-socket'

app.setName('Chromie')

const mcpMode = process.argv.includes('--mcp')
const defaultDataPath = join(app.getPath('home'), '.chromie')
const storageSettingsPath = join(app.getPath('userData'), 'storage-location.json')

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

async function startApplication(
  dataPath: string,
  storageLocationService: StorageLocationService
): Promise<void> {
  const mcpSocketPath = join(dataPath, 'mcp.sock')
  const mcpTokenPath = join(dataPath, 'mcp-token')

  const portfolioRepository = new FilePortfolioRepository(
    new PlainTextFileStore(join(dataPath, 'portfolio.json'))
  )
  const integrationRepository = new FileIntegrationRepository(
    new PlainTextFileStore(join(dataPath, 'integrations.json'))
  )
  const portfolioStateRepository = new FilePortfolioStateRepository(
    new PlainTextFileStore(join(dataPath, 'portfolio-state.json')),
    portfolioRepository,
    integrationRepository
  )
  const exchangeRateRepository = new FileExchangeRateRepository(
    new PlainTextFileStore(join(dataPath, 'exchange-rates.json'))
  )
  const mcpSettingsRepository = new FileMcpSettingsRepository(
    new PlainTextFileStore(join(dataPath, 'mcp-settings.json'))
  )
  const portfolioService = new PortfolioService(portfolioStateRepository)
  const exchangeRateService = new ExchangeRateService(exchangeRateRepository)
  const directSession = session.fromPartition('chromie-direct', { cache: false })
  await directSession.setProxy({ mode: 'direct' })
  const desktopService = new DesktopService({
    syncFutuPositions,
    syncOkxPositions,
    syncBinancePositions,
    syncIbkrPositions,
    syncHstongPositions,
    fetchExchangeRates: (provider) =>
      exchangeRateService.refresh(provider, { fetch: fetchExchangeRates }),
    loadExchangeRates: (legacyContent) => exchangeRateService.load(legacyContent),
    lookupAssetQuote: (input) => fetchAssetQuote(input, net.fetch),
    exportBackup,
    importBackup,
    systemFetch: (input, init) => net.fetch(input.toString(), init),
    directFetch: (input, init) => directSession.fetch(input.toString(), init),
    createProxyFetch,
    testProxyConnection
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
  activeMcpHost = mcpHost
  try {
    await mcpHost.initialize()
  } catch (error) {
    console.error('MCP 服务初始化失败，桌面应用将继续启动', error)
  }

  registerDesktopIpc(
    desktopService,
    portfolioModule,
    mcpHost,
    storageLocationService,
    (sender) => trustedWebContentsIds.has(sender.id)
  )
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}

let activeMcpHost: McpHostOperations | null = null

app.whenReady().then(async () => {
  nativeTheme.themeSource = 'dark'
  const storageSettings = new PlainTextFileStore(storageSettingsPath)
  const dataPath = await resolveStoragePath(storageSettings, defaultDataPath)
  await ensurePrivateDirectory(dataPath, dataPath === defaultDataPath)
  const mcpSocketPath = join(dataPath, 'mcp.sock')
  const mcpTokenPath = join(dataPath, 'mcp-token')
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
  await startApplication(
    dataPath,
    new StorageLocationService(dataPath, defaultDataPath, storageSettings)
  )
}).catch((error) => {
  console.error('Chromie 启动失败', error)
  app.quit()
})

app.on('window-all-closed', () => {
  if (!mcpMode && process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  void activeMcpHost?.close()
})
