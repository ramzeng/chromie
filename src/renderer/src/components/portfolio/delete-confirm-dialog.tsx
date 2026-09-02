import { useEffect, useId, useRef, useState } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  actionLabel = '删除',
  confirmationPhrase,
  onConfirm
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  actionLabel?: string
  confirmationPhrase?: string
  onConfirm: () => void | Promise<void>
}) {
  const [submitting, setSubmitting] = useState(false)
  const submissionInFlight = useRef(false)
  const confirmationInputRef = useRef<HTMLInputElement>(null)
  const confirmationInputId = useId()
  const [confirmationValue, setConfirmationValue] = useState('')
  const confirmationMatches =
    confirmationPhrase === undefined || confirmationValue === confirmationPhrase

  useEffect(() => {
    if (open) setConfirmationValue('')
  }, [confirmationPhrase, open])

  async function handleConfirm(): Promise<void> {
    if (!confirmationMatches || submissionInFlight.current) return
    submissionInFlight.current = true
    setSubmitting(true)
    try {
      await onConfirm()
    } catch {
      // The caller owns user-facing error feedback; keep the dialog open for retry.
    } finally {
      submissionInFlight.current = false
      setSubmitting(false)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!submitting) onOpenChange(nextOpen)
      }}
    >
      <AlertDialogContent
        onOpenAutoFocus={(event) => {
          if (!confirmationPhrase) return
          event.preventDefault()
          confirmationInputRef.current?.focus()
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}，此操作无法撤销
          </AlertDialogDescription>
        </AlertDialogHeader>
        {confirmationPhrase && (
          <AlertDialogBody>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={confirmationInputId}>
                  输入工作区名称“{confirmationPhrase}”确认删除
                </FieldLabel>
                <Input
                  ref={confirmationInputRef}
                  id={confirmationInputId}
                  value={confirmationValue}
                  placeholder={confirmationPhrase}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={submitting}
                  onChange={(event) => setConfirmationValue(event.target.value)}
                />
              </Field>
            </FieldGroup>
          </AlertDialogBody>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>取消</AlertDialogCancel>
          <AlertDialogAction
            disabled={submitting || !confirmationMatches}
            aria-busy={submitting}
            onClick={(event) => {
              event.preventDefault()
              void handleConfirm()
            }}
          >
            {submitting && <Spinner data-icon="inline-start" />}
            {submitting
              ? actionLabel.includes('注销')
                ? '注销中…'
                : '删除中…'
              : actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
