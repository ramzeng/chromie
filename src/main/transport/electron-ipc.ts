import { ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron'

import type { BinanceSyncOptions } from '../../shared/binance'
import type { FutuSyncOptions } from '../../shared/futu'
import type { IbkrSyncOptions } from '../../shared/ibkr'
import type { HstongSyncOptions } from '../../shared/hstong'
import type { OkxSyncOptions } from '../../shared/okx'
import type { PortfolioCommand } from '../../shared/portfolio'
import type { McpAccessSettings } from '../../shared/mcp'
import type { DesktopOperations } from '../service/desktop-service'
import type { PortfolioModuleOperations } from '../service/portfolio-module'
import type { McpHostOperations } from './mcp-socket'
import {
  executePortfolioClientCommand,
  loadPortfolioClientState
} from './portfolio-client'

export type IpcSenderValidator = (sender: WebContents) => boolean

function assertTrustedSender(
  event: IpcMainInvokeEvent,
  validateSender: IpcSenderValidator
): void {
  if (
    !event.senderFrame ||
    event.senderFrame !== event.sender.mainFrame ||
    !validateSender(event.sender)
  ) {
    throw new Error('拒绝来自非受信窗口的请求')
  }
}

export function registerDesktopIpc(
  service: DesktopOperations,
  portfolio: PortfolioModuleOperations,
  mcp: McpHostOperations,
  validateSender: IpcSenderValidator
): void {
  const portfolioSubscribers = new Set<WebContents>()
  portfolio.subscribe(() => {
    portfolioSubscribers.forEach((sender) => {
      if (sender.isDestroyed()) {
        portfolioSubscribers.delete(sender)
        return
      }
      sender.send('portfolio:changed')
    })
  })
  ipcMain.handle('futu:sync-positions', (event, options?: FutuSyncOptions) => {
    assertTrustedSender(event, validateSender)
    return service.syncPositions({ provider: 'futu', options })
  })
  ipcMain.handle('okx:sync-positions', (event, options?: OkxSyncOptions) => {
    assertTrustedSender(event, validateSender)
    return service.syncPositions({ provider: 'okx', options })
  })
  ipcMain.handle('binance:sync-positions', (event, options?: BinanceSyncOptions) => {
    assertTrustedSender(event, validateSender)
    return service.syncPositions({ provider: 'binance', options })
  })
  ipcMain.handle('ibkr:sync-positions', (event, options?: IbkrSyncOptions) => {
    assertTrustedSender(event, validateSender)
    return service.syncPositions({ provider: 'ibkr', options })
  })
  ipcMain.handle('hstong:sync-positions', (event, options?: HstongSyncOptions) => {
    assertTrustedSender(event, validateSender)
    return service.syncPositions({ provider: 'hstong', options })
  })
  ipcMain.handle('exchange-rates:load', (event, legacyContent?: unknown) => {
    assertTrustedSender(event, validateSender)
    return service.loadExchangeRates(legacyContent)
  })
  ipcMain.handle('exchange-rates:fetch', (event, provider: unknown) => {
    assertTrustedSender(event, validateSender)
    return service.fetchExchangeRates(provider)
  })
  ipcMain.handle('portfolio:load', (event) => {
    assertTrustedSender(event, validateSender)
    if (!portfolioSubscribers.has(event.sender)) {
      portfolioSubscribers.add(event.sender)
      event.sender.once('destroyed', () => {
        portfolioSubscribers.delete(event.sender)
      })
    }
    return loadPortfolioClientState(portfolio)
  })
  ipcMain.handle('portfolio:execute', (event, command: PortfolioCommand) => {
    assertTrustedSender(event, validateSender)
    if (!command || typeof command !== 'object' || typeof command.type !== 'string') {
      throw new Error('资产命令无效')
    }
    return executePortfolioClientCommand(portfolio, command)
  })
  ipcMain.handle(
    'portfolio:sync-account',
    (event, workspaceId: unknown, accountId: unknown) => {
      assertTrustedSender(event, validateSender)
      if (typeof workspaceId !== 'string' || typeof accountId !== 'string') {
        throw new Error('资产账户同步请求无效')
      }
      return portfolio.syncAccount(workspaceId, accountId)
    }
  )
  ipcMain.handle('portfolio:inspect-backup', (event, content: unknown) => {
    assertTrustedSender(event, validateSender)
    return portfolio.inspectBackup(content)
  })
  ipcMain.handle('portfolio:export-active-workspace', (event) => {
    assertTrustedSender(event, validateSender)
    return portfolio.exportActiveWorkspace()
  })
  ipcMain.handle('backup:export', (event, content: unknown) => {
    assertTrustedSender(event, validateSender)
    return service.exportBackup(event.sender.id, content)
  })
  ipcMain.handle('backup:import', (event) => {
    assertTrustedSender(event, validateSender)
    return service.importBackup(event.sender.id)
  })
  ipcMain.handle('mcp:load-settings', (event) => {
    assertTrustedSender(event, validateSender)
    return mcp.loadConnectionSettings()
  })
  ipcMain.handle('mcp:update-settings', (event, settings: unknown) => {
    assertTrustedSender(event, validateSender)
    if (!settings || typeof settings !== 'object') {
      throw new Error('MCP 设置无效')
    }
    const input = settings as Partial<McpAccessSettings>
    return mcp.updateAccessSettings({
      enabled: input.enabled === true,
      allowWrite: input.allowWrite === true
    })
  })
}
