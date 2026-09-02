import type { ComponentProps } from 'react'

import { Badge } from '@/components/ui/badge'
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
    <Badge variant="outline" className={cn('gap-1.5 font-normal', className)} {...props}>
      <TagColorDot color={tag.color} />
      {tag.name}
    </Badge>
  )
}
