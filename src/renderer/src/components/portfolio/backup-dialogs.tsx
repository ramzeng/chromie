import { Download, Upload } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { useSubmissionGuard } from './dialog-utils'

import { type BaseDialogProps } from './dialog-shared'
export function ImportBackupDialog({
  open,
  onOpenChange,
  workspaceName,
  accountCount,
  tagCount,
  positionCount,
  snapshotCount,
  integrationCount,
  onConfirm
}: BaseDialogProps & {
  workspaceName: string
  accountCount: number
  tagCount: number
  positionCount: number
  snapshotCount: number
  integrationCount: number
  onConfirm: () => void | Promise<void>
}) {
  const { submitting, beginSubmission, endSubmission } = useSubmissionGuard()

  async function handleConfirm(): Promise<void> {
    if (!beginSubmission()) return
    try {
      await onConfirm()
    } catch {
      // The caller owns user-facing error feedback; keep the dialog open for retry.
    } finally {
      endSubmission()
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!submitting) onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>导入“{workspaceName}”？</DialogTitle>
          <DialogDescription>备份将作为新的工作区导入，不会覆盖现有数据</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Alert>
            <Download aria-hidden="true" />
            <AlertTitle>备份内容</AlertTitle>
            <AlertDescription>
              {accountCount} 个账户、{tagCount} 个标签、{positionCount} 项持仓和 {snapshotCount}{' '}
              个历史快照，其中 {integrationCount} 个账户带有同步配置
            </AlertDescription>
          </Alert>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            disabled={submitting}
            aria-busy={submitting}
            onClick={() => void handleConfirm()}
          >
            {submitting && <Spinner data-icon="inline-start" />}
            {submitting ? '导入中…' : '导入'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ExportBackupDialog({
  open,
  onOpenChange,
  onConfirm
}: BaseDialogProps & {
  onConfirm: () => void | Promise<void>
}) {
  const { submitting, beginSubmission, endSubmission } = useSubmissionGuard()

  async function handleConfirm(): Promise<void> {
    if (!beginSubmission()) return
    try {
      await onConfirm()
    } catch {
      // The caller owns user-facing error feedback; keep the dialog open for retry.
    } finally {
      endSubmission()
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!submitting) onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>导出当前工作区？</DialogTitle>
          <DialogDescription>将生成一份可重新导入 Chromie 的备份文件</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Alert>
            <Upload aria-hidden="true" />
            <AlertTitle>备份包含同步凭据</AlertTitle>
            <AlertDescription>
              连接参数和 API 凭据会写入备份文件，请将文件保存在可信位置
            </AlertDescription>
          </Alert>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            disabled={submitting}
            aria-busy={submitting}
            onClick={() => void handleConfirm()}
          >
            {submitting && <Spinner data-icon="inline-start" />}
            {submitting ? '导出中…' : '导出'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
