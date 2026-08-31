import {
  McpServer,
  acceptedContent,
  inputRequired,
  inputResponse,
  type CallToolResult,
  type ToolAnnotations
} from '@modelcontextprotocol/server'
import { serveStdio, type StdioServerHandle } from '@modelcontextprotocol/server/stdio'
import { z } from 'zod'

import {
  MCP_TOOL_NAMES,
  mcpToolInputSchemas,
  mcpToolOutputSchema,
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
    description: '列出本机 Chromie 中的账户摘要并返回当前 revision。执行任何写操作前应先调用此方法。',
    annotations: readOnlyAnnotations
  },
  chromie_get_account: {
    title: '读取 Chromie 账户',
    description: '读取账户最新版或指定历史快照。返回持有人、资产账户、持仓分组、可选持仓和脱敏同步状态。',
    annotations: readOnlyAnnotations
  },
  chromie_get_overview: {
    title: '读取资产透视',
    description: '按照资产账户、持仓分组或币种汇总市值、锚定市值、占比和缺失汇率。只使用 Chromie 当前缓存或快照中的汇率。',
    annotations: readOnlyAnnotations
  },
  chromie_find_positions: {
    title: '查找持仓',
    description: '按关键词、市场、币种、资产账户、持有人或分组检索持仓，支持分页。',
    annotations: readOnlyAnnotations
  },
  chromie_list_snapshots: {
    title: '列出资产快照',
    description: '列出账户在时间机器中的历史快照及其内容统计。',
    annotations: readOnlyAnnotations
  },
  chromie_create_account: {
    title: '创建 Chromie 账户',
    description: '创建一个新的总账户。需要来自最近一次读取的 expected_revision。',
    annotations: additiveAnnotations
  },
  chromie_update_account: {
    title: '更新 Chromie 账户',
    description: '局部修改账户名称、锚定币种或汇率设置，不会覆盖持有人。需要 expected_revision。',
    annotations: updateAnnotations
  },
  chromie_save_holder: {
    title: '保存持有人',
    description: '创建持有人或修改已有持有人名称。mode 为 create 或 update。需要 expected_revision。',
    annotations: updateAnnotations
  },
  chromie_create_asset_account: {
    title: '创建资产账户',
    description: '创建不含同步凭据的资产账户。自动同步凭据只能在 Chromie UI 中配置。需要 expected_revision。',
    annotations: additiveAnnotations
  },
  chromie_update_asset_account: {
    title: '更新资产账户',
    description: '局部修改资产账户名称、类型或持有人。不会返回或修改同步凭据；已同步账户不能通过 MCP 改类型。',
    annotations: updateAnnotations
  },
  chromie_save_position: {
    title: '保存持仓',
    description: '在手工资产账户中创建或局部更新持仓。价格传 null 可清除价格。自动同步账户为只读。',
    annotations: updateAnnotations
  },
  chromie_save_position_group: {
    title: '保存持仓分组',
    description: '创建持仓分组或修改已有分组名称。需要 expected_revision。',
    annotations: updateAnnotations
  },
  chromie_set_group_members: {
    title: '设置分组持仓',
    description: '完整替换一个持仓分组的成员；一项持仓最多属于一个分组。需要 expected_revision。',
    annotations: updateAnnotations
  },
  chromie_create_snapshot: {
    title: '创建资产快照',
    description: '保存账户当前结构、持仓价格和当前缓存汇率。需要 expected_revision。',
    annotations: additiveAnnotations
  },
  chromie_sync_asset_account: {
    title: '同步资产账户',
    description: '使用 Chromie 安全存储中已有的连接配置同步持仓；工具不会读取或返回任何凭据。需要 expected_revision。',
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  chromie_refresh_exchange_rates: {
    title: '刷新汇率',
    description: '从账户配置的汇率数据源刷新 Chromie 本机汇率缓存。',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  chromie_delete_item: {
    title: '删除 Chromie 数据',
    description: '删除账户、持有人、资产账户、持仓、持仓分组或快照。执行前会展示精确影响并请求用户确认。',
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false
    }
  }
}

const confirmationSchema = z.object({ confirm: z.boolean() }).strict()

function toolSuccess(value: unknown): CallToolResult {
  const result = value as McpToolSuccess
  return {
    content: [{ type: 'text', text: result.summary }],
    structuredContent: result
  }
}

function toolError(error: unknown): CallToolResult {
  if (error instanceof McpRemoteError) {
    return {
      content: [{
        type: 'text',
        text: `${error.code}: ${error.message}${error.retryable ? '（可重试）' : ''}`
      }],
      isError: true
    }
  }
  return {
    content: [{
      type: 'text',
      text: error instanceof Error ? error.message : String(error)
    }],
    isError: true
  }
}

function registerSimpleTool(
  server: McpServer,
  client: McpSocketClient,
  name: Exclude<McpToolName, 'chromie_delete_item'>
): void {
  const definition = TOOL_DEFINITIONS[name]
  server.registerTool(
    name,
    {
      ...definition,
      inputSchema: mcpToolInputSchemas[name],
      outputSchema: mcpToolOutputSchema
    },
    async (argumentsValue: unknown) => {
      try {
        return toolSuccess(await client.callTool(name, argumentsValue))
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
        'Chromie manages local financial portfolio data. Start with chromie_list_accounts and pass its revision as expected_revision to mutations. Snapshot views are read-only. Never ask for or expose brokerage/API credentials; configure them only in the Chromie UI.'
    }
  )

  MCP_TOOL_NAMES
    .filter((name): name is Exclude<McpToolName, 'chromie_delete_item'> =>
      name !== 'chromie_delete_item'
    )
    .forEach((name) => registerSimpleTool(server, client, name))

  const definition = TOOL_DEFINITIONS.chromie_delete_item
  server.registerTool(
    'chromie_delete_item',
    {
      ...definition,
      inputSchema: mcpToolInputSchemas.chromie_delete_item,
      outputSchema: mcpToolOutputSchema
    },
    async (argumentsValue, context) => {
      const response = inputResponse(context.mcpReq.inputResponses, 'confirm')
      if (response.kind === 'elicit' && response.action !== 'accept') {
        return {
          content: [{ type: 'text', text: '用户已取消删除操作' }],
          isError: true
        }
      }
      const confirmation = acceptedContent(
        context.mcpReq.inputResponses,
        'confirm',
        confirmationSchema
      )
      if (confirmation) {
        if (!confirmation.confirm) {
          return {
            content: [{ type: 'text', text: '用户未确认删除操作' }],
            isError: true
          }
        }
        try {
          return toolSuccess(
            await client.callTool('chromie_delete_item', argumentsValue, true)
          )
        } catch (error) {
          return toolError(error)
        }
      }

      try {
        const preview = await client.previewDelete(argumentsValue) as {
          title: string
          description: string
        }
        return inputRequired({
          inputRequests: {
            confirm: inputRequired.elicit({
              message: `${preview.title}\n\n${preview.description}`,
              requestedSchema: confirmationSchema
            })
          }
        })
      } catch (error) {
        return toolError(error)
      }
    }
  )

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
