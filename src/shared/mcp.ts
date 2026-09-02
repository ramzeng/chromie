import { z } from 'zod'

import { TAG_COLORS } from './portfolio'

export const MCP_TOOL_NAMES = [
  'chromie_list_workspaces',
  'chromie_get_workspace',
  'chromie_get_portfolio_overview',
  'chromie_list_positions',
  'chromie_list_snapshots',
  'chromie_create_workspace',
  'chromie_update_workspace',
  'chromie_create_tag',
  'chromie_update_tag',
  'chromie_set_account_tags',
  'chromie_set_position_tags',
  'chromie_create_account',
  'chromie_update_account',
  'chromie_create_position',
  'chromie_update_position',
  'chromie_create_snapshot',
  'chromie_sync_account',
  'chromie_refresh_exchange_rates'
] as const

export type McpToolName = (typeof MCP_TOOL_NAMES)[number]

const id = z.string().trim().min(1).max(128)
const name = z.string().trim().min(1).max(60)
const currency = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,12}$/)
const market = z.enum(['CN', 'HK', 'US', 'CC'])
const baseCurrency = z.enum(['CNY', 'HKD', 'USD'])
const accountType = z.enum([
  'Futu',
  'Boci',
  'Okx',
  'Ibkr',
  'Hstong',
  'Binance',
  'Alipay',
  'General',
  'Cmb',
  'Boc'
])
const tagColor = z.enum(TAG_COLORS)
const integrationProvider = z.enum(['Futu', 'Okx', 'Ibkr', 'Hstong', 'Binance'])

export const mcpViewSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('latest') }).strict(),
  z.object({ kind: z.literal('snapshot'), snapshot_id: id }).strict()
])

export const listWorkspacesInputSchema = z.object({}).strict()

export const getWorkspaceInputSchema = z.object({
  workspace_id: id,
  view: mcpViewSchema.optional(),
  include_positions: z.boolean()
    .describe('是否在工作区详情中内嵌持仓，默认为 false，持仓较多时请使用列出持仓工具')
    .optional()
    .default(false)
}).strict()

export const getPortfolioOverviewInputSchema = z.object({
  workspace_id: id,
  view: mcpViewSchema.optional(),
  group_by: z.enum(['account', 'tag', 'currency'])
}).strict()

export const listPositionsInputSchema = z.object({
  workspace_id: id,
  view: mcpViewSchema.optional(),
  query: z.string().trim().max(80).optional(),
  market: market.optional(),
  currency: currency.optional(),
  account_id: id.optional(),
  tag_id: id.optional(),
  cursor: z.string()
    .regex(/^[A-Za-z0-9_-]{1,512}$/)
    .describe('上一页返回的不透明游标，必须与相同查询条件一起使用')
    .optional(),
  limit: z.number().int().min(1).max(100).optional().default(50)
}).strict()

export const listSnapshotsInputSchema = z.object({ workspace_id: id }).strict()

export const createWorkspaceInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
  base_currency: baseCurrency
}).strict()

export const updateWorkspaceInputSchema = z.object({
  workspace_id: id,
  name: z.string().trim().min(1).max(40).optional(),
  base_currency: baseCurrency.optional(),
  exchange_rate_provider: z.literal('coinbase').optional(),
  exchange_rate_refresh_interval_minutes: z.number().int().min(1).max(1440).optional()
}).strict().refine(
  ({
    name: workspaceName,
    base_currency,
    exchange_rate_provider,
    exchange_rate_refresh_interval_minutes
  }) =>
    workspaceName !== undefined ||
    base_currency !== undefined ||
    exchange_rate_provider !== undefined ||
    exchange_rate_refresh_interval_minutes !== undefined,
  { message: '至少提供一个要修改的字段' }
)

export const createTagInputSchema = z.object({
  workspace_id: id,
  name,
  color: tagColor
}).strict()

export const updateTagInputSchema = z.object({
  workspace_id: id,
  tag_id: id,
  name,
  color: tagColor
}).strict()

export const setAccountTagsInputSchema = z.object({
  workspace_id: id,
  account_id: id,
  tag_ids: z.array(id).max(1000)
}).strict()

export const setPositionTagsInputSchema = z.object({
  workspace_id: id,
  account_id: id,
  position_id: id,
  tag_ids: z.array(id).max(1000)
}).strict()

export const createAccountInputSchema = z.object({
  workspace_id: id,
  name,
  type: accountType,
  tag_ids: z.array(id).max(1000).optional()
}).strict()

export const updateAccountInputSchema = z.object({
  workspace_id: id,
  account_id: id,
  name: name.optional(),
  type: accountType.optional(),
  tag_ids: z.array(id).max(1000).optional()
}).strict().refine(
  ({ name: accountName, type, tag_ids }) =>
    accountName !== undefined || type !== undefined || tag_ids !== undefined,
  { message: '至少提供一个要修改的字段' }
)

const positionCreateFields = {
  market,
  symbol: z.string().trim().min(1).max(24),
  name,
  currency,
  quantity: z.number().finite().positive(),
  price: z.number().finite().nonnegative().nullable().optional(),
  tag_ids: z.array(id).max(1000).optional()
}

export const createPositionInputSchema = z.object({
  workspace_id: id,
  account_id: id,
  ...positionCreateFields
}).strict()

export const updatePositionInputSchema = z.object({
  workspace_id: id,
  account_id: id,
  position_id: id,
  market: market.optional(),
  symbol: z.string().trim().min(1).max(24).optional(),
  name: name.optional(),
  currency: currency.optional(),
  quantity: z.number().finite().positive().optional(),
  price: z.number().finite().nonnegative().nullable().optional(),
  tag_ids: z.array(id).max(1000).optional()
}).strict().refine(
  ({ market: nextMarket, symbol, name: positionName, currency: nextCurrency, quantity, price, tag_ids }) =>
    nextMarket !== undefined ||
    symbol !== undefined ||
    positionName !== undefined ||
    nextCurrency !== undefined ||
    quantity !== undefined ||
    price !== undefined ||
    tag_ids !== undefined,
  { message: '至少提供一个要修改的字段' }
)

export const createSnapshotInputSchema = z.object({
  workspace_id: id
}).strict()

export const syncAccountInputSchema = z.object({
  workspace_id: id,
  account_id: id
}).strict()

export const refreshExchangeRatesInputSchema = z.object({
  workspace_id: id.optional()
}).strict()

export const mcpToolInputSchemas = {
  chromie_list_workspaces: listWorkspacesInputSchema,
  chromie_get_workspace: getWorkspaceInputSchema,
  chromie_get_portfolio_overview: getPortfolioOverviewInputSchema,
  chromie_list_positions: listPositionsInputSchema,
  chromie_list_snapshots: listSnapshotsInputSchema,
  chromie_create_workspace: createWorkspaceInputSchema,
  chromie_update_workspace: updateWorkspaceInputSchema,
  chromie_create_tag: createTagInputSchema,
  chromie_update_tag: updateTagInputSchema,
  chromie_set_account_tags: setAccountTagsInputSchema,
  chromie_set_position_tags: setPositionTagsInputSchema,
  chromie_create_account: createAccountInputSchema,
  chromie_update_account: updateAccountInputSchema,
  chromie_create_position: createPositionInputSchema,
  chromie_update_position: updatePositionInputSchema,
  chromie_create_snapshot: createSnapshotInputSchema,
  chromie_sync_account: syncAccountInputSchema,
  chromie_refresh_exchange_rates: refreshExchangeRatesInputSchema
} as const

export type McpToolArguments = {
  [Name in McpToolName]: z.infer<(typeof mcpToolInputSchemas)[Name]>
}

const count = z.number().int().nonnegative()
const tagOutputSchema = z.object({
  id,
  name,
  color: tagColor
}).strict()
const positionOutputSchema = z.object({
  id,
  market,
  symbol: z.string(),
  name: z.string(),
  currency: z.string(),
  quantity: z.number(),
  price: z.number().nonnegative().optional(),
  tag_ids: z.array(id)
}).strict()
const viewOutputSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('latest') }).strict(),
  z.object({
    kind: z.literal('snapshot'),
    snapshot_id: id,
    created_at: z.string()
  }).strict()
])
const exchangeRatesOutputSchema = z.object({
  provider: z.literal('coinbase'),
  base_currency: z.literal('USD'),
  rates: z.object({
    CNY: z.number().optional(),
    HKD: z.number().optional(),
    USD: z.number()
  }).strict(),
  fetched_at: z.string()
}).strict()
const syncStatusOutputSchema = z.object({
  capable: z.boolean(),
  configured: z.boolean(),
  interval_seconds: z.number().int().optional(),
  last_synced_at: z.string().optional(),
  provider: integrationProvider.optional()
}).strict()
const workspaceOutputSchema = z.object({
  id,
  name: z.string(),
  base_currency: baseCurrency,
  exchange_rate_provider: z.literal('coinbase'),
  exchange_rate_refresh_interval_minutes: z.number().int(),
  tags: z.array(tagOutputSchema),
  accounts: z.array(z.object({
    id,
    name: z.string(),
    type: accountType,
    sync: syncStatusOutputSchema,
    tag_ids: z.array(id),
    position_count: count,
    positions: z.array(positionOutputSchema).optional()
  }).strict())
}).strict()
const valuationOutputSchema = z.object({
  market_value: z.number().optional(),
  converted_market_value: z.number().optional(),
  missing_currencies: z.array(z.string()),
  missing_price_count: count
}).strict()
const errorDataSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
  details: z.unknown().optional()
}).strict()
const toolErrorOutputSchema = z.object({
  ok: z.literal(false),
  error: errorDataSchema
}).strict()

function toolOutputSchema<Data extends z.ZodType>(data: Data) {
  return z.discriminatedUnion('ok', [
    z.object({
      ok: z.literal(true),
      summary: z.string(),
      data
    }).strict(),
    toolErrorOutputSchema
  ])
}

const workspaceIdOutputSchema = z.object({ workspace_id: id }).strict()
const accountIdOutputSchema = z.object({ account_id: id }).strict()
export const mcpToolOutputSchemas = {
  chromie_list_workspaces: toolOutputSchema(z.object({
    active_workspace_id: id.nullable(),
    exchange_rates: exchangeRatesOutputSchema.nullable(),
    workspaces: z.array(z.object({
      id,
      name: z.string(),
      base_currency: baseCurrency,
      tag_count: count,
      account_count: count,
      position_count: count,
      snapshot_count: count,
      total_converted_market_value: z.number().optional(),
      missing_currencies: z.array(z.string()),
      missing_price_count: count
    }).strict())
  }).strict()),
  chromie_get_workspace: toolOutputSchema(z.object({
    view: viewOutputSchema,
    exchange_rates: exchangeRatesOutputSchema.nullable(),
    workspace: workspaceOutputSchema
  }).strict()),
  chromie_get_portfolio_overview: toolOutputSchema(z.object({
    view: viewOutputSchema,
    group_by: z.enum(['account', 'tag', 'currency']),
    base_currency: baseCurrency,
    exchange_rates: exchangeRatesOutputSchema.nullable(),
    total: z.object({
      position_count: count,
      converted_market_value: z.number().optional(),
      missing_currencies: z.array(z.string()),
      missing_price_count: count,
      complete: z.boolean()
    }).strict(),
    rows: z.array(z.object({
      id: z.string(),
      name: z.string(),
      position_count: count,
      currency: z.string().optional(),
      market_value: z.number().optional(),
      converted_market_value: z.number().optional(),
      allocation_percent: z.number().optional(),
      missing_currencies: z.array(z.string()),
      missing_price_count: count
    }).strict())
  }).strict()),
  chromie_list_positions: toolOutputSchema(z.object({
    view: viewOutputSchema,
    total: count,
    positions: z.array(positionOutputSchema.extend({
      account: z.object({ id, name: z.string() }).strict(),
      tags: z.array(tagOutputSchema),
      account_tags: z.array(tagOutputSchema),
      valuation: valuationOutputSchema
    }).strict()),
    next_cursor: z.string().optional()
  }).strict()),
  chromie_list_snapshots: toolOutputSchema(z.object({
    workspace: z.object({ id, name: z.string() }).strict(),
    snapshots: z.array(z.object({
      id,
      created_at: z.string(),
      account_count: count,
      tag_count: count,
      position_count: count,
      exchange_rates_fetched_at: z.string().nullable()
    }).strict())
  }).strict()),
  chromie_create_workspace: toolOutputSchema(workspaceIdOutputSchema),
  chromie_update_workspace: toolOutputSchema(workspaceIdOutputSchema),
  chromie_create_tag: toolOutputSchema(z.object({ tag: tagOutputSchema }).strict()),
  chromie_update_tag: toolOutputSchema(z.object({ tag: tagOutputSchema }).strict()),
  chromie_set_account_tags: toolOutputSchema(z.object({
    account_id: id,
    tag_ids: z.array(id)
  }).strict()),
  chromie_set_position_tags: toolOutputSchema(z.object({
    position_id: id,
    tag_ids: z.array(id)
  }).strict()),
  chromie_create_account: toolOutputSchema(accountIdOutputSchema),
  chromie_update_account: toolOutputSchema(accountIdOutputSchema),
  chromie_create_position: toolOutputSchema(z.object({
    position: positionOutputSchema
  }).strict()),
  chromie_update_position: toolOutputSchema(z.object({
    position: positionOutputSchema
  }).strict()),
  chromie_create_snapshot: toolOutputSchema(z.object({
    snapshot_id: id,
    exchange_rates_fetched_at: z.string().nullable()
  }).strict()),
  chromie_sync_account: toolOutputSchema(z.object({
    account_id: id,
    position_count: count,
    synced_at: z.string()
  }).strict()),
  chromie_refresh_exchange_rates: toolOutputSchema(z.object({
    exchange_rates: exchangeRatesOutputSchema
  }).strict())
} as const

export type McpToolSuccess = {
  ok: true
  summary: string
  data: unknown
}

export type McpToolError = z.infer<typeof toolErrorOutputSchema>

export type McpAccessSettings = {
  enabled: boolean
  allowWrite: boolean
}

export const DEFAULT_MCP_ACCESS_SETTINGS: McpAccessSettings = {
  enabled: true,
  allowWrite: true
}

export type McpConnectionSettings = {
  access: McpAccessSettings
  command: string
  args: string[]
}

export type McpSocketRequest = {
  id: string
  token: string
  method: 'call-tool'
  tool: McpToolName
  arguments: unknown
}

export type McpSocketResponse =
  | { id: string; result: McpToolSuccess }
  | {
      id: string
      error: {
        code: string
        message: string
        retryable: boolean
        details?: unknown
      }
    }
