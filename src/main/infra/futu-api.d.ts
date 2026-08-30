declare module 'futu-api' {
  type FutuResponse = {
    retType: number
    retMsg?: string
    errCode?: number
    s2c?: Record<string, unknown>
  }

  type FutuSocket = {
    close: () => void
    onerror?: (error: unknown) => void
  }

  export default class FutuWebSocket {
    onlogin: ((success: boolean, message: unknown) => void) | null
    websock?: FutuSocket
    start: (host: string, port: number, ssl: boolean, key: string) => void
    stop: () => void
    GetAccList: (request: unknown) => Promise<FutuResponse>
    GetFunds: (request: unknown) => Promise<FutuResponse>
    GetPositionList: (request: unknown) => Promise<FutuResponse>
  }
}
