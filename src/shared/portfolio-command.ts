import { z } from 'zod'

import { CRYPTO_QUOTE_PROVIDERS, STOCK_QUOTE_PROVIDERS } from './asset-quotes'
import {
  EXCHANGE_RATE_PROVIDERS,
  MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES,
  MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES
} from './exchange-rates'
import { MAX_TAG_NOTE_LENGTH, TAG_COLORS } from './portfolio'
import { PROXY_PROTOCOLS } from './integrations'

const id = z.string().trim().min(1).max(128)
const accountName = z.string().trim().min(1).max(50)
const positionName = z.string().trim().min(1).max(60)
const tagName = z.string().trim().min(1).max(40)
const tagNote = z.string().trim().max(MAX_TAG_NOTE_LENGTH)
const host = z.string().trim().min(1).max(253)
const port = z.number().int().min(1).max(65535)
const secret = z.string().min(1).max(512)
const tagIds = z.array(id).max(1000)
const market = z.enum(['CN', 'CN_OTC', 'HK', 'US', 'CC'])
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

const optionalCredential = <T extends z.ZodType>(value: T) =>
  z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('keep') }).strict(),
    z.object({ mode: z.literal('clear') }).strict(),
    z.object({ mode: z.literal('replace'), value }).strict()
  ])

const requiredCredential = <T extends z.ZodType>(value: T) =>
  z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('keep') }).strict(),
    z.object({ mode: z.literal('replace'), value }).strict()
  ])

const accountNetworkRoute = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('system') }).strict(),
  z.object({ mode: z.literal('direct') }).strict(),
  z.object({ mode: z.literal('proxy'), proxyProfileId: id }).strict()
])

const proxyProfileInput = z.object({
  name: z.string().trim().min(1).max(50),
  protocol: z.enum(PROXY_PROTOCOLS),
  host,
  port,
  credential: optionalCredential(
    z.object({
      username: z.string().trim().min(1).max(256),
      password: secret
    }).strict()
  )
}).strict()

const integration = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('Futu'),
    websocket: z.object({
      host,
      port,
      credential: optionalCredential(
        z.object({ key: secret }).strict()
      )
    }).strict()
  }).strict(),
  z.object({
    provider: z.literal('Ibkr'),
    gateway: z.object({ host, port }).strict()
  }).strict(),
  z.object({
    provider: z.literal('Hstong'),
    gateway: z.object({
      host,
      port,
      credential: optionalCredential(
        z.object({ tradingPassword: z.string().min(1).max(256) }).strict()
      )
    }).strict()
  }).strict(),
  z.object({
    provider: z.literal('Okx'),
    api: z.object({
      credential: requiredCredential(
        z.object({
          apiKey: z.string().trim().min(1).max(256),
          secretKey: secret,
          passphrase: z.string().min(1).max(256)
        }).strict()
      )
    }).strict(),
    network: accountNetworkRoute.optional()
  }).strict(),
  z.object({
    provider: z.literal('Binance'),
    api: z.object({
      credential: requiredCredential(
        z.object({
          apiKey: z.string().trim().min(1).max(256),
          secretKey: secret
        }).strict()
      )
    }).strict(),
    network: accountNetworkRoute.optional()
  }).strict()
])

const accountInput = z.object({
  name: accountName,
  type: accountType,
  sync: z.object({
    interval: z.number().int().min(5).max(3600),
    lastSyncedAt: z.iso.datetime().optional()
  }).strict().optional(),
  tagIds: tagIds.optional(),
  integration: integration.optional()
}).strict()

const positionInput = z.object({
  market,
  symbol: z.string().trim().min(1).max(24),
  name: positionName,
  currency: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,12}$/),
  quantity: z.number().finite().positive(),
  price: z.number().finite().nonnegative().optional(),
  tagIds: tagIds.optional()
}).strict()

const tagInput = z.object({
  name: tagName,
  color: z.enum(TAG_COLORS),
  note: tagNote
}).strict()

const workspaceInput = z.object({
  name: z.string().trim().min(1).max(40),
  baseCurrency
}).strict()

const workspaceSettingsInput = workspaceInput.extend({
  exchangeRateProvider: z.enum(EXCHANGE_RATE_PROVIDERS),
  exchangeRateRefreshIntervalMinutes: z.number()
    .int()
    .min(MIN_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES)
    .max(MAX_EXCHANGE_RATE_REFRESH_INTERVAL_MINUTES),
  stockQuoteProvider: z.enum(STOCK_QUOTE_PROVIDERS),
  cryptoQuoteProvider: z.enum(CRYPTO_QUOTE_PROVIDERS)
}).strict()

const exchangeRateSnapshot = z.object({
  provider: z.enum(EXCHANGE_RATE_PROVIDERS),
  baseCurrency: z.literal('USD'),
  rates: z.record(z.string(), z.number().finite().positive()),
  fetchedAt: z.iso.datetime()
}).strict()

export const portfolioCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('set-active-workspace'), id }).strict(),
  z.object({
    type: z.literal('create-snapshot'),
    workspaceId: id,
    exchangeRates: exchangeRateSnapshot.nullable().optional()
  }).strict(),
  z.object({ type: z.literal('delete-snapshot'), snapshotId: id }).strict(),
  z.object({
    type: z.literal('create-workspace'),
    input: workspaceInput
  }).strict(),
  z.object({
    type: z.literal('update-workspace'),
    id,
    input: workspaceSettingsInput
  }).strict(),
  z.object({ type: z.literal('delete-workspace'), id }).strict(),
  z.object({ type: z.literal('create-tag'), workspaceId: id, input: tagInput }).strict(),
  z.object({
    type: z.literal('update-tag'),
    workspaceId: id,
    tagId: id,
    input: tagInput
  }).strict(),
  z.object({ type: z.literal('delete-tag'), workspaceId: id, tagId: id }).strict(),
  z.object({
    type: z.literal('set-account-tags'),
    workspaceId: id,
    accountId: id,
    tagIds
  }).strict(),
  z.object({
    type: z.literal('set-position-tags'),
    workspaceId: id,
    accountId: id,
    positionId: id,
    tagIds
  }).strict(),
  z.object({
    type: z.literal('create-account'),
    workspaceId: id,
    input: accountInput
  }).strict(),
  z.object({
    type: z.literal('update-account'),
    workspaceId: id,
    accountId: id,
    input: accountInput
  }).strict(),
  z.object({
    type: z.literal('delete-account'),
    workspaceId: id,
    accountId: id
  }).strict(),
  z.object({
    type: z.literal('create-proxy-profile'),
    input: proxyProfileInput
  }).strict(),
  z.object({
    type: z.literal('update-proxy-profile'),
    id,
    input: proxyProfileInput
  }).strict(),
  z.object({ type: z.literal('delete-proxy-profile'), id }).strict(),
  z.object({
    type: z.literal('save-position'),
    workspaceId: id,
    accountId: id,
    input: positionInput,
    positionId: id.optional()
  }).strict(),
  z.object({
    type: z.literal('delete-position'),
    workspaceId: id,
    accountId: id,
    positionId: id
  }).strict()
])

export const portfolioAccountTargetSchema = z.object({
  workspaceId: id,
  accountId: id
}).strict()

export const portfolioProxyTestSchema = z.object({
  profileId: id,
  target: z.enum(['okx', 'binance'])
}).strict()
