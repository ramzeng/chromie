import type { Dispatch, SetStateAction } from 'react'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { McpAccessSettings, McpConnectionSettings } from '@/lib/mcp'
import { operationErrorMessage } from './dialog-utils'

export function McpSettingsSection({
  connection,
  access,
  setAccess
}: {
  connection: McpConnectionSettings | null
  access: McpAccessSettings
  setAccess: Dispatch<SetStateAction<McpAccessSettings>>
}) {
  const clientConfig = connection
    ? JSON.stringify(
        {
          mcpServers: {
            chromie: {
              command: connection.command,
              args: connection.args
            }
          }
        },
        null,
        2
      )
    : ''

  async function copyClientConfig(): Promise<void> {
    try {
      await navigator.clipboard.writeText(clientConfig)
      toast.success('MCP 协议配置已复制')
    } catch (error) {
      toast.error(`复制 MCP 协议配置失败：${operationErrorMessage(error)}`)
    }
  }

  return (
    <section className="grid gap-5">
      <div>
        <h3 className="text-base font-semibold">MCP 协议</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          允许 Agent 在你授权的范围内读取或维护 Chromie 数据
        </p>
      </div>
      <div className="divide-y overflow-hidden rounded-sm border">
        <div className="flex items-center justify-between gap-6 p-4">
          <div>
            <Label htmlFor="mcp-enabled">启用 MCP 协议</Label>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              关闭后本地 MCP 协议连接立即停止
            </p>
          </div>
          <Switch
            id="mcp-enabled"
            checked={access.enabled}
            onCheckedChange={(enabled) => setAccess((current) => ({ ...current, enabled }))}
          />
        </div>
        <div className="flex items-center justify-between gap-6 p-4">
          <div>
            <Label htmlFor="mcp-write">允许写入</Label>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">允许创建和修改资产数据</p>
          </div>
          <Switch
            id="mcp-write"
            checked={access.allowWrite}
            disabled={!access.enabled}
            onCheckedChange={(allowWrite) =>
              setAccess((current) => ({
                ...current,
                allowWrite
              }))
            }
          />
        </div>
      </div>

      {clientConfig && (
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <Label>MCP 协议客户端配置</Label>
            <Button type="button" variant="outline" size="sm" onClick={copyClientConfig}>
              <Copy data-icon="inline-start" />
              复制
            </Button>
          </div>
          <pre className="max-h-40 overflow-auto rounded-sm bg-muted p-3 text-xs leading-5">
            {clientConfig}
          </pre>
        </div>
      )}
    </section>
  )
}
