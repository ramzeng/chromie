import { randomUUID } from 'node:crypto'

import { app, ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron'

import type { PortfolioCommand } from '../../shared/portfolio'
import {
  portfolioAccountTargetSchema,
  portfolioCommandSchema,
  portfolioPriceRefreshTargetSchema,
  portfolioProxyTestSchema
} from '../../shared/portfolio-command'
import type { McpAccessSettings } from '../../shared/mcp'
import type { DesktopOperations } from '../service/desktop-service'
import type { PortfolioModuleOperations } from '../service/portfolio-module'
import type { StorageLocationOperations } from '../infra/storage-location'
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
  storage: StorageLocationOperations,
  validateSender: IpcSenderValidator
): void {
  const portfolioSubscribers = new Set<WebContents>()
  const pendingBackupImports = new Map<
    string,
    { ownerId: number; content: string }
  >()
  const pendingBackupOwners = new Set<number>()

  function clearPendingBackups(ownerId: number): void {
    pendingBackupImports.forEach((pending, token) => {
      if (pending.ownerId === ownerId) pendingBackupImports.delete(token)
    })
  }
  portfolio.subscribe(() => {
    portfolioSubscribers.forEach((sender) => {
      if (sender.isDestroyed()) {
        portfolioSubscribers.delete(sender)
        return
      }
      sender.send('portfolio:changed')
    })
  })
  ipcMain.handle('exchange-rates:load', (event, legacyContent?: unknown) => {
    assertTrustedSender(event, validateSender)
    return service.loadExchangeRates(legacyContent)
  })
  ipcMain.handle('exchange-rates:fetch', (event, provider: unknown) => {
    assertTrustedSender(event, validateSender)
    return service.fetchExchangeRates(provider)
  })
  ipcMain.handle('asset-quotes:lookup', (event, input: unknown) => {
    assertTrustedSender(event, validateSender)
    return service.lookupAssetQuote?.(input) ?? { status: 'unavailable' }
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
  ipcMain.handle('portfolio:execute', (event, command: unknown) => {
    assertTrustedSender(event, validateSender)
    const parsed = portfolioCommandSchema.safeParse(command)
    if (!parsed.success) throw new Error('资产命令无效')
    return executePortfolioClientCommand(portfolio, parsed.data as PortfolioCommand)
  })
  ipcMain.handle(
    'portfolio:sync-account',
    (event, workspaceId: unknown, accountId: unknown) => {
      assertTrustedSender(event, validateSender)
      const parsed = portfolioAccountTargetSchema.safeParse({
        workspaceId,
        accountId
      })
      if (!parsed.success) throw new Error('账户同步请求无效')
      return portfolio.syncAccount(parsed.data.workspaceId, parsed.data.accountId)
    }
  )
  ipcMain.handle(
    'portfolio:refresh-position-prices',
    (event, workspaceId: unknown, accountId?: unknown) => {
      assertTrustedSender(event, validateSender)
      const parsed = portfolioPriceRefreshTargetSchema.safeParse({
        workspaceId,
        accountId
      })
      if (!parsed.success) throw new Error('持仓价格刷新请求无效')
      return portfolio.refreshPositionPrices(
        parsed.data.workspaceId,
        parsed.data.accountId
      )
    }
  )
  ipcMain.handle('portfolio:test-proxy', (event, profileId: unknown, target: unknown) => {
    assertTrustedSender(event, validateSender)
    const parsed = portfolioProxyTestSchema.safeParse({ profileId, target })
    if (!parsed.success) throw new Error('代理测试请求无效')
    return portfolio.testProxyProfile(parsed.data.profileId, parsed.data.target)
  })
  ipcMain.handle('backup:export', async (event) => {
    assertTrustedSender(event, validateSender)
    return service.exportBackup(
      event.sender.id,
      await portfolio.exportActiveWorkspace()
    )
  })
  ipcMain.handle('backup:import', async (event) => {
    assertTrustedSender(event, validateSender)
    const result = await service.importBackup(event.sender.id)
    if (result.canceled) return result

    const backup = portfolio.inspectBackup(result.content)
    if (!backup) throw new Error('备份文件无效或版本不受支持')

    clearPendingBackups(event.sender.id)
    const token = randomUUID()
    pendingBackupImports.set(token, {
      ownerId: event.sender.id,
      content: result.content
    })
    if (!pendingBackupOwners.has(event.sender.id)) {
      pendingBackupOwners.add(event.sender.id)
      event.sender.once('destroyed', () => {
        clearPendingBackups(event.sender.id)
        pendingBackupOwners.delete(event.sender.id)
      })
    }
    return {
      canceled: false,
      preview: {
        token,
        workspaceName: backup.workspace.name,
        accountCount: backup.workspace.accounts.length,
        tagCount: backup.workspace.tags.length,
        positionCount: backup.workspace.accounts.reduce(
          (total, account) => total + account.positions.length,
          0
        ),
        snapshotCount: backup.snapshots.length,
        integrationCount: backup.integrations.length,
        proxyProfileCount: backup.proxyProfiles.length
      }
    }
  })
  ipcMain.handle('backup:confirm-import', async (event, token: unknown) => {
    assertTrustedSender(event, validateSender)
    if (typeof token !== 'string') throw new Error('备份导入请求无效')
    const pending = pendingBackupImports.get(token)
    if (!pending || pending.ownerId !== event.sender.id) {
      throw new Error('备份导入请求已失效，请重新选择备份文件')
    }
    const workspaceId = await portfolio.importBackup(pending.content)
    pendingBackupImports.delete(token)
    return { workspaceId }
  })
  ipcMain.handle('backup:discard-import', (event, token: unknown) => {
    assertTrustedSender(event, validateSender)
    if (typeof token !== 'string') return
    const pending = pendingBackupImports.get(token)
    if (pending?.ownerId === event.sender.id) pendingBackupImports.delete(token)
  })
  ipcMain.handle('storage:get-location', (event) => {
    assertTrustedSender(event, validateSender)
    return storage.getLocation()
  })
  ipcMain.handle('storage:validate-location', (event, path: unknown) => {
    assertTrustedSender(event, validateSender)
    return storage.validateLocation(path)
  })
  ipcMain.handle('storage:update-location', async (event, path: unknown) => {
    assertTrustedSender(event, validateSender)
    const result = await storage.updateLocation(path)
    if (result.changed) {
      setTimeout(() => {
        app.relaunch()
        app.exit(0)
      }, 500)
    }
    return result
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
