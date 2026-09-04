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
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import {
  marketMeta,
  marketOrder,
  type CryptoQuoteProvider,
  type Position,
  type PositionInput,
  type StockQuoteProvider,
  type Tag,
  type TagInput
} from '@/lib/portfolio'
import { POSITION_CURRENCIES, type BaseDialogProps } from './dialog-shared'
import { TagSelector } from './tag-selector'
import { usePositionDialogForm } from './use-position-dialog-form'

export function PositionDialog({
  open,
  onOpenChange,
  position,
  tags,
  stockQuoteProvider,
  cryptoQuoteProvider,
  onCreateTag,
  onSubmit
}: BaseDialogProps & {
  position?: Position
  tags: Tag[]
  stockQuoteProvider: StockQuoteProvider
  cryptoQuoteProvider: CryptoQuoteProvider
  onCreateTag: (input: TagInput) => Promise<string>
  onSubmit: (input: PositionInput) => Promise<string | null>
}) {
  const {
    market,
    symbol,
    setSymbol,
    name,
    setName,
    currency,
    setCurrency,
    quantity,
    setQuantity,
    price,
    setPrice,
    tagIds,
    setTagIds,
    errors,
    step,
    setStep,
    quoteLookupStatus,
    setQuoteLookupStatus,
    quoteLookupRequestRef,
    quoteFieldEditedRef,
    setQuoteLookupEnabled,
    submitting,
    quoteLookupLoading,
    quoteDetailsReadOnly,
    clearError,
    handleMarketChange,
    handleSubmit
  } = usePositionDialogForm({
    open,
    onOpenChange,
    position,
    stockQuoteProvider,
    cryptoQuoteProvider,
    onSubmit
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!submitting && !quoteLookupLoading) onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{position ? '编辑持仓' : '添加持仓'}</DialogTitle>
          <DialogDescription className={position ? 'sr-only' : undefined}>
            {position
              ? '设置持仓市场、代码、币种、数量、当前价格和标签'
              : step === 'identity'
                ? '先选择市场并输入资产代码，我们会尝试获取资产信息'
                : quoteLookupStatus === 'found'
                  ? '资产信息已获取，请填写持仓数量并选择标签'
                  : '未获取到完整资产信息，请补充后添加持仓'}
          </DialogDescription>
        </DialogHeader>
        <form className="contents" noValidate onSubmit={handleSubmit}>
          <DialogBody>
            <FieldGroup>
              {(!position && step === 'identity') || position ? (
                <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field data-disabled={quoteLookupLoading}>
                    <FieldLabel htmlFor="position-market">市场</FieldLabel>
                    <Select
                      value={market}
                      disabled={quoteLookupLoading}
                      onValueChange={handleMarketChange}
                    >
                      <SelectTrigger id="position-market">
                        <SelectValue placeholder="选择市场" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {marketOrder.map((value) => (
                            <SelectItem key={value} value={value}>
                              {marketMeta[value].label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field data-invalid={Boolean(errors.symbol)} data-disabled={quoteLookupLoading}>
                    <FieldLabel htmlFor="position-symbol">资产代码</FieldLabel>
                    <Input
                      id="position-symbol"
                      aria-invalid={Boolean(errors.symbol)}
                      aria-describedby={
                        position && quoteLookupStatus === 'not-found'
                          ? 'position-quote-status'
                          : undefined
                      }
                      disabled={quoteLookupLoading}
                      value={symbol}
                      onChange={(event) => {
                        quoteLookupRequestRef.current += 1
                        quoteFieldEditedRef.current = {
                          name: false,
                          currency: false,
                          price: false
                        }
                        setQuoteLookupEnabled(Boolean(position))
                        setQuoteLookupStatus('idle')
                        setSymbol(event.target.value.toUpperCase())
                        clearError('symbol')
                      }}
                      placeholder={
                        market === 'CN'
                          ? '600519'
                          : market === 'CN_OTC'
                            ? '017641'
                            : market === 'HK'
                              ? '00700'
                              : market === 'US'
                                ? 'AAPL'
                                : 'BTC'
                      }
                      autoFocus
                      maxLength={24}
                    />
                    {position && quoteLookupStatus === 'not-found' && (
                      <FieldDescription id="position-quote-status" aria-live="polite">
                        未找到该资产，可继续手动填写
                      </FieldDescription>
                    )}
                  </Field>
                </FieldGroup>
              ) : null}

              {(position || step === 'details') && (
                <FieldGroup>
                  <Field
                    data-invalid={Boolean(errors.name)}
                    data-disabled={quoteLookupLoading || quoteDetailsReadOnly}
                  >
                    <FieldLabel htmlFor="position-name">资产名称</FieldLabel>
                    <Input
                      id="position-name"
                      aria-invalid={Boolean(errors.name)}
                      disabled={quoteLookupLoading || quoteDetailsReadOnly}
                      value={name}
                      onChange={(event) => {
                        quoteFieldEditedRef.current.name = true
                        setName(event.target.value)
                        clearError('name')
                      }}
                      placeholder="Apple"
                      maxLength={60}
                      autoFocus={!position && quoteLookupStatus !== 'found'}
                    />
                  </Field>
                  <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field
                      data-invalid={Boolean(errors.currency)}
                      data-disabled={quoteLookupLoading || quoteDetailsReadOnly}
                    >
                      <FieldLabel htmlFor="position-currency">币种</FieldLabel>
                      <Select
                        value={currency}
                        disabled={quoteLookupLoading || quoteDetailsReadOnly}
                        onValueChange={(value) => {
                          quoteFieldEditedRef.current.currency = true
                          setCurrency(value)
                          clearError('currency')
                        }}
                      >
                        <SelectTrigger
                          id="position-currency"
                          aria-invalid={Boolean(errors.currency)}
                        >
                          <SelectValue placeholder="选择币种" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {(POSITION_CURRENCIES.includes(currency)
                              ? POSITION_CURRENCIES
                              : [...POSITION_CURRENCIES, currency]
                            ).map((value) => (
                              <SelectItem key={value} value={value}>
                                {value}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field
                      data-invalid={Boolean(errors.price)}
                      data-disabled={quoteLookupLoading || quoteDetailsReadOnly}
                    >
                      <FieldLabel htmlFor="position-price">当前价格</FieldLabel>
                      <Input
                        id="position-price"
                        type="number"
                        value={price}
                        aria-invalid={Boolean(errors.price)}
                        disabled={quoteLookupLoading || quoteDetailsReadOnly}
                        onChange={(event) => {
                          quoteFieldEditedRef.current.price = true
                          setPrice(event.target.value)
                          clearError('price')
                        }}
                        placeholder="0.00"
                        min="0"
                        step="any"
                        required
                      />
                    </Field>
                  </FieldGroup>

                  <Field data-invalid={Boolean(errors.quantity)} data-disabled={quoteLookupLoading}>
                    <FieldLabel htmlFor="position-quantity">资产数量</FieldLabel>
                    <Input
                      id="position-quantity"
                      type="number"
                      value={quantity}
                      aria-invalid={Boolean(errors.quantity)}
                      disabled={quoteLookupLoading}
                      onChange={(event) => {
                        setQuantity(event.target.value)
                        clearError('quantity')
                      }}
                      placeholder="0"
                      min="0"
                      step="any"
                      autoFocus={!position && quoteLookupStatus === 'found'}
                    />
                  </Field>
                  <TagSelector
                    tags={tags}
                    selectedIds={tagIds}
                    onSelectedIdsChange={setTagIds}
                    onCreateTag={onCreateTag}
                    disabled={quoteLookupLoading}
                  />
                </FieldGroup>
              )}
            </FieldGroup>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitting || quoteLookupLoading}
              onClick={() => {
                if (!position && step === 'details') {
                  quoteLookupRequestRef.current += 1
                  setQuoteLookupStatus('idle')
                  setStep('identity')
                  return
                }
                onOpenChange(false)
              }}
            >
              {!position && step === 'details' ? '上一步' : '取消'}
            </Button>
            <Button
              type="submit"
              disabled={submitting || quoteLookupLoading}
              aria-busy={submitting || quoteLookupLoading}
            >
              {(submitting || quoteLookupLoading) && <Spinner data-icon="inline-start" />}
              {quoteLookupLoading
                ? '获取中…'
                : submitting
                  ? position
                    ? '保存中…'
                    : '添加中…'
                  : !position && step === 'identity'
                    ? '下一步'
                    : position
                      ? '保存'
                      : '添加'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
