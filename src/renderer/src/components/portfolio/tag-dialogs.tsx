import { useEffect, useState, type FormEvent } from 'react'

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
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { TAG_COLORS, tagColorLabels, type Tag, type TagColor, type TagInput } from '@/lib/portfolio'
import {
  randomTagColor,
  reportOperationError,
  reportValidationError,
  useSubmissionGuard
} from './dialog-utils'
import { TagColorDot } from './tag-badge'
import { TagSelector } from './tag-selector'

import { type BaseDialogProps } from './dialog-shared'
export function TagDialog({
  open,
  onOpenChange,
  tag,
  onSubmit
}: BaseDialogProps & {
  tag?: Tag
  onSubmit: (input: TagInput) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState<TagColor>()
  const [error, setError] = useState('')
  const { submitting, submissionInFlight, beginSubmission, endSubmission } = useSubmissionGuard()

  useEffect(() => {
    if (!open) return
    setName(tag?.name ?? '')
    setColor(tag?.color)
    setError('')
  }, [open, tag])

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    event.stopPropagation()
    if (submissionInFlight.current) return
    const normalizedName = name.trim()
    if (!normalizedName) {
      const message = '请输入名称'
      setError(message)
      reportValidationError(message)
      return
    }
    if (!beginSubmission()) return
    try {
      const resolvedColor = color ?? randomTagColor()
      setColor(resolvedColor)
      await onSubmit({ name: normalizedName, color: resolvedColor })
      onOpenChange(false)
    } catch (submitError) {
      reportOperationError(tag ? '更新标签失败' : '添加标签失败', submitError)
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tag ? '编辑标签' : '添加标签'}</DialogTitle>
          <DialogDescription className="sr-only">
            {tag ? '修改标签名称和颜色' : '添加可用于账户和持仓的标签'}
          </DialogDescription>
        </DialogHeader>
        <form className="contents" onSubmit={handleSubmit}>
          <DialogBody>
            <FieldGroup>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="tag-name">名称</FieldLabel>
                <Input
                  id="tag-name"
                  value={name}
                  aria-invalid={Boolean(error)}
                  onChange={(event) => {
                    setName(event.target.value)
                    setError('')
                  }}
                  placeholder="长期投资"
                  maxLength={40}
                  autoFocus
                />
              </Field>
              <FieldSet className="gap-2">
                <FieldLegend className="leading-none">颜色</FieldLegend>
                <ToggleGroup
                  type="single"
                  value={color}
                  className="justify-start"
                  onValueChange={(value) => {
                    setColor(value ? (value as TagColor) : undefined)
                  }}
                >
                  {TAG_COLORS.map((tagColor) => (
                    <ToggleGroupItem
                      key={tagColor}
                      value={tagColor}
                      aria-label={tagColorLabels[tagColor]}
                      title={tagColorLabels[tagColor]}
                      className="group size-10 min-w-10 justify-start bg-transparent p-0 data-[state=on]:bg-transparent"
                    >
                      <TagColorDot
                        color={tagColor}
                        className="size-4 transition-shadow group-data-[state=on]:ring-2 group-data-[state=on]:ring-ring group-data-[state=on]:ring-offset-2 group-data-[state=on]:ring-offset-background"
                      />
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </FieldSet>
            </FieldGroup>
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
            <Button type="submit" disabled={submitting} aria-busy={submitting}>
              {submitting && <Spinner data-icon="inline-start" />}
              {submitting ? (tag ? '保存中…' : '添加中…') : tag ? '保存' : '添加'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TagAssignmentDialog({
  open,
  onOpenChange,
  title,
  tags,
  selectedTagIds,
  onCreateTag,
  onSubmit
}: BaseDialogProps & {
  title: string
  tags: Tag[]
  selectedTagIds: string[]
  onCreateTag: (input: TagInput) => Promise<string>
  onSubmit: (tagIds: string[]) => Promise<string | null>
}) {
  const [tagIds, setTagIds] = useState<string[]>([])
  const { submitting, beginSubmission, endSubmission } = useSubmissionGuard()

  useEffect(() => {
    if (open) setTagIds(selectedTagIds)
    // Preserve edits when adding a tag refreshes the workspace in the background.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!beginSubmission()) return
    try {
      const submitError = await onSubmit(tagIds)
      if (submitError) {
        reportOperationError('更新标签失败', submitError)
        return
      }
      onOpenChange(false)
    } catch (submitError) {
      reportOperationError('更新标签失败', submitError)
    } finally {
      endSubmission()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !submitting && onOpenChange(nextOpen)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form className="contents" onSubmit={handleSubmit}>
          <DialogBody>
            <TagSelector
              tags={tags}
              selectedIds={tagIds}
              onSelectedIdsChange={setTagIds}
              onCreateTag={onCreateTag}
              hideLabel
            />
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
            <Button type="submit" disabled={submitting}>
              {submitting && <Spinner data-icon="inline-start" />}
              {submitting ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
