import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createConnection } from 'node:net'

import type {
  McpSocketRequest,
  McpSocketResponse,
  McpToolName,
  McpToolSuccess
} from '../../shared/mcp'

const MAX_RESPONSE_BYTES = 10 * 1024 * 1024
const REQUEST_TIMEOUT_MS = 120_000

export class McpRemoteError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
    readonly details?: unknown
  ) {
    super(message)
    this.name = 'McpRemoteError'
  }
}

export class McpSocketClient {
  constructor(
    private readonly socketPath: string,
    private readonly tokenPath: string
  ) {}

  callTool(tool: McpToolName, argumentsValue: unknown): Promise<McpToolSuccess> {
    return this.request({
      id: randomUUID(),
      token: '',
      method: 'call-tool',
      tool,
      arguments: argumentsValue
    })
  }

  private async request(request: McpSocketRequest): Promise<McpToolSuccess> {
    try {
      request.token = (await readFile(this.tokenPath, 'utf8')).trim()
    } catch {
      throw new McpRemoteError(
        'APP_NOT_RUNNING',
        'Chromie 未运行或 MCP 尚未启用。请打开 Chromie，在 MCP 设置中启用后重试。',
        true
      )
    }

    const response = await new Promise<McpSocketResponse>((resolve, reject) => {
      const socket = createConnection(this.socketPath)
      socket.setEncoding('utf8')
      socket.setTimeout(REQUEST_TIMEOUT_MS)
      let buffer = ''
      let settled = false

      const fail = (error: Error) => {
        if (settled) return
        settled = true
        socket.destroy()
        reject(error)
      }

      socket.once('connect', () => socket.write(`${JSON.stringify(request)}\n`))
      socket.on('data', (chunk: string) => {
        if (settled) return
        buffer += chunk
        if (Buffer.byteLength(buffer, 'utf8') > MAX_RESPONSE_BYTES) {
          fail(new Error('Chromie MCP 响应过大'))
          return
        }
        const newline = buffer.indexOf('\n')
        if (newline < 0) return
        settled = true
        socket.end()
        try {
          resolve(JSON.parse(buffer.slice(0, newline)) as McpSocketResponse)
        } catch {
          reject(new Error('Chromie MCP 响应格式无效'))
        }
      })
      socket.once('timeout', () => fail(new Error('Chromie MCP 请求超时')))
      socket.once('error', (error) => fail(error))
      socket.once('end', () => {
        if (!settled) fail(new Error('Chromie MCP 连接意外关闭'))
      })
    }).catch((error) => {
      if (error instanceof McpRemoteError) throw error
      throw new McpRemoteError(
        'APP_NOT_RUNNING',
        `无法连接 Chromie：${error instanceof Error ? error.message : String(error)}`,
        true
      )
    })

    if ('error' in response) {
      throw new McpRemoteError(
        response.error.code,
        response.error.message,
        response.error.retryable,
        response.error.details
      )
    }
    return response.result
  }
}
