import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createIbkrPositionsSync,
  type CreateIbkrGatewayClient,
  type IbkrGatewayClient,
  type IbkrGatewayContract
} from '../src/main/infra/ibkr'

type PortfolioUpdate = {
  contract: IbkrGatewayContract
  position: unknown
  marketPrice: unknown
  marketValue: unknown
}

type AccountValue = {
  key: string
  value: unknown
  currency: string
}

type AccountFixture = {
  positions?: PortfolioUpdate[]
  values?: AccountValue[]
}

class FakeGatewayClient implements IbkrGatewayClient {
  readonly subscriptions: Array<{ subscribe: boolean; account?: string }> = []
  disconnected = false
  disposed = false
  clientId?: number

  private connectedListener: () => void = () => undefined
  private disconnectedListener: () => void = () => undefined
  private errorListener: (error: Error, code: number) => void = () => undefined
  private managedAccountsListener: (accounts: string) => void = () => undefined
  private portfolioListener: (
    contract: IbkrGatewayContract,
    position: unknown,
    marketPrice: unknown,
    marketValue: unknown,
    accountName?: string
  ) => void = () => undefined
  private accountValueListener: (
    key: string,
    value: unknown,
    currency: string,
    accountName: string
  ) => void = () => undefined
  private accountDownloadEndListener: (accountName: string) => void = () => undefined

  constructor(
    private readonly fixtures: Record<string, AccountFixture>,
    private readonly connectionFailure?: { error: Error; code: number },
    private readonly connectionWarnings: Array<{ error: Error; code: number }> = []
  ) {}

  connect(clientId: number): void {
    this.clientId = clientId
    queueMicrotask(() => {
      if (this.connectionFailure) {
        this.errorListener(this.connectionFailure.error, this.connectionFailure.code)
      } else {
        this.connectionWarnings.forEach(({ error, code }) => this.errorListener(error, code))
        this.connectedListener()
      }
    })
  }

  disconnect(): void {
    this.disconnected = true
  }

  requestManagedAccounts(): void {
    queueMicrotask(() => this.managedAccountsListener(Object.keys(this.fixtures).join(',')))
  }

  requestAccountUpdates(subscribe: boolean, account?: string): void {
    this.subscriptions.push({ subscribe, account })
    if (!subscribe || !account) return
    const fixture = this.fixtures[account] ?? {}
    queueMicrotask(() => {
      fixture.positions?.forEach(({ contract, position, marketPrice, marketValue }) => {
        this.portfolioListener(contract, position, marketPrice, marketValue, account)
      })
      fixture.values?.forEach(({ key, value, currency }) => {
        this.accountValueListener(key, value, currency, account)
      })
      this.accountDownloadEndListener(account)
    })
  }

  onConnected(listener: () => void): void {
    this.connectedListener = listener
  }

  onDisconnected(listener: () => void): void {
    this.disconnectedListener = listener
  }

  onError(listener: (error: Error, code: number) => void): void {
    this.errorListener = listener
  }

  onManagedAccounts(listener: (accounts: string) => void): void {
    this.managedAccountsListener = listener
  }

  onPortfolioUpdate(
    listener: (
      contract: IbkrGatewayContract,
      position: unknown,
      marketPrice: unknown,
      marketValue: unknown,
      accountName?: string
    ) => void
  ): void {
    this.portfolioListener = listener
  }

  onAccountValue(
    listener: (key: string, value: unknown, currency: string, accountName: string) => void
  ): void {
    this.accountValueListener = listener
  }

  onAccountDownloadEnd(listener: (accountName: string) => void): void {
    this.accountDownloadEndListener = listener
  }

  dispose(): void {
    this.disposed = true
  }
}

test('syncs IB Gateway portfolios and currency cash for managed accounts sequentially', async () => {
  const client = new FakeGatewayClient(
    {
      DU1: {
        positions: [
          {
            contract: {
              conId: 1,
              symbol: 'AAPL',
              localSymbol: 'AAPL',
              description: 'Apple Inc.',
              currency: 'USD'
            },
            position: 2,
            marketPrice: 100,
            marketValue: 200
          },
          {
            contract: {
              conId: 2,
              symbol: '700',
              localSymbol: '700',
              description: 'Tencent',
              currency: 'HKD'
            },
            position: 5,
            marketPrice: 300,
            marketValue: 1500
          },
          {
            contract: { conId: 3, symbol: 'MSFT', currency: 'USD' },
            position: 1,
            marketPrice: 200,
            marketValue: 200
          },
          {
            contract: { conId: 3, symbol: 'MSFT', currency: 'USD' },
            position: 0,
            marketPrice: 200,
            marketValue: 0
          }
        ],
        values: [
          { key: 'TotalCashValue', value: '999', currency: 'USD' },
          { key: 'CashBalance', value: '100', currency: 'USD' },
          { key: 'TotalCashBalance', value: '90', currency: 'USD' },
          { key: 'CashBalance', value: '200', currency: 'HKD' },
          { key: 'CashBalance', value: '12345', currency: 'BASE' },
          { key: 'AccountReady', value: 'true', currency: '' }
        ]
      },
      DU2: {
        positions: [
          {
            contract: {
              conId: 1,
              symbol: 'AAPL',
              localSymbol: 'AAPL',
              description: 'Apple Inc.',
              currency: 'USD'
            },
            position: 3,
            marketPrice: 110,
            marketValue: 330
          }
        ],
        values: [
          { key: 'CashBalance', value: '50', currency: 'USD' },
          { key: 'AccountReady', value: 'true', currency: '' }
        ]
      }
    },
    undefined,
    [{ error: new Error('Market data farm connection is OK'), code: 2104 }]
  )
  const sync = createIbkrPositionsSync((options) => {
    assert.deepEqual(options, { host: '127.0.0.1', port: 4002 })
    return client
  }, 100)

  const result = await sync()

  assert.equal(result.accountCount, 2)
  assert.ok(!Number.isNaN(Date.parse(result.syncedAt)))
  assert.deepEqual(result.positions, [
    {
      market: 'HK',
      symbol: '00700',
      name: 'Tencent',
      currency: 'HKD',
      quantity: 5,
      price: 300
    },
    {
      market: 'US',
      symbol: 'AAPL',
      name: 'Apple Inc.',
      currency: 'USD',
      quantity: 5,
      price: 106
    },
    {
      market: 'HK',
      symbol: 'CASH',
      name: '现金',
      currency: 'HKD',
      quantity: 200,
      price: 1
    },
    {
      market: 'US',
      symbol: 'CASH',
      name: '现金',
      currency: 'USD',
      quantity: 150,
      price: 1
    }
  ])
  assert.deepEqual(client.subscriptions, [
    { subscribe: true, account: 'DU1' },
    { subscribe: false, account: 'DU1' },
    { subscribe: true, account: 'DU2' },
    { subscribe: false, account: 'DU2' }
  ])
  assert.ok(client.clientId && client.clientId >= 1 && client.clientId < 32_768)
  assert.equal(client.disconnected, true)
  assert.equal(client.disposed, true)
})

test('rejects non-loopback IB Gateway addresses before creating a socket client', async () => {
  let created = false
  const createClient: CreateIbkrGatewayClient = () => {
    created = true
    return new FakeGatewayClient({})
  }
  const sync = createIbkrPositionsSync(createClient, 100)

  await assert.rejects(sync({ host: '192.0.2.1', port: 4002 }), /仅允许连接本地地址/)
  assert.equal(created, false)
})

test('reports an actionable IB Gateway connection failure and cleans up', async () => {
  const client = new FakeGatewayClient({}, {
    error: new Error("Couldn't connect to TWS"),
    code: 502
  })
  const sync = createIbkrPositionsSync(() => client, 100)

  await assert.rejects(
    sync({ host: 'localhost', port: 4002 }),
    /无法连接 IB Gateway（localhost:4002）.*ActiveX and Socket Clients/
  )
  assert.equal(client.disconnected, true)
  assert.equal(client.disposed, true)
})

test('rejects a snapshot while the IB account is not ready', async () => {
  const client = new FakeGatewayClient({
    DU1: {
      values: [{ key: 'AccountReady', value: 'false', currency: '' }]
    }
  })
  const sync = createIbkrPositionsSync(() => client, 100)

  await assert.rejects(sync(), /账户数据尚未就绪（DU1）/)
  assert.deepEqual(client.subscriptions, [
    { subscribe: true, account: 'DU1' },
    { subscribe: false, account: 'DU1' }
  ])
  assert.equal(client.disconnected, true)
  assert.equal(client.disposed, true)
})
