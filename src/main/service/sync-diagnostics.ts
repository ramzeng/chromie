export type SyncDiagnosticLevel = 'info' | 'warn' | 'error'

export type SyncDiagnosticLogger = (
  level: SyncDiagnosticLevel,
  event: string,
  details: Readonly<Record<string, unknown>>
) => void

export function diagnosticErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
