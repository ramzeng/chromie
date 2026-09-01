import { z } from 'zod'

export const MCP_TOOL_NAMES = [
  'chromie_list_accounts',
  'chromie_get_account',
  'chromie_get_overview',
  'chromie_search_positions',
  'chromie_list_snapshots',
  'chromie_create_account',
  'chromie_update_account',
  'chromie_create_account_group',
  'chromie_update_account_group',
  'chromie_replace_account_group_members',
  'chromie_create_asset_account',
  'chromie_update_asset_account',
  'chromie_create_position',
  'chromie_update_position',
  'chromie_create_position_group',
  'chromie_update_position_group',
  'chromie_replace_position_group_members',
  'chromie_create_snapshot',
  'chromie_sync_asset_account',
  'chromie_refresh_exchange_rates',
  'chromie_delete_portfolio_item'
] as const

export type McpToolName = (typeof MCP_TOOL_NAMES)[number]

const id = z.string().trim().min(1).max(128)
const name = z.string().trim().min(1).max(60)
const currency = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,12}$/)
const market = z.enum(['CN', 'HK', 'US', 'CC'])
const anchorCurrency = z.enum(['CNY', 'HKD', 'USD'])
const assetAccountType = z.enum([
  'Futu',
  'Boci',
  'Okx',
  'Ibkr',
  'Binance',
  'Alipay',
  'General',
  'Cmb',
  'Boc'
])
const integrationProvider = z.enum(['Futu', 'Okx', 'Ibkr', 'Binance'])

export const mcpViewSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('latest') }).strict(),
  z.object({ kind: z.literal('snapshot'), snapshot_id: id }).strict()
])

export const listAccountsInputSchema = z.object({}).strict()

export const getAccountInputSchema = z.object({
  account_id: id,
  view: mcpViewSchema.optional(),
  include_positions: z.boolean()
    .describe('是否在账户详情中内嵌持仓；默认 false，持仓较多时请使用查找持仓工具')
    .optional()
    .default(false)
}).strict()

export const getOverviewInputSchema = z.object({
  account_id: id,
  view: mcpViewSchema.optional(),
  group_by: z.enum(['asset_account', 'account_group', 'position_group', 'currency'])
}).strict()

export const searchPositionsInputSchema = z.object({
  account_id: id,
  view: mcpViewSchema.optional(),
  query: z.string().trim().max(80).optional(),
  market: market.optional(),
  currency: currency.optional(),
  asset_account_id: id.optional(),
  account_group_id: id.optional(),
  group_id: id.optional(),
  cursor: z.string()
    .regex(/^[A-Za-z0-9_-]{1,512}$/)
    .describe('上一页返回的不透明游标，必须与相同查询条件一起使用')
    .optional(),
  limit: z.number().int().min(1).max(100).optional().default(50)
}).strict()

export const listSnapshotsInputSchema = z.object({ account_id: id }).strict()

export const createAccountInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
  anchor_currency: anchorCurrency
}).strict()

export const updateAccountInputSchema = z.object({
  account_id: id,
  name: z.string().trim().min(1).max(40).optional(),
  anchor_currency: anchorCurrency.optional(),
  exchange_rate_provider: z.literal('coinbase').optional(),
  exchange_rate_refresh_interval_minutes: z.number().int().min(1).max(1440).optional()
}).strict().refine(
  ({
    name: accountName,
    anchor_currency,
    exchange_rate_provider,
    exchange_rate_refresh_interval_minutes
  }) =>
    accountName !== undefined ||
    anchor_currency !== undefined ||
    exchange_rate_provider !== undefined ||
    exchange_rate_refresh_interval_minutes !== undefined,
  { message: '至少提供一个要修改的字段' }
)

export const createAccountGroupInputSchema = z.object({
  account_id: id,
  name
}).strict()

export const updateAccountGroupInputSchema = z.object({
  account_id: id,
  account_group_id: id,
  name
}).strict()

export const replaceAccountGroupMembersInputSchema = z.object({
  account_id: id,
  account_group_id: id,
  asset_account_ids: z.array(id).max(10000)
}).strict()

export const createAssetAccountInputSchema = z.object({
  account_id: id,
  name,
  type: assetAccountType
}).strict()

export const updateAssetAccountInputSchema = z.object({
  account_id: id,
  asset_account_id: id,
  name: name.optional(),
  type: assetAccountType.optional()
}).strict().refine(
  ({ name: accountName, type }) => accountName !== undefined || type !== undefined,
  { message: '至少提供一个要修改的字段' }
)

const positionCreateFields = {
  market,
  symbol: z.string().trim().min(1).max(24),
  name,
  currency,
  quantity: z.number().finite().positive(),
  price: z.number().finite().nonnegative().nullable().optional()
}

export const createPositionInputSchema = z.object({
  account_id: id,
  asset_account_id: id,
  ...positionCreateFields
}).strict()

export const updatePositionInputSchema = z.object({
  account_id: id,
  asset_account_id: id,
  position_id: id,
  market: market.optional(),
  symbol: z.string().trim().min(1).max(24).optional(),
  name: name.optional(),
  currency: currency.optional(),
  quantity: z.number().finite().positive().optional(),
  price: z.number().finite().nonnegative().nullable().optional()
}).strict().refine(
  ({ market: nextMarket, symbol, name: positionName, currency: nextCurrency, quantity, price }) =>
    nextMarket !== undefined ||
    symbol !== undefined ||
    positionName !== undefined ||
    nextCurrency !== undefined ||
    quantity !== undefined ||
    price !== undefined,
  { message: '至少提供一个要修改的字段' }
)

export const createPositionGroupInputSchema = z.object({
  account_id: id,
  name
}).strict()

export const updatePositionGroupInputSchema = z.object({
  account_id: id,
  group_id: id,
  name
}).strict()

export const replacePositionGroupMembersInputSchema = z.object({
  account_id: id,
  group_id: id,
  position_ids: z.array(id).max(10000)
}).strict()

export const createSnapshotInputSchema = z.object({
  account_id: id
}).strict()

export const syncAssetAccountInputSchema = z.object({
  account_id: id,
  asset_account_id: id
}).strict()

export const refreshExchangeRatesInputSchema = z.object({
  account_id: id.optional()
}).strict()

export const deleteTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('account'), account_id: id }).strict(),
  z.object({
    kind: z.literal('account_group'),
    account_id: id,
    account_group_id: id
  }).strict(),
  z.object({
    kind: z.literal('asset_account'),
    account_id: id,
    asset_account_id: id
  }).strict(),
  z.object({
    kind: z.literal('position'),
    account_id: id,
    asset_account_id: id,
    position_id: id
  }).strict(),
  z.object({ kind: z.literal('position_group'), account_id: id, group_id: id }).strict(),
  z.object({ kind: z.literal('snapshot'), account_id: id, snapshot_id: id }).strict()
])

export const deletePortfolioItemInputSchema = z.object({
  target: deleteTargetSchema
}).strict()

export const mcpToolInputSchemas = {
  chromie_list_accounts: listAccountsInputSchema,
  chromie_get_account: getAccountInputSchema,
  chromie_get_overview: getOverviewInputSchema,
  chromie_search_positions: searchPositionsInputSchema,
  chromie_list_snapshots: listSnapshotsInputSchema,
  chromie_create_account: createAccountInputSchema,
  chromie_update_account: updateAccountInputSchema,
  chromie_create_account_group: createAccountGroupInputSchema,
  chromie_update_account_group: updateAccountGroupInputSchema,
  chromie_replace_account_group_members: replaceAccountGroupMembersInputSchema,
  chromie_create_asset_account: createAssetAccountInputSchema,
  chromie_update_asset_account: updateAssetAccountInputSchema,
  chromie_create_position: createPositionInputSchema,
  chromie_update_position: updatePositionInputSchema,
  chromie_create_position_group: createPositionGroupInputSchema,
  chromie_update_position_group: updatePositionGroupInputSchema,
  chromie_replace_position_group_members: replacePositionGroupMembersInputSchema,
  chromie_create_snapshot: createSnapshotInputSchema,
  chromie_sync_asset_account: syncAssetAccountInputSchema,
  chromie_refresh_exchange_rates: refreshExchangeRatesInputSchema,
  chromie_delete_portfolio_item: deletePortfolioItemInputSchema
} as const

export type McpToolArguments = {
  [Name in McpToolName]: z.infer<(typeof mcpToolInputSchemas)[Name]>
}

const count = z.number().int().nonnegative()
const accountGroupOutputSchema = z.object({
  id,
  name,
  asset_account_ids: z.array(id)
}).strict()
const positionOutputSchema = z.object({
  id,
  market,
  symbol: z.string(),
  name: z.string(),
  currency: z.string(),
  quantity: z.number(),
  price: z.number().nonnegative().optional()
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
const accountOutputSchema = z.object({
  id,
  name: z.string(),
  anchor_currency: anchorCurrency,
  exchange_rate_provider: z.literal('coinbase'),
  exchange_rate_refresh_interval_minutes: z.number().int(),
  account_groups: z.array(accountGroupOutputSchema),
  asset_accounts: z.array(z.object({
    id,
    name: z.string(),
    type: assetAccountType,
    sync: syncStatusOutputSchema,
    position_count: count,
    positions: z.array(positionOutputSchema).optional()
  }).strict()),
  position_groups: z.array(z.object({
    id,
    name: z.string(),
    position_ids: z.array(id)
  }).strict())
}).strict()
const valuationOutputSchema = z.object({
  market_value: z.number().optional(),
  anchored_market_value: z.number().optional(),
  missing_currencies: z.array(z.string())
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

const accountIdOutputSchema = z.object({ account_id: id }).strict()
const assetAccountIdOutputSchema = z.object({ asset_account_id: id }).strict()
const groupIdOutputSchema = z.object({ group_id: id }).strict()

export const mcpToolOutputSchemas = {
  chromie_list_accounts: toolOutputSchema(z.object({
    active_account_id: id.nullable(),
    exchange_rates: exchangeRatesOutputSchema.nullable(),
    accounts: z.array(z.object({
      id,
      name: z.string(),
      anchor_currency: anchorCurrency,
      account_group_count: count,
      asset_account_count: count,
      position_group_count: count,
      position_count: count,
      snapshot_count: count,
      total_anchored_market_value: z.number().optional(),
      missing_currencies: z.array(z.string())
    }).strict())
  }).strict()),
  chromie_get_account: toolOutputSchema(z.object({
    view: viewOutputSchema,
    exchange_rates: exchangeRatesOutputSchema.nullable(),
    account: accountOutputSchema
  }).strict()),
  chromie_get_overview: toolOutputSchema(z.object({
    view: viewOutputSchema,
    group_by: z.enum(['asset_account', 'account_group', 'position_group', 'currency']),
    anchor_currency: anchorCurrency,
    exchange_rates: exchangeRatesOutputSchema.nullable(),
    total: z.object({
      position_count: count,
      anchored_market_value: z.number().optional(),
      missing_currencies: z.array(z.string()),
      complete: z.boolean()
    }).strict(),
    rows: z.array(z.object({
      id: z.string(),
      name: z.string(),
      position_count: count,
      currency: z.string().optional(),
      market_value: z.number().optional(),
      anchored_market_value: z.number().optional(),
      allocation_percent: z.number().optional(),
      missing_currencies: z.array(z.string())
    }).strict())
  }).strict()),
  chromie_search_positions: toolOutputSchema(z.object({
    view: viewOutputSchema,
    total: count,
    positions: z.array(positionOutputSchema.extend({
      asset_account: z.object({ id, name: z.string() }).strict(),
      account_group: accountGroupOutputSchema.nullable(),
      group: z.object({ id, name: z.string() }).strict().nullable(),
      valuation: valuationOutputSchema
    }).strict()),
    next_cursor: z.string().optional()
  }).strict()),
  chromie_list_snapshots: toolOutputSchema(z.object({
    account: z.object({ id, name: z.string() }).strict(),
    snapshots: z.array(z.object({
      id,
      created_at: z.string(),
      asset_account_count: count,
      position_group_count: count,
      position_count: count,
      exchange_rates_fetched_at: z.string().nullable()
    }).strict())
  }).strict()),
  chromie_create_account: toolOutputSchema(accountIdOutputSchema),
  chromie_update_account: toolOutputSchema(accountIdOutputSchema),
  chromie_create_account_group: toolOutputSchema(
    z.object({ account_group: accountGroupOutputSchema }).strict()
  ),
  chromie_update_account_group: toolOutputSchema(
    z.object({ account_group: accountGroupOutputSchema }).strict()
  ),
  chromie_replace_account_group_members: toolOutputSchema(z.object({
    account_group_id: id,
    asset_account_ids: z.array(id)
  }).strict()),
  chromie_create_asset_account: toolOutputSchema(assetAccountIdOutputSchema),
  chromie_update_asset_account: toolOutputSchema(assetAccountIdOutputSchema),
  chromie_create_position: toolOutputSchema(z.object({
    position: positionOutputSchema
  }).strict()),
  chromie_update_position: toolOutputSchema(z.object({
    position: positionOutputSchema
  }).strict()),
  chromie_create_position_group: toolOutputSchema(groupIdOutputSchema),
  chromie_update_position_group: toolOutputSchema(groupIdOutputSchema),
  chromie_replace_position_group_members: toolOutputSchema(z.object({
    group_id: id,
    position_ids: z.array(id)
  }).strict()),
  chromie_create_snapshot: toolOutputSchema(z.object({
    snapshot_id: id,
    exchange_rates_fetched_at: z.string().nullable()
  }).strict()),
  chromie_sync_asset_account: toolOutputSchema(z.object({
    asset_account_id: id,
    position_count: count,
    synced_at: z.string()
  }).strict()),
  chromie_refresh_exchange_rates: toolOutputSchema(z.object({
    exchange_rates: exchangeRatesOutputSchema
  }).strict()),
  chromie_delete_portfolio_item: toolOutputSchema(z.object({
    target: deleteTargetSchema
  }).strict())
} as const

export type McpToolSuccess = {
  ok: true
  summary: string
  data: unknown
}

export type McpToolError = z.infer<typeof toolErrorOutputSchema>
export type McpDeleteTarget = z.infer<typeof deleteTargetSchema>

export type McpAccessSettings = {
  enabled: boolean
  allowWrite: boolean
  allowDelete: boolean
}

export const DEFAULT_MCP_ACCESS_SETTINGS: McpAccessSettings = {
  enabled: false,
  allowWrite: false,
  allowDelete: false
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
