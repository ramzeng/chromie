import type { ComponentProps } from 'react'

import { Badge } from '@/components/ui/badge'
import { ComboboxChip } from '@/components/ui/combobox'
import { cn } from '@/lib/utils'
import type { Tag, TagColor } from '@/lib/portfolio'

const tagColorClassNames: Record<TagColor, string> = {
  gray: 'bg-tag-gray',
  red: 'bg-tag-red',
  orange: 'bg-tag-orange',
  yellow: 'bg-tag-yellow',
  green: 'bg-tag-green',
  blue: 'bg-tag-blue',
  purple: 'bg-tag-purple'
}

const tagBadgeClassName = 'h-6 px-2 py-0 text-sm'

export function TagColorDot({
  color,
  className,
  ...props
}: ComponentProps<'span'> & { color: TagColor }) {
  return (
    <span
      aria-hidden="true"
      className={cn('size-2.5 shrink-0 rounded-full', tagColorClassNames[color], className)}
      {...props}
    />
  )
}

export function TagBadge({
  tag,
  className,
  ...props
}: Omit<ComponentProps<typeof Badge>, 'children'> & { tag: Tag }) {
  return (
    <Badge variant="secondary" className={cn(tagBadgeClassName, className)} {...props}>
      {tag.name}
    </Badge>
  )
}

export function UntaggedBadge({
  className,
  ...props
}: Omit<ComponentProps<typeof Badge>, 'children'>) {
  return (
    <Badge
      variant="outline"
      className={cn(tagBadgeClassName, 'text-muted-foreground', className)}
      {...props}
    >
      暂无标签
    </Badge>
  )
}

export function TagComboboxChip({
  tag,
  className,
  ...props
}: Omit<ComponentProps<typeof ComboboxChip>, 'children'> & { tag: Tag }) {
  return (
    <ComboboxChip
      className={cn(
        'h-6 bg-secondary px-2 text-sm text-secondary-foreground has-data-[slot=combobox-chip-remove]:pr-0 [&_[data-slot=combobox-chip-remove]]:hover:bg-foreground/10 [&_[data-slot=combobox-chip-remove]]:hover:text-secondary-foreground',
        className
      )}
      {...props}
    >
      {tag.name}
    </ComboboxChip>
  )
}
