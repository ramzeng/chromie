export type McpErrorCode =
  | 'MCP_DISABLED'
  | 'PERMISSION_DENIED'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'READ_ONLY'
  | 'SYNC_NOT_CONFIGURED'
  | 'SYNC_CONFLICT'
  | 'SYNC_FAILED'

export class McpOperationError extends Error {
  constructor(
    readonly code: McpErrorCode,
    message: string,
    readonly retryable = false,
    readonly details?: unknown
  ) {
    super(message)
    this.name = 'McpOperationError'
  }
}
