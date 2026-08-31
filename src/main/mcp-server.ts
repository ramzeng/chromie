import {
  McpServer,
  type CallToolResult,
  type ToolAnnotations
} from '@modelcontextprotocol/server'
import { serveStdio, type StdioServerHandle } from '@modelcontextprotocol/server/stdio'

import {
  MCP_TOOL_NAMES,
  mcpToolInputSchemas,
  mcpToolOutputSchemas,
  type McpToolError,
  type McpToolName,
  type McpToolSuccess
} from '../shared/mcp'
import { McpRemoteError, McpSocketClient } from './infra/mcp-client'

type ToolDefinition = {
  title: string
  description: string
  annotations: ToolAnnotations
}

const readOnlyAnnotations: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
}

const additiveAnnotations: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false
}

const updateAnnotations: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false
}

const TOOL_DEFINITIONS: Record<McpToolName, ToolDefinition> = {
  chromie_list_accounts: {
    title: '列出 Chromie 账户',
    description: '列出本机 Chromie 中的账户摘要；汇率只返回 CNY、HKD 和 USD。',
    annotations: readOnlyAnnotations
  },
  chromie_get_account: {
    title: '读取 Chromie 账户',
    description: '读取账户最新版或指定历史快照。返回持有人、资产账户、持仓分组、可选持仓和脱敏同步状态；默认不内嵌持仓，汇率只返回 CNY、HKD 和 USD。',
    annotations: readOnlyAnnotations
  },
  chromie_get_overview: {
    title: '读取资产透视',
    description: '按照资产账户、持仓分组或币种汇总市值、锚定市值、占比和缺失汇率。只使用 Chromie 当前缓存或快照中的汇率，响应只包含 CNY、HKD 和 USD 汇率。',
    annotations: readOnlyAnnotations
  },
  chromie_search_positions: {
    title: '搜索持仓',
    description: '按关键词、市场、币种、资产账户、持有人或分组检索持仓。继续分页时原样传回 next_cursor，并保持其他查询条件不变。',
    annotations: readOnlyAnnotations
  },
  chromie_list_snapshots: {
    title: '列出资产快照',
    description: '列出账户在时间机器中的历史快照及其内容统计。',
    annotations: readOnlyAnnotations
  },
  chromie_create_account: {
    title: '创建 Chromie 账户',
    description: '创建一个新的总账户。',
    annotations: additiveAnnotations
  },
  chromie_update_account: {
    title: '更新 Chromie 账户',
    description: '局部修改账户名称、锚定币种或汇率设置，不会覆盖持有人。',
    annotations: updateAnnotations
  },
  chromie_create_holder: {
    title: '创建持有人',
    description: '在指定 Chromie 账户中创建持有人。',
    annotations: additiveAnnotations
  },
  chromie_update_holder: {
    title: '更新持有人',
    description: '修改已有持有人的名称。',
    annotations: updateAnnotations
  },
  chromie_create_asset_account: {
    title: '创建资产账户',
    description: '创建不含同步凭据的资产账户。自动同步凭据只能在 Chromie UI 中配置。',
    annotations: additiveAnnotations
  },
  chromie_update_asset_account: {
    title: '更新资产账户',
    description: '局部修改资产账户名称、类型或持有人。不会返回或修改同步凭据；已同步账户不能通过 MCP 改类型。',
    annotations: updateAnnotations
  },
  chromie_create_position: {
    title: '创建持仓',
    description: '在手工资产账户中创建持仓。自动同步账户为只读。',
    annotations: additiveAnnotations
  },
  chromie_update_position: {
    title: '更新持仓',
    description: '局部更新手工资产账户中的持仓。价格传 null 可清除价格。自动同步账户为只读。',
    annotations: updateAnnotations
  },
  chromie_create_position_group: {
    title: '创建持仓分组',
    description: '在指定 Chromie 账户中创建持仓分组。',
    annotations: additiveAnnotations
  },
  chromie_update_position_group: {
    title: '更新持仓分组',
    description: '修改已有持仓分组的名称。',
    annotations: updateAnnotations
  },
  chromie_replace_position_group_members: {
    title: '替换持仓分组成员',
    description: '完整替换一个持仓分组的成员；一项持仓最多属于一个分组。',
    annotations: updateAnnotations
  },
  chromie_create_snapshot: {
    title: '创建资产快照',
    description: '保存账户当前结构、持仓价格和当前缓存汇率。',
    annotations: additiveAnnotations
  },
  chromie_sync_asset_account: {
    title: '同步资产账户',
    description: '使用 Chromie 安全存储中已有的连接配置同步持仓；工具不会读取或返回任何凭据。',
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  chromie_refresh_exchange_rates: {
    title: '刷新汇率',
    description: '从账户配置的汇率数据源刷新 Chromie 本机汇率缓存；响应只返回 CNY、HKD 和 USD。',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  chromie_delete_portfolio_item: {
    title: '删除 Chromie 数据',
    description: '删除账户、持有人、资产账户、持仓、持仓分组或快照。此操作无法撤销，Agent 应在调用前向用户确认。',
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false
    }
  }
}

function toolSuccess(value: unknown): CallToolResult {
  const result = value as McpToolSuccess
  return {
    content: [{ type: 'text', text: result.summary }],
    structuredContent: result
  }
}

function toolError(error: unknown): CallToolResult {
  const structuredContent: McpToolError = error instanceof McpRemoteError
    ? {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          ...(error.details === undefined ? {} : { details: error.details })
        }
      }
    : {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : String(error),
          retryable: false
        }
      }
  return {
    content: [{
      type: 'text',
      text: `${structuredContent.error.code}: ${structuredContent.error.message}${structuredContent.error.retryable ? '（可重试）' : ''}`
    }],
    structuredContent,
    isError: true
  }
}

function registerTool(
  server: McpServer,
  client: McpSocketClient,
  name: McpToolName
): void {
  const definition = TOOL_DEFINITIONS[name]
  server.registerTool(
    name,
    {
      ...definition,
      inputSchema: mcpToolInputSchemas[name],
      outputSchema: mcpToolOutputSchemas[name]
    },
    async (argumentsValue: unknown) => {
      try {
        const result = mcpToolOutputSchemas[name].parse(
          await client.callTool(name, argumentsValue)
        )
        if (!result.ok) throw new Error('Chromie MCP 返回了无效的成功结果')
        return toolSuccess(result as McpToolSuccess)
      } catch (error) {
        return toolError(error)
      }
    }
  )
}

function buildServer(client: McpSocketClient): McpServer {
  const server = new McpServer(
    { name: 'chromie', version: '0.1.0' },
    {
      instructions:
        'Chromie manages local financial portfolio data. Snapshot views are read-only. Never ask for or expose brokerage/API credentials; configure them only in the Chromie UI.'
    }
  )

  MCP_TOOL_NAMES.forEach((name) => registerTool(server, client, name))

  return server
}

export function runChromieMcpServer(options: {
  socketPath: string
  tokenPath: string
  onClosed?: () => void
}): StdioServerHandle {
  const client = new McpSocketClient(options.socketPath, options.tokenPath)
  const handle = serveStdio(() => buildServer(client), {
    onerror: (error) => console.error(`Chromie MCP transport error: ${error.message}`)
  })

  let closing = false
  const close = () => {
    if (closing) return
    closing = true
    void handle.close().finally(() => options.onClosed?.())
  }
  process.stdin.once('end', close)
  process.once('SIGINT', close)
  process.once('SIGTERM', close)
  return handle
}
