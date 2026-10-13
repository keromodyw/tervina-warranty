import { useEffect, useState, type FormEvent } from 'react'
import { ITEM_TYPES, CAPACITIES, productTypesFor } from '@/data/productOptions'
import { fetchWarrantyIndex } from '@/core/warranty/rules'
import { resolveWarrantyMonths } from '@/core/warranty/resolve'
import type { WarrantyIndex } from '@/core/warranty/resolve'
import type { ProductDraft } from '@/core/session/session'
import { productSchema } from './product'
import { Field, inputClass } from './Field'

type Props = {
  value: ProductDraft
  onChange: (patch: Partial<ProductDraft>) => void
  onSubmit: (product: ProductDraft) => void
  onBack: () => void
  busy?: boolean
  submitError?: string | null
}

type Errors = Partial<Record<keyof ProductDraft, string>>

export function ProductStep({ value, onChange, onSubmit, onBack, busy = false, submitError = null }: Props) {
  const [errors, setErrors] = useState<Errors>({})
  const [rules, setRules] = useState<WarrantyIndex | undefined>(undefined)

  useEffect(() => {
    let active = true
    fetchWarrantyIndex()
      .then((index) => {
        if (active) setRules(index)
      })
      .catch(() => {
        // Baseline still resolves without the DB overlay; not fatal.
        if (active) setRules(undefined)
      })
    return () => {
      active = false
    }
  }, [])

  const products = value.item_type === '' ? [] : productTypesFor(value.item_type)
  const months =
    value.item_type !== '' && value.product_type !== ''
      ? resolveWarrantyMonths(value.item_type, value.product_type, rules)
      : null

  function handleItemChange(itemType: string) {
    // Cascading: switching item clears the product and its derived duration.
    onChange({ item_type: itemType, product_type: '', warranty_months: null })
  }

  function handleProductChange(productType: string) {
    const next = resolveWarrantyMonths(value.item_type, productType, rules)
    onChange({ product_type: productType, warranty_months: next })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = productSchema.safeParse({ ...value, warranty_months: months })
    if (!parsed.success) {
      const next: Errors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof ProductDraft | undefined
        if (key && next[key] === undefined) next[key] = issue.message
      }
      setErrors(next)
      return
    }
    setErrors({})
    onSubmit(parsed.data)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <Field label="الصنف" htmlFor="item_type" error={errors.item_type}>
        <select
          id="item_type"
          name="item_type"
          className={inputClass}
          value={value.item_type}
          onChange={(e) => handleItemChange(e.target.value)}
        >
          <option value="">اختر الصنف</option>
          {ITEM_TYPES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </Field>

      <Field label="نوع المنتج" htmlFor="product_type" error={errors.product_type}>
        <select
          id="product_type"
          name="product_type"
          className={inputClass}
          value={value.product_type}
          disabled={products.length === 0}
          onChange={(e) => handleProductChange(e.target.value)}
        >
          <option value="">{products.length === 0 ? 'اختر الصنف أولًا' : 'اختر نوع المنتج'}</option>
          {products.map((product) => (
            <option key={product} value={product}>
              {product}
            </option>
          ))}
        </select>
      </Field>

      <Field label="القدرة" htmlFor="capacity" error={errors.capacity}>
        <select
          id="capacity"
          name="capacity"
          className={inputClass}
          value={value.capacity}
          onChange={(e) => onChange({ capacity: e.target.value })}
        >
          <option value="">اختر القدرة</option>
          {CAPACITIES.map((capacity) => (
            <option key={capacity} value={capacity}>
              {capacity}
            </option>
          ))}
        </select>
      </Field>

      {submitError && (
        <p role="alert" className="rounded-lg bg-danger-700/10 px-3 py-2 text-sm font-medium text-danger-700">
          {submitError}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="rounded-card border border-ink-200 px-5 py-3 font-semibold text-ink-600 hover:bg-ink-50 disabled:opacity-60"
        >
          رجوع
        </button>
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded-card bg-brand-600 px-6 py-3 font-bold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'جارٍ الحفظ...' : 'التالي'}
        </button>
      </div>
    </form>
  )
}
