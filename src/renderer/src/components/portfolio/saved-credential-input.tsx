import { useState, type ComponentProps } from 'react'

import { Input } from '@/components/ui/input'

const SAVED_CREDENTIAL_MASK = '••••••••'

type SavedCredentialInputProps = Omit<ComponentProps<typeof Input>, 'value'> & {
  credentialConfigured: boolean
  value: string
}

export function SavedCredentialInput({
  credentialConfigured,
  value,
  onFocus,
  onBlur,
  ...props
}: SavedCredentialInputProps) {
  const [focused, setFocused] = useState(false)
  const displayValue =
    credentialConfigured && !focused && value.length === 0
      ? SAVED_CREDENTIAL_MASK
      : value

  return (
    <Input
      {...props}
      value={displayValue}
      onFocus={(event) => {
        setFocused(true)
        onFocus?.(event)
      }}
      onBlur={(event) => {
        setFocused(false)
        onBlur?.(event)
      }}
    />
  )
}
