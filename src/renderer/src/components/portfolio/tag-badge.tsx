import type { ComponentProps } from 'react'

import { Badge, badgeVariants } from '@/components/ui/badge'
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

const tagBadgeClassName = cn(
  badgeVariants({ variant: 'outline' }),
  'h-auto gap-2 bg-transparent px-3 py-1 text-sm'
)

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
    <Badge variant="outline" className={cn(tagBadgeClassName, className)} {...props}>
      <TagColorDot color={tag.color} className="size-3" />
      {tag.name}
    </Badge>
  )
}

export function UntaggedBadge({
  className,
  ...props
}: Omit<ComponentProps<typeof Badge>, 'children'>) {
  return (
    <Badge variant="outline" className={cn(tagBadgeClassName, className)} {...props}>
      <TagColorDot color="gray" className="size-3" />
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
        tagBadgeClassName,
        'h-6 py-0 has-data-[slot=combobox-chip-remove]:pr-0',
        className
      )}
      {...props}
    >
      <TagColorDot color={tag.color} className="size-3" />
      {tag.name}
    </ComboboxChip>
  )
}
