import {
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react'

import {
  Combobox,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor
} from '@/components/ui/combobox'
import { Field, FieldLabel } from '@/components/ui/field'
import { InputGroupAddon, InputGroupButton } from '@/components/ui/input-group'
import type { Tag, TagInput } from '@/lib/portfolio'
import { randomTagColor, reportOperationError } from './dialog-utils'
import { TagColorDot, TagComboboxChip } from './tag-badge'

export function TagSelector({
  tags,
  selectedIds,
  onSelectedIdsChange,
  onCreateTag,
  hideLabel = false,
  disabled = false
}: {
  tags: Tag[]
  selectedIds: string[]
  onSelectedIdsChange: (tagIds: string[]) => void
  onCreateTag: (input: TagInput) => Promise<string>
  hideLabel?: boolean
  disabled?: boolean
}) {
  const fieldId = useId()
  const anchor = useComboboxAnchor()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const creatingRef = useRef(false)
  const highlightedTagIdRef = useRef<string | undefined>(undefined)
  const selectedIdsRef = useRef(selectedIds)
  selectedIdsRef.current = selectedIds
  const tagIds = tags.map((tag) => tag.id)
  const normalizedQuery = query.trim()

  function findTag(tagId: string): Tag | undefined {
    return tags.find((tag) => tag.id === tagId)
  }

  async function handleInputKeyDown(
    event: ReactKeyboardEvent<HTMLInputElement>
  ): Promise<void> {
    if (
      event.key !== 'Enter' ||
      event.nativeEvent.isComposing ||
      highlightedTagIdRef.current
    ) return

    event.preventDefault()
    event.stopPropagation()
    const baseUiEvent = event as ReactKeyboardEvent<HTMLInputElement> & {
      preventBaseUIHandler?: () => void
    }
    baseUiEvent.preventBaseUIHandler?.()
    if (!normalizedQuery || creatingRef.current) return

    const normalizedName = normalizedQuery.toLocaleLowerCase()
    const existingTag = tags.find(
      (tag) => tag.name.trim().toLocaleLowerCase() === normalizedName
    )
    if (existingTag) {
      if (!selectedIdsRef.current.includes(existingTag.id)) {
        onSelectedIdsChange([...selectedIdsRef.current, existingTag.id])
      }
      setQuery('')
      setOpen(false)
      return
    }

    creatingRef.current = true
    setCreating(true)
    try {
      const tagId = await onCreateTag({
        name: normalizedQuery,
        color: randomTagColor(),
        note: ''
      })
      if (!selectedIdsRef.current.includes(tagId)) {
        onSelectedIdsChange([...selectedIdsRef.current, tagId])
      }
      setQuery('')
      setOpen(false)
    } catch (error) {
      reportOperationError('添加标签失败', error)
    } finally {
      creatingRef.current = false
      setCreating(false)
    }
  }

  return (
    <Field data-disabled={disabled || creating}>
      {!hideLabel && <FieldLabel htmlFor={fieldId}>标签</FieldLabel>}
      <Combobox
        multiple
        disabled={disabled || creating}
        items={tagIds}
        value={selectedIds}
        inputValue={query}
        open={open}
        onOpenChange={setOpen}
        onInputValueChange={(inputValue) => {
          highlightedTagIdRef.current = undefined
          setQuery(inputValue)
        }}
        onItemHighlighted={(tagId) => {
          highlightedTagIdRef.current = tagId
        }}
        onValueChange={(nextSelectedIds) => {
          onSelectedIdsChange(nextSelectedIds)
          setQuery('')
        }}
        itemToStringLabel={(tagId) => findTag(tagId)?.name ?? ''}
        itemToStringValue={(tagId) => tagId}
        filter={(tagId, query) =>
          (findTag(tagId)?.name ?? '')
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase())
        }
      >
        <ComboboxChips
          ref={anchor}
          className="pr-0 has-data-[slot=combobox-chip]:px-3 has-data-[slot=combobox-chip]:pr-0"
        >
          <ComboboxValue>
            {(values: string[]) => (
              <>
                {values.map((tagId) => {
                  const tag = findTag(tagId)
                  return tag ? (
                    <TagComboboxChip key={tagId} tag={tag} />
                  ) : null
                })}
                <ComboboxChipsInput
                  id={fieldId}
                  aria-label={hideLabel ? '标签' : undefined}
                  placeholder={
                    selectedIds.length ? undefined : '选择或输入标签…'
                  }
                  maxLength={40}
                  onKeyDown={(event) => void handleInputKeyDown(event)}
                />
              </>
            )}
          </ComboboxValue>
          <InputGroupAddon align="inline-end" className="py-0">
            <ComboboxTrigger
              render={
                <InputGroupButton
                  size="icon-xs"
                  aria-label="选择标签"
                />
              }
            />
          </InputGroupAddon>
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty>
            {normalizedQuery
              ? `按 Enter 创建“${normalizedQuery}”`
              : '输入标签名称'}
          </ComboboxEmpty>
          <ComboboxList>
            {(tagId: string) => {
              const tag = findTag(tagId)
              return tag ? (
                <ComboboxItem key={tagId} value={tagId}>
                  <TagColorDot color={tag.color} />
                  {tag.name}
                </ComboboxItem>
              ) : null
            }}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </Field>
  )
}
