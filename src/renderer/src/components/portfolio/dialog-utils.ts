import { useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  DEFAULT_TAG_COLOR,
  TAG_COLORS,
  type TagColor
} from '@/lib/portfolio'

const FORM_VALIDATION_TOAST_ID = 'form-validation-error'

export function operationErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/^Error invoking remote method '[^']+': Error: /, '')
}

export function reportOperationError(title: string, error: unknown): void {
  toast.error(`${title}：${operationErrorMessage(error)}`)
}

export function reportValidationError(message: string): void {
  toast.error(message, { id: FORM_VALIDATION_TOAST_ID })
}

export function randomTagColor(): TagColor {
  const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]
  return color ?? DEFAULT_TAG_COLOR
}

export function useSubmissionGuard() {
  const [submitting, setSubmitting] = useState(false)
  const submissionInFlight = useRef(false)

  function beginSubmission(): boolean {
    if (submissionInFlight.current) return false
    toast.dismiss(FORM_VALIDATION_TOAST_ID)
    submissionInFlight.current = true
    setSubmitting(true)
    return true
  }

  function endSubmission(): void {
    submissionInFlight.current = false
    setSubmitting(false)
  }

  return { submitting, submissionInFlight, beginSubmission, endSubmission }
}
