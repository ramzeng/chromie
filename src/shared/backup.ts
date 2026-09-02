export type BackupExportResult = {
  canceled: boolean
}

export type BackupImportPreview = {
  token: string
  workspaceName: string
  accountCount: number
  tagCount: number
  positionCount: number
  snapshotCount: number
  integrationCount: number
}

export type BackupImportResult =
  | { canceled: true }
  | { canceled: false; preview: BackupImportPreview }

export type BackupImportConfirmResult = {
  workspaceId: string
}
