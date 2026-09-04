import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import test from 'node:test'

import { createProxyFetch, type FetchLike } from '../src/main/infra/proxy-http'
import {
  DesktopService,
  type DesktopServiceDependencies
} from '../src/main/service/desktop-service'
import type { ProxyProfile } from '../src/shared/integrations'

function emptySyncResult() {
  return Promise.resolve({ positions: [], syncedAt: '2026-09-04T00:00:00.000Z' })
}

test('desktop service selects system, direct and explicit proxy routes without fallback', async () => {
  const calls: string[] = []
  const makeFetch = (name: string): FetchLike => async () => {
    calls.push(name)
    return new Response('{}')
  }
  const dependencies = {
    syncFutuPositions: async () => ({
      ...(await emptySyncResult()),
      accountCount: 0
    }),
    syncOkxPositions: async (_options, fetchImpl) => {
      await fetchImpl('https://www.okx.com/api/v5/public/time')
      return emptySyncResult()
    },
    syncBinancePositions: async (_options, fetchImpl) => {
      await fetchImpl('https://api.binance.com/api/v3/time')
      return emptySyncResult()
    },
    syncIbkrPositions: async () => ({
      ...(await emptySyncResult()),
      accountCount: 0
    }),
    syncHstongPositions: async () => ({
      ...(await emptySyncResult()),
      marketCount: 0
    }),
    fetchExchangeRates: async () => {
      throw new Error('unused')
    },
    loadExchangeRates: async () => null,
    exportBackup: async () => ({ canceled: true }),
    importBackup: async () => ({ canceled: true }),
    systemFetch: makeFetch('system'),
    directFetch: makeFetch('direct'),
    createProxyFetch: () => makeFetch('proxy'),
    testProxyConnection: async (_profile, target) => ({ target, latencyMs: 1 })
  } satisfies DesktopServiceDependencies
  const desktop = new DesktopService(dependencies)
  const profile: ProxyProfile = {
    id: 'proxy-1',
    name: '香港代理',
    protocol: 'socks5h',
    host: 'proxy.example.com',
    port: 1080
  }

  await desktop.syncPositions({
    provider: 'okx',
    network: { route: { mode: 'system' } }
  })
  await desktop.syncPositions({
    provider: 'binance',
    network: { route: { mode: 'direct' } }
  })
  await desktop.syncPositions({
    provider: 'okx',
    network: {
      route: { mode: 'proxy', proxyProfileId: profile.id },
      proxyProfile: profile
    }
  })
  assert.deepEqual(calls, ['system', 'direct', 'proxy'])

  await assert.rejects(
    async () =>
      desktop.syncPositions({
        provider: 'okx',
        network: { route: { mode: 'proxy', proxyProfileId: 'missing' } }
      }),
    /代理配置已不存在/
  )
  assert.deepEqual(calls, ['system', 'direct', 'proxy'])
})

test('socks5h proxy sends credentials and remote hostname without leaking the password in errors', async () => {
  let receivedUsername = ''
  let receivedPassword = ''
  let receivedHostname = ''
  const connectionRequest = new Promise<void>((resolve) => {
    const server = createServer((socket) => {
      let stage = 0
      let buffered = Buffer.alloc(0)
      socket.on('data', (chunk) => {
        buffered = Buffer.concat([buffered, chunk])
        while (true) {
          if (stage === 0) {
            if (buffered.length < 2 + (buffered[1] ?? 0)) return
            buffered = buffered.subarray(2 + buffered[1])
            socket.write(Buffer.from([5, 2]))
            stage = 1
          } else if (stage === 1) {
            const usernameLength = buffered[1] ?? 0
            if (buffered.length < 3 + usernameLength) return
            const passwordLength = buffered[2 + usernameLength] ?? 0
            if (buffered.length < 3 + usernameLength + passwordLength) return
            receivedUsername = buffered.subarray(2, 2 + usernameLength).toString()
            receivedPassword = buffered
              .subarray(3 + usernameLength, 3 + usernameLength + passwordLength)
              .toString()
            buffered = buffered.subarray(3 + usernameLength + passwordLength)
            socket.write(Buffer.from([1, 0]))
            stage = 2
          } else {
            if (buffered.length < 5) return
            assert.equal(buffered[3], 3)
            const hostnameLength = buffered[4]
            if (buffered.length < 7 + hostnameLength) return
            receivedHostname = buffered.subarray(5, 5 + hostnameLength).toString()
            socket.end(Buffer.from([5, 5, 0, 1, 0, 0, 0, 0, 0, 0]))
            resolve()
            return
          }
        }
      })
    })
    server.listen(0, '127.0.0.1', async () => {
      const address = server.address()
      assert(address && typeof address === 'object')
      const profile: ProxyProfile = {
        id: 'proxy-1',
        name: '香港代理',
        protocol: 'socks5h',
        host: '127.0.0.1',
        port: address.port,
        username: 'gentoo',
        password: 'proxy-password-secret'
      }
      await assert.rejects(
        createProxyFetch(profile)('https://www.okx.com/api/v5/public/time'),
        (error: Error) => {
          assert.match(error.message, /代理“香港代理”连接失败/)
          assert.equal(error.message.includes('proxy-password-secret'), false)
          return true
        }
      )
      server.close()
    })
  })

  await connectionRequest
  assert.equal(receivedUsername, 'gentoo')
  assert.equal(receivedPassword, 'proxy-password-secret')
  assert.equal(receivedHostname, 'www.okx.com')
})
