import type { ExchangeRateSnapshot } from './exchange-rates'
import type { Market, Workspace, WorkspaceSnapshot } from './portfolio'

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000

const EXAMPLE_POSITION_PRICES = {
  'example-position-aapl': 235,
  'example-position-btc': 112_000,
  'example-position-eth': 4_400,
  'example-position-gold-etf': 7.6,
  'example-position-hang-seng-etf': 26,
  'example-position-maotai': 1_440,
  'example-position-microsoft': 510,
  'example-position-money-market': 100.2,
  'example-position-csi300-etf': 4.2,
  'example-position-schd': 28.5,
  'example-position-sol': 210,
  'example-position-tencent': 610,
  'example-position-voo': 550
} as const

function createExchangeRates(fetchedAt: string): ExchangeRateSnapshot {
  return {
    provider: 'coinbase',
    baseCurrency: 'USD',
    rates: {
      USD: 1,
      CNY: 7.15,
      HKD: 7.78
    },
    fetchedAt
  }
}

function createWorkspace(): Workspace {
  return {
    id: 'example-workspace',
    name: '示例工作区',
    baseCurrency: 'CNY',
    exchangeRateProvider: 'coinbase',
    exchangeRateRefreshIntervalMinutes: 15,
    stockQuoteProvider: 'eastmoney',
    cryptoQuoteProvider: 'coinbase',
    tags: [
      { id: 'example-tag-core', name: '核心持仓', color: 'blue' },
      { id: 'example-tag-growth', name: '成长', color: 'purple' },
      { id: 'example-tag-steady', name: '稳健', color: 'green' },
      { id: 'example-tag-income', name: '现金流', color: 'orange' },
      { id: 'example-tag-overseas', name: '海外配置', color: 'gray' },
      { id: 'example-tag-digital', name: '数字资产', color: 'yellow' }
    ],
    accounts: [
      {
        id: 'example-account-cn-hk',
        name: 'A 股与港股',
        type: 'Futu',
        tagIds: ['example-tag-core'],
        positions: [
          {
            id: 'example-position-maotai',
            market: 'CN',
            symbol: '600519',
            name: '贵州茅台',
            currency: 'CNY',
            quantity: 100,
            price: EXAMPLE_POSITION_PRICES['example-position-maotai'],
            tagIds: ['example-tag-core', 'example-tag-steady']
          },
          {
            id: 'example-position-csi300-etf',
            market: 'CN',
            symbol: '510300',
            name: '沪深300ETF',
            currency: 'CNY',
            quantity: 20_000,
            price: EXAMPLE_POSITION_PRICES['example-position-csi300-etf'],
            tagIds: ['example-tag-steady']
          },
          {
            id: 'example-position-tencent',
            market: 'HK',
            symbol: '00700',
            name: '腾讯控股',
            currency: 'HKD',
            quantity: 400,
            price: EXAMPLE_POSITION_PRICES['example-position-tencent'],
            tagIds: ['example-tag-core', 'example-tag-growth']
          },
          {
            id: 'example-position-hang-seng-etf',
            market: 'HK',
            symbol: '02800',
            name: '盈富基金',
            currency: 'HKD',
            quantity: 5_000,
            price: EXAMPLE_POSITION_PRICES['example-position-hang-seng-etf'],
            tagIds: ['example-tag-steady', 'example-tag-income']
          }
        ]
      },
      {
        id: 'example-account-us',
        name: '美股长期账户',
        type: 'Ibkr',
        tagIds: ['example-tag-overseas'],
        positions: [
          {
            id: 'example-position-aapl',
            market: 'US',
            symbol: 'AAPL',
            name: 'Apple',
            currency: 'USD',
            quantity: 80,
            price: EXAMPLE_POSITION_PRICES['example-position-aapl'],
            tagIds: ['example-tag-growth', 'example-tag-overseas']
          },
          {
            id: 'example-position-microsoft',
            market: 'US',
            symbol: 'MSFT',
            name: 'Microsoft',
            currency: 'USD',
            quantity: 50,
            price: EXAMPLE_POSITION_PRICES['example-position-microsoft'],
            tagIds: ['example-tag-core', 'example-tag-overseas']
          },
          {
            id: 'example-position-voo',
            market: 'US',
            symbol: 'VOO',
            name: 'Vanguard S&P 500 ETF',
            currency: 'USD',
            quantity: 30,
            price: EXAMPLE_POSITION_PRICES['example-position-voo'],
            tagIds: ['example-tag-steady', 'example-tag-overseas']
          },
          {
            id: 'example-position-schd',
            market: 'US',
            symbol: 'SCHD',
            name: 'Schwab U.S. Dividend Equity ETF',
            currency: 'USD',
            quantity: 200,
            price: EXAMPLE_POSITION_PRICES['example-position-schd'],
            tagIds: ['example-tag-income', 'example-tag-overseas']
          }
        ]
      },
      {
        id: 'example-account-steady',
        name: '现金与稳健配置',
        type: 'Cmb',
        tagIds: ['example-tag-steady'],
        positions: [
          {
            id: 'example-position-money-market',
            market: 'CN',
            symbol: '511880',
            name: '银华日利',
            currency: 'CNY',
            quantity: 2_000,
            price: EXAMPLE_POSITION_PRICES['example-position-money-market'],
            tagIds: ['example-tag-steady', 'example-tag-income']
          },
          {
            id: 'example-position-gold-etf',
            market: 'CN',
            symbol: '518880',
            name: '黄金ETF',
            currency: 'CNY',
            quantity: 3_000,
            price: EXAMPLE_POSITION_PRICES['example-position-gold-etf'],
            tagIds: ['example-tag-steady']
          }
        ]
      },
      {
        id: 'example-account-digital',
        name: '数字资产账户',
        type: 'Okx',
        tagIds: ['example-tag-digital'],
        positions: [
          {
            id: 'example-position-btc',
            market: 'CC',
            symbol: 'BTC',
            name: 'Bitcoin',
            currency: 'USD',
            quantity: 0.08,
            price: EXAMPLE_POSITION_PRICES['example-position-btc'],
            tagIds: ['example-tag-core', 'example-tag-digital']
          },
          {
            id: 'example-position-eth',
            market: 'CC',
            symbol: 'ETH',
            name: 'Ethereum',
            currency: 'USD',
            quantity: 2,
            price: EXAMPLE_POSITION_PRICES['example-position-eth'],
            tagIds: ['example-tag-growth', 'example-tag-digital']
          },
          {
            id: 'example-position-sol',
            market: 'CC',
            symbol: 'SOL',
            name: 'Solana',
            currency: 'USD',
            quantity: 30,
            price: EXAMPLE_POSITION_PRICES['example-position-sol'],
            tagIds: ['example-tag-growth', 'example-tag-digital']
          }
        ]
      }
    ]
  }
}

function createHistoricalWorkspace(
  workspace: Workspace,
  priceMultipliers: Record<Market, number>
): Workspace {
  return {
    ...workspace,
    tags: workspace.tags.map((tag) => ({ ...tag })),
    accounts: workspace.accounts.map((account) => ({
      ...account,
      tagIds: [...account.tagIds],
      positions: account.positions.map((position) => ({
        ...position,
        tagIds: [...position.tagIds],
        price: position.price === undefined
          ? undefined
          : Math.round(
              position.price * priceMultipliers[position.market] * 100
            ) / 100
      }))
    }))
  }
}

export type ExampleWorkspaceData = {
  workspace: Workspace
  snapshots: WorkspaceSnapshot[]
  exchangeRates: ExchangeRateSnapshot
}

export function createExampleWorkspaceData(
  now = new Date()
): ExampleWorkspaceData {
  const workspace = createWorkspace()
  const currentTime = now.getTime()
  const historicalStates: Array<{
    id: string
    daysAgo: number
    priceMultipliers: Record<Market, number>
  }> = [
    {
      id: 'example-snapshot-30-days',
      daysAgo: 30,
      priceMultipliers: {
        CN: 0.98,
        CN_OTC_FUND: 0.98,
        HK: 0.96,
        US: 0.95,
        CC: 0.9
      }
    },
    {
      id: 'example-snapshot-90-days',
      daysAgo: 90,
      priceMultipliers: {
        CN: 0.94,
        CN_OTC_FUND: 0.94,
        HK: 0.91,
        US: 0.88,
        CC: 0.78
      }
    },
    {
      id: 'example-snapshot-180-days',
      daysAgo: 180,
      priceMultipliers: {
        CN: 0.91,
        CN_OTC_FUND: 0.91,
        HK: 0.84,
        US: 0.82,
        CC: 0.64
      }
    },
    {
      id: 'example-snapshot-365-days',
      daysAgo: 365,
      priceMultipliers: {
        CN: 0.86,
        CN_OTC_FUND: 0.86,
        HK: 0.76,
        US: 0.72,
        CC: 0.52
      }
    }
  ]

  return {
    workspace,
    exchangeRates: createExchangeRates(now.toISOString()),
    snapshots: historicalStates.map(({ id, daysAgo, priceMultipliers }) => {
      const createdAt = new Date(
        currentTime - daysAgo * DAY_IN_MILLISECONDS
      ).toISOString()
      return {
        id,
        workspaceId: workspace.id,
        createdAt,
        workspace: createHistoricalWorkspace(workspace, priceMultipliers),
        exchangeRates: createExchangeRates(createdAt)
      }
    })
  }
}
