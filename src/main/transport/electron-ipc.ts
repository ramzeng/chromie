import { ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron'

import type { BinanceSyncOptions } from '../../shared/binance'
import type { FutuSyncOptions } from '../../shared/futu'
import type { IbkrSyncOptions } from '../../shared/ibkr'
import type { OkxSyncOptions } from '../../shared/okx'
import type { PortfolioCommand } from '../../shared/portfolio'
import type { DesktopOperations } from '../service/desktop-service'
import type { PortfolioOperations } from '../service/portfolio-service'

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
  portfolio: PortfolioOperations,
  validateSender: IpcSenderValidator
): void {
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
  ipcMain.handle('exchange-rates:load', (event, legacyContent?: unknown) => {
    assertTrustedSender(event, validateSender)
    return service.loadExchangeRates(legacyContent)
  })
  ipcMain.handle('exchange-rates:fetch', (event, provider: unknown) => {
    assertTrustedSender(event, validateSender)
    return service.fetchExchangeRates(provider)
  })
  ipcMain.handle('portfolio:load', (event, legacyContent?: unknown) => {
    assertTrustedSender(event, validateSender)
    return portfolio.load(legacyContent)
  })
  ipcMain.handle('portfolio:execute', (event, command: PortfolioCommand) => {
    assertTrustedSender(event, validateSender)
    if (!command || typeof command !== 'object' || typeof command.type !== 'string') {
      throw new Error('资产命令无效')
    }
    return portfolio.execute(command)
  })
  ipcMain.handle('portfolio:inspect-backup', (event, content: unknown) => {
    assertTrustedSender(event, validateSender)
    return portfolio.inspectBackup(content)
  })
  ipcMain.handle('portfolio:export-active-account', (event) => {
    assertTrustedSender(event, validateSender)
    return portfolio.exportActiveAccount()
  })
  ipcMain.handle('backup:export', (event, content: unknown) => {
    assertTrustedSender(event, validateSender)
    return service.exportBackup(event.sender.id, content)
  })
  ipcMain.handle('backup:import', (event) => {
    assertTrustedSender(event, validateSender)
    return service.importBackup(event.sender.id)
  })
  ipcMain.handle(
    'share-image:save',
    (event, dataUrl: unknown, accountName: unknown) => {
      assertTrustedSender(event, validateSender)
      return service.saveShareImage(event.sender.id, dataUrl, accountName)
    }
  )
}
