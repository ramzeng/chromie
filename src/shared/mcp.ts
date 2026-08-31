import { z } from 'zod'

export const MCP_TOOL_NAMES = [
  'chromie_list_accounts',
  'chromie_get_account',
  'chromie_get_overview',
  'chromie_find_positions',
  'chromie_list_snapshots',
  'chromie_create_account',
  'chromie_update_account',
  'chromie_save_holder',
  'chromie_create_asset_account',
  'chromie_update_asset_account',
  'chromie_save_position',
  'chromie_save_position_group',
  'chromie_set_group_members',
  'chromie_create_snapshot',
  'chromie_sync_asset_account',
  'chromie_refresh_exchange_rates',
  'chromie_delete_item'
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

export const mcpViewSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('latest') }).strict(),
  z.object({ kind: z.literal('snapshot'), snapshot_id: id }).strict()
])

export const listAccountsInputSchema = z.object({}).strict()

export const getAccountInputSchema = z.object({
  account_id: id,
  view: mcpViewSchema.optional(),
  include_positions: z.boolean().optional().default(true)
}).strict()

export const getOverviewInputSchema = z.object({
  account_id: id,
  view: mcpViewSchema.optional(),
  group_by: z.enum(['asset_account', 'position_group', 'currency'])
}).strict()

export const findPositionsInputSchema = z.object({
  account_id: id,
  view: mcpViewSchema.optional(),
  query: z.string().trim().max(80).optional(),
  market: market.optional(),
  currency: currency.optional(),
  asset_account_id: id.optional(),
  holder_id: id.optional(),
  group_id: id.optional(),
  cursor: z.string().regex(/^\d+$/).optional(),
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
    name,
    anchor_currency,
    exchange_rate_provider,
    exchange_rate_refresh_interval_minutes
  }) =>
    name !== undefined ||
    anchor_currency !== undefined ||
    exchange_rate_provider !== undefined ||
    exchange_rate_refresh_interval_minutes !== undefined,
  { message: '至少提供一个要修改的字段' }
)

export const saveHolderInputSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('create'),
    account_id: id,
    name
  }).strict(),
  z.object({
    mode: z.literal('update'),
    account_id: id,
    holder_id: id,
    name
  }).strict()
])

export const createAssetAccountInputSchema = z.object({
  account_id: id,
  name,
  type: assetAccountType,
  holder_id: id
}).strict()

export const updateAssetAccountInputSchema = z.object({
  account_id: id,
  asset_account_id: id,
  name: name.optional(),
  type: assetAccountType.optional(),
  holder_id: id.optional()
}).strict().refine(
  ({ name, type, holder_id }) =>
    name !== undefined || type !== undefined || holder_id !== undefined,
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

export const savePositionInputSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('create'),
    account_id: id,
    asset_account_id: id,
    ...positionCreateFields
  }).strict(),
  z.object({
    mode: z.literal('update'),
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
    ({ market, symbol, name, currency, quantity, price }) =>
      market !== undefined ||
      symbol !== undefined ||
      name !== undefined ||
      currency !== undefined ||
      quantity !== undefined ||
      price !== undefined,
    { message: '至少提供一个要修改的字段' }
  )
])

export const savePositionGroupInputSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('create'),
    account_id: id,
    name
  }).strict(),
  z.object({
    mode: z.literal('update'),
    account_id: id,
    group_id: id,
    name
  }).strict()
])

export const setGroupMembersInputSchema = z.object({
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
  z.object({ kind: z.literal('holder'), account_id: id, holder_id: id }).strict(),
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

export const deleteItemInputSchema = z.object({
  target: deleteTargetSchema
}).strict()

export const mcpToolInputSchemas = {
  chromie_list_accounts: listAccountsInputSchema,
  chromie_get_account: getAccountInputSchema,
  chromie_get_overview: getOverviewInputSchema,
  chromie_find_positions: findPositionsInputSchema,
  chromie_list_snapshots: listSnapshotsInputSchema,
  chromie_create_account: createAccountInputSchema,
  chromie_update_account: updateAccountInputSchema,
  chromie_save_holder: saveHolderInputSchema,
  chromie_create_asset_account: createAssetAccountInputSchema,
  chromie_update_asset_account: updateAssetAccountInputSchema,
  chromie_save_position: savePositionInputSchema,
  chromie_save_position_group: savePositionGroupInputSchema,
  chromie_set_group_members: setGroupMembersInputSchema,
  chromie_create_snapshot: createSnapshotInputSchema,
  chromie_sync_asset_account: syncAssetAccountInputSchema,
  chromie_refresh_exchange_rates: refreshExchangeRatesInputSchema,
  chromie_delete_item: deleteItemInputSchema
} as const

export type McpToolArguments = {
  [Name in McpToolName]: z.infer<(typeof mcpToolInputSchemas)[Name]>
}

export const mcpToolOutputSchema = z.object({
  ok: z.literal(true),
  summary: z.string(),
  data: z.unknown().optional()
})

export type McpToolSuccess = z.infer<typeof mcpToolOutputSchema>
export type McpDeleteTarget = z.infer<typeof deleteTargetSchema>

export type McpAccessSettings = {
  enabled: boolean
  allowWrite: boolean
  allowSync: boolean
  allowDelete: boolean
}

export const DEFAULT_MCP_ACCESS_SETTINGS: McpAccessSettings = {
  enabled: false,
  allowWrite: false,
  allowSync: false,
  allowDelete: false
}

export type McpConnectionSettings = {
  access: McpAccessSettings
  command: string
  args: string[]
}

export type McpSocketRequest =
  | {
      id: string
      token: string
      method: 'call-tool'
      tool: McpToolName
      arguments: unknown
      confirmed?: boolean
    }
  | {
      id: string
      token: string
      method: 'preview-delete'
      arguments: unknown
    }

export type McpSocketResponse =
  | { id: string; result: unknown }
  | {
      id: string
      error: {
        code: string
        message: string
        retryable: boolean
        details?: unknown
      }
    }
