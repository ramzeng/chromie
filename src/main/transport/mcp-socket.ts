import { randomBytes, timingSafeEqual } from 'node:crypto'
import { chmod, mkdir, rm, writeFile } from 'node:fs/promises'
import { createServer, type Server, type Socket } from 'node:net'
import { dirname } from 'node:path'

import {
  DEFAULT_MCP_ACCESS_SETTINGS,
  MCP_TOOL_NAMES,
  type McpAccessSettings,
  type McpConnectionSettings,
  type McpSocketRequest,
  type McpSocketResponse,
  type McpToolName
} from '../../shared/mcp'
import {
  McpOperationError,
  type PortfolioModuleOperations
} from '../service/portfolio-module'
import type { McpSettingsOperations } from '../service/mcp-settings-service'

const MAX_REQUEST_BYTES = 1024 * 1024
const toolNames = new Set<string>(MCP_TOOL_NAMES)

export interface McpHostOperations {
  initialize(): Promise<void>
  loadConnectionSettings(): Promise<McpConnectionSettings>
  updateAccessSettings(settings: McpAccessSettings): Promise<McpConnectionSettings>
  close(): Promise<void>
}

type McpSocketHostOptions = {
  socketPath: string
  tokenPath: string
  command: string
  args: string[]
}

function isToolName(value: unknown): value is McpToolName {
  return typeof value === 'string' && toolNames.has(value)
}

function secureTokenMatches(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual)
  const expectedBytes = Buffer.from(expected)
  return actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
}

export class McpSocketHost implements McpHostOperations {
  private server: Server | null = null
  private token = ''
  private access: McpAccessSettings = { ...DEFAULT_MCP_ACCESS_SETTINGS }

  constructor(
    private readonly module: PortfolioModuleOperations,
    private readonly settings: McpSettingsOperations,
    private readonly options: McpSocketHostOptions
  ) {}

  async initialize(): Promise<void> {
    this.access = await this.settings.load()
    if (this.access.enabled) await this.startServer()
  }

  async loadConnectionSettings(): Promise<McpConnectionSettings> {
    return {
      access: { ...this.access },
      command: this.options.command,
      args: [...this.options.args]
    }
  }

  async updateAccessSettings(
    settings: McpAccessSettings
  ): Promise<McpConnectionSettings> {
    this.access = await this.settings.save(settings)
    if (this.access.enabled) await this.startServer()
    else await this.stopServer()
    return this.loadConnectionSettings()
  }

  async close(): Promise<void> {
    await this.stopServer()
  }

  private async startServer(): Promise<void> {
    if (this.server) return
    await mkdir(dirname(this.options.socketPath), { recursive: true, mode: 0o700 })
    await Promise.all([
      rm(this.options.socketPath, { force: true }),
      rm(this.options.tokenPath, { force: true })
    ])
    this.token = randomBytes(32).toString('hex')
    await writeFile(this.options.tokenPath, this.token, {
      encoding: 'utf8',
      mode: 0o600
    })

    const server = createServer((socket) => this.handleSocket(socket))
    this.server = server
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
          server.off('listening', onListening)
          reject(error)
        }
        const onListening = () => {
          server.off('error', onError)
          resolve()
        }
        server.once('error', onError)
        server.once('listening', onListening)
        server.listen(this.options.socketPath)
      })
      await chmod(this.options.socketPath, 0o600)
    } catch (error) {
      this.server = null
      server.close()
      await Promise.all([
        rm(this.options.socketPath, { force: true }),
        rm(this.options.tokenPath, { force: true })
      ])
      throw error
    }
  }

  private async stopServer(): Promise<void> {
    const server = this.server
    this.server = null
    this.token = ''
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
    await Promise.all([
      rm(this.options.socketPath, { force: true }),
      rm(this.options.tokenPath, { force: true })
    ])
  }

  private handleSocket(socket: Socket): void {
    socket.setEncoding('utf8')
    let buffer = ''
    let handled = false

    socket.on('data', (chunk: string) => {
      if (handled) return
      buffer += chunk
      if (Buffer.byteLength(buffer, 'utf8') > MAX_REQUEST_BYTES) {
        handled = true
        this.writeResponse(socket, {
          id: '',
          error: {
            code: 'VALIDATION_ERROR',
            message: 'MCP 请求过大',
            retryable: false
          }
        })
        return
      }
      const newline = buffer.indexOf('\n')
      if (newline < 0) return
      handled = true
      const line = buffer.slice(0, newline)
      void this.handleRequestLine(line).then((response) => {
        this.writeResponse(socket, response)
      })
    })

    socket.on('error', () => {
      // Client disconnects are isolated to this one request.
    })
  }

  private async handleRequestLine(line: string): Promise<McpSocketResponse> {
    let request: McpSocketRequest
    try {
      request = JSON.parse(line) as McpSocketRequest
    } catch {
      return this.error('', 'VALIDATION_ERROR', 'MCP 请求格式无效')
    }
    const id = typeof request?.id === 'string' ? request.id : ''
    if (
      !request ||
      typeof request !== 'object' ||
      typeof request.token !== 'string' ||
      !secureTokenMatches(request.token, this.token)
    ) {
      return this.error(id, 'PERMISSION_DENIED', 'MCP 本地连接认证失败')
    }

    try {
      if (request.method !== 'call-tool' || !isToolName(request.tool)) {
        return this.error(id, 'VALIDATION_ERROR', '不支持的 MCP 方法')
      }
      return {
        id,
        result: await this.module.callMcpTool(
          request.tool,
          request.arguments,
          this.access
        )
      }
    } catch (error) {
      if (error instanceof McpOperationError) {
        return {
          id,
          error: {
            code: error.code,
            message: error.message,
            retryable: error.retryable,
            ...(error.details === undefined ? {} : { details: error.details })
          }
        }
      }
      return this.error(
        id,
        'INTERNAL_ERROR',
        error instanceof Error ? error.message : 'Chromie MCP 调用失败',
        false
      )
    }
  }

  private error(
    id: string,
    code: string,
    message: string,
    retryable = false
  ): McpSocketResponse {
    return { id, error: { code, message, retryable } }
  }

  private writeResponse(socket: Socket, response: McpSocketResponse): void {
    socket.end(`${JSON.stringify(response)}\n`)
  }
}
