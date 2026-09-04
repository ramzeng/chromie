import { request as httpsRequest } from 'node:https'

import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'

import type {
  ProxyProfile,
  ProxyTestResult,
  ProxyTestTarget
} from '../../shared/integrations'

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>

const MAX_RESPONSE_BYTES = 10 * 1024 * 1024
const PROXY_TEST_TIMEOUT_MS = 10_000

function createProxyUrl(profile: ProxyProfile): URL {
  const url = new URL(`${profile.protocol}://localhost`)
  url.hostname = profile.host.includes(':') ? `[${profile.host}]` : profile.host
  url.port = String(profile.port)
  if (profile.username && profile.password) {
    url.username = profile.username
    url.password = profile.password
  }
  return url
}

function safeProxyError(error: unknown, profile: ProxyProfile): Error {
  const proxyUrl = createProxyUrl(profile)
  const raw = (error instanceof Error ? error.message : String(error)).replace(
    /\b(https?|socks5h?):\/\/[^@\s]+@/gi,
    '$1://***@'
  )
  const secrets = [
    profile.username,
    profile.password,
    profile.username ? encodeURIComponent(profile.username) : undefined,
    profile.password ? encodeURIComponent(profile.password) : undefined,
    proxyUrl.username,
    proxyUrl.password
  ].filter((value): value is string => Boolean(value))
  const message = secrets.reduce((current, secret) => current.replaceAll(secret, '***'), raw)
  return new Error(`代理“${profile.name}”连接失败：${message}`)
}

function requestBody(body: BodyInit | null | undefined): string | Buffer | undefined {
  if (body === undefined || body === null) return undefined
  if (typeof body === 'string') return body
  if (body instanceof URLSearchParams) return body.toString()
  if (body instanceof ArrayBuffer) return Buffer.from(body)
  if (ArrayBuffer.isView(body)) {
    return Buffer.from(body.buffer, body.byteOffset, body.byteLength)
  }
  throw new Error('代理请求暂不支持流式请求体')
}

export function createProxyFetch(profile: ProxyProfile): FetchLike {
  const proxyUrl = createProxyUrl(profile)
  const agent =
    profile.protocol === 'http' || profile.protocol === 'https'
      ? new HttpsProxyAgent(proxyUrl)
      : new SocksProxyAgent(proxyUrl)

  return async (input, init = {}) => {
    const url = input instanceof URL ? input : new URL(input)
    if (url.protocol !== 'https:') {
      throw new Error('显式代理仅允许访问 HTTPS 地址')
    }
    const headers = Object.fromEntries(new Headers(init.headers).entries())
    const body = requestBody(init.body)
    if (body !== undefined && headers['content-length'] === undefined) {
      headers['content-length'] = String(Buffer.byteLength(body))
    }

    try {
      return await new Promise<Response>((resolve, reject) => {
        const request = httpsRequest(
          url,
          {
            method: init.method ?? (body === undefined ? 'GET' : 'POST'),
            headers,
            agent,
            signal: init.signal ?? undefined
          },
          (response) => {
            const chunks: Buffer[] = []
            let receivedBytes = 0
            response.on('data', (chunk: Buffer | string) => {
              const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
              receivedBytes += buffer.byteLength
              if (receivedBytes > MAX_RESPONSE_BYTES) {
                request.destroy(new Error('响应内容超过大小限制'))
                return
              }
              chunks.push(buffer)
            })
            response.once('end', () => {
              const responseHeaders = new Headers()
              Object.entries(response.headers).forEach(([name, value]) => {
                if (Array.isArray(value)) {
                  value.forEach((item) => responseHeaders.append(name, item))
                } else if (value !== undefined) {
                  responseHeaders.set(name, value)
                }
              })
              resolve(
                new Response(Buffer.concat(chunks), {
                  status: response.statusCode ?? 500,
                  statusText: response.statusMessage,
                  headers: responseHeaders
                })
              )
            })
            response.once('error', reject)
          }
        )
        request.once('error', reject)
        if (body !== undefined) request.write(body)
        request.end()
      })
    } catch (error) {
      throw safeProxyError(error, profile)
    }
  }
}

export async function testProxyConnection(
  profile: ProxyProfile,
  target: ProxyTestTarget
): Promise<ProxyTestResult> {
  const endpoint =
    target === 'okx'
      ? 'https://www.okx.com/api/v5/public/time'
      : 'https://api.binance.com/api/v3/time'
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PROXY_TEST_TIMEOUT_MS)
  const startedAt = performance.now()
  try {
    const response = await createProxyFetch(profile)(endpoint, { signal: controller.signal })
    if (!response.ok) throw new Error(`远端返回 HTTP ${response.status}`)
    const body = (await response.json()) as unknown
    const valid =
      target === 'okx'
        ? Boolean(body && typeof body === 'object' && (body as { code?: unknown }).code === '0')
        : Boolean(
            body &&
              typeof body === 'object' &&
              Number.isFinite(Number((body as { serverTime?: unknown }).serverTime))
          )
    if (!valid) throw new Error('远端返回了无效响应')
    return { target, latencyMs: Math.max(1, Math.round(performance.now() - startedAt)) }
  } finally {
    clearTimeout(timeout)
  }
}
