import { useEffect, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import {
  defaultCurrencyByMarket,
  type CryptoQuoteProvider,
  type Market,
  type Position,
  type PositionInput,
  type StockQuoteProvider
} from '@/lib/portfolio'
import { reportOperationError, reportValidationError, useSubmissionGuard } from './dialog-utils'
import type { BaseDialogProps } from './dialog-shared'

type PositionField = 'symbol' | 'name' | 'currency' | 'quantity' | 'price'
type AssetQuoteLookupStatus =
  | 'idle'
  | 'loading'
  | 'found'
  | 'not-found'
  | 'unavailable'
  | 'incomplete'
type PositionDialogStep = 'identity' | 'details'

const ASSET_QUOTE_LOOKUP_DELAY_MS = 600
const POSITION_QUOTE_LOOKUP_TOAST_ID = 'position-quote-lookup'

export function usePositionDialogForm({
  open,
  onOpenChange,
  position,
  stockQuoteProvider,
  cryptoQuoteProvider,
  onSubmit
}: BaseDialogProps & {
  position?: Position
  stockQuoteProvider: StockQuoteProvider
  cryptoQuoteProvider: CryptoQuoteProvider
  onSubmit: (input: PositionInput) => Promise<string | null>
}) {
  const [market, setMarket] = useState<Market>('US')
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [errors, setErrors] = useState<Partial<Record<PositionField, string>>>({})
  const [step, setStep] = useState<PositionDialogStep>('identity')
  const [quoteLookupEnabled, setQuoteLookupEnabled] = useState(false)
  const [quoteLookupStatus, setQuoteLookupStatus] = useState<AssetQuoteLookupStatus>('idle')
  const quoteLookupRequestRef = useRef(0)
  const quoteFieldEditedRef = useRef({
    name: false,
    currency: false,
    price: false
  })
  const { submitting, submissionInFlight, beginSubmission, endSubmission } = useSubmissionGuard()
  const quoteLookupLoading = quoteLookupStatus === 'loading'
  const quoteDetailsReadOnly = !position && quoteLookupStatus === 'found'

  useEffect(() => {
    if (!open) return
    setMarket(position?.market ?? 'US')
    setSymbol(position?.symbol ?? '')
    setName(position?.name ?? '')
    setCurrency(position?.currency ?? 'USD')
    setQuantity(position ? String(position.quantity) : '')
    setPrice(position?.price === undefined ? '' : String(position.price))
    setTagIds(position?.tagIds ?? [])
    setErrors({})
    setStep(position ? 'details' : 'identity')
    setQuoteLookupEnabled(false)
    setQuoteLookupStatus('idle')
    quoteLookupRequestRef.current += 1
    quoteFieldEditedRef.current = {
      name: false,
      currency: false,
      price: false
    }
    // Preserve edits across background sync refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, position?.id])

  useEffect(() => {
    const requestId = ++quoteLookupRequestRef.current
    const normalizedSymbol = symbol.trim()
    if (!position || !open || !quoteLookupEnabled || !normalizedSymbol) {
      setQuoteLookupStatus('idle')
      return
    }

    const timer = window.setTimeout(() => {
      setQuoteLookupStatus('loading')
      const lookup = window.desktop.assetQuotes?.lookup
      if (!lookup) {
        setQuoteLookupStatus('idle')
        return
      }

      const provider = market === 'CN_OTC_FUND'
        ? 'eastmoney'
        : market === 'CC'
          ? cryptoQuoteProvider
          : stockQuoteProvider
      void lookup({ market, symbol: normalizedSymbol, provider })
        .then((result) => {
          if (requestId !== quoteLookupRequestRef.current) return
          if (result.status !== 'found') {
            setQuoteLookupStatus(result.status === 'not-found' ? 'not-found' : 'idle')
            return
          }

          const filledFields: PositionField[] = []
          if (result.quote.name && !quoteFieldEditedRef.current.name) {
            setName(result.quote.name.slice(0, 60))
            filledFields.push('name')
          }
          if (result.quote.currency && !quoteFieldEditedRef.current.currency) {
            setCurrency(result.quote.currency)
            filledFields.push('currency')
          }
          if (result.quote.price !== undefined && !quoteFieldEditedRef.current.price) {
            setPrice(String(result.quote.price))
            filledFields.push('price')
          }
          if (filledFields.length > 0) {
            setErrors((current) => {
              const next = { ...current }
              filledFields.forEach((field) => delete next[field])
              return next
            })
            toast.success('行情数据获取成功', {
              id: 'position-quote-autofill'
            })
          }
          setQuoteLookupStatus('idle')
        })
        .catch(() => {
          if (requestId === quoteLookupRequestRef.current) {
            setQuoteLookupStatus('idle')
          }
        })
    }, ASSET_QUOTE_LOOKUP_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [
    cryptoQuoteProvider,
    market,
    open,
    position?.id,
    quoteLookupEnabled,
    stockQuoteProvider,
    symbol
  ])

  function clearError(field: PositionField): void {
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  function failValidation(field: PositionField, message: string): void {
    setErrors({ [field]: message })
    reportValidationError(message)
  }

  function handleMarketChange(value: string): void {
    const nextMarket = value as Market
    const previousDefault = defaultCurrencyByMarket[market]
    quoteLookupRequestRef.current += 1
    quoteFieldEditedRef.current = {
      name: false,
      currency: false,
      price: false
    }
    setQuoteLookupEnabled(Boolean(position))
    setQuoteLookupStatus('idle')
    setMarket(nextMarket)
    if (!position) {
      setName('')
      setCurrency(defaultCurrencyByMarket[nextMarket])
      setPrice('')
      setErrors((current) => {
        const next = { ...current }
        delete next.name
        delete next.currency
        delete next.price
        return next
      })
    } else if (!currency || currency === previousDefault) {
      setCurrency(defaultCurrencyByMarket[nextMarket])
      clearError('currency')
    }
  }

  async function continueToDetails(): Promise<void> {
    const normalizedSymbol = symbol.trim()
    if (!normalizedSymbol) {
      failValidation('symbol', '请填写资产代码')
      return
    }

    const requestId = ++quoteLookupRequestRef.current
    const provider = market === 'CN_OTC_FUND'
      ? 'eastmoney'
      : market === 'CC'
        ? cryptoQuoteProvider
        : stockQuoteProvider
    setName('')
    setCurrency(defaultCurrencyByMarket[market])
    setPrice('')
    setErrors({})
    setQuoteLookupStatus('loading')

    const lookup = window.desktop.assetQuotes?.lookup
    if (!lookup) {
      setQuoteLookupStatus('unavailable')
      setStep('details')
      toast.info('暂时无法获取资产信息，请手动填写', {
        id: POSITION_QUOTE_LOOKUP_TOAST_ID
      })
      return
    }

    try {
      const result = await lookup({
        market,
        symbol: normalizedSymbol,
        provider
      })
      if (requestId !== quoteLookupRequestRef.current) return
      if (result.status !== 'found') {
        setQuoteLookupStatus(result.status)
        setStep('details')
        toast.info(
          result.status === 'not-found'
            ? '未找到该资产，请手动填写'
            : '暂时无法获取资产信息，请手动填写',
          { id: POSITION_QUOTE_LOOKUP_TOAST_ID }
        )
        return
      }

      const quoteName = result.quote.name?.trim()
      const quoteCurrency = result.quote.currency?.trim()
      const quotePrice = result.quote.price
      if (
        !quoteName ||
        !quoteCurrency ||
        quotePrice === undefined ||
        !Number.isFinite(quotePrice) ||
        quotePrice < 0
      ) {
        setQuoteLookupStatus('incomplete')
        setStep('details')
        toast.info('获取到的资产信息不完整，请补充填写', {
          id: POSITION_QUOTE_LOOKUP_TOAST_ID
        })
        return
      }

      setName(quoteName.slice(0, 60))
      setCurrency(quoteCurrency)
      setPrice(String(quotePrice))
      setQuoteLookupStatus('found')
      setStep('details')
      toast.success('资产信息获取成功', {
        id: POSITION_QUOTE_LOOKUP_TOAST_ID
      })
    } catch {
      if (requestId === quoteLookupRequestRef.current) {
        setQuoteLookupStatus('unavailable')
        setStep('details')
        toast.info('暂时无法获取资产信息，请手动填写', {
          id: POSITION_QUOTE_LOOKUP_TOAST_ID
        })
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (submissionInFlight.current || quoteLookupLoading) return
    if (!position && step === 'identity') {
      await continueToDetails()
      return
    }
    const parsedQuantity = Number(quantity)
    const parsedPrice = Number(price)
    if (!symbol.trim()) {
      failValidation('symbol', '请填写资产代码')
      return
    }
    if (!name.trim()) {
      failValidation('name', '请填写资产名称')
      return
    }
    if (!currency.trim()) {
      failValidation('currency', '请选择币种')
      return
    }
    if (!quantity.trim()) {
      failValidation('quantity', '请填写资产数量')
      return
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      failValidation('quantity', '资产数量必须大于 0')
      return
    }
    if (!price.trim()) {
      failValidation('price', '请填写当前价格')
      return
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      failValidation('price', '当前价格必须是大于或等于 0 的数字')
      return
    }

    if (!beginSubmission()) return
    try {
      const submitError = await onSubmit({
        market,
        symbol,
        name,
        currency,
        quantity: parsedQuantity,
        price: parsedPrice,
        tagIds
      })
      if (submitError) {
        reportOperationError(position ? '更新持仓失败' : '添加持仓失败', submitError)
        return
      }
      onOpenChange(false)
    } catch (submitError) {
      reportOperationError(position ? '更新持仓失败' : '添加持仓失败', submitError)
    } finally {
      endSubmission()
    }
  }

  return {
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
  }
}
