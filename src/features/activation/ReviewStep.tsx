import { useState } from 'react'
import type { PersonalDraft, ProductDraft } from '@/core/session/session'
import type { PhotoKind } from '@/core/photos/photoManifest'
import { SHOT_LABELS } from '@/core/photos/photoManifest'
import { useObjectUrls } from './useObjectUrls'
import type { PhotoMap } from './PhotoStep'

type Props = {
  personal: PersonalDraft
  product: ProductDraft
  photos: PhotoMap
  onBack: () => void
  onSubmit: () => Promise<unknown>
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-100 py-2 last:border-b-0">
      <span className="text-sm text-ink-500">{label}</span>
      <span className="text-end text-sm font-medium text-ink-900">{value || '—'}</span>
    </div>
  )
}

/**
 * Step 4 (M7). Read-only recap + the single submit action. The network work
 * lives in submitClaim(); on success the wizard swaps to SuccessStep, so this
 * component only owns the busy/error state and stays mounted for a retry.
 */
export function ReviewStep({ personal, product, photos, onBack, onSubmit }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const urls = useObjectUrls(photos)

  async function handleSubmit() {
    setBusy(true)
    setError(null)
    try {
      await onSubmit()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال الطلب، حاول مرة أخرى.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-card border border-ink-100 bg-white p-4">
        <h2 className="mb-2 font-bold text-ink-900">البيانات الشخصية</h2>
        <Row label="الاسم" value={personal.full_name} />
        <Row label="رقم الهاتف" value={personal.phone} />
        <Row label="المحافظة" value={personal.governorate} />
        <Row label="المركز" value={personal.city} />
        <Row label="اسم الفني" value={personal.technician_name} />
        <Row label="رقم الفني" value={personal.technician_phone} />
      </section>

      <section className="rounded-card border border-ink-100 bg-white p-4">
        <h2 className="mb-2 font-bold text-ink-900">بيانات المنتج</h2>
        <Row label="الصنف" value={product.item_type} />
        <Row label="نوع المنتج" value={product.product_type} />
        <Row label="القدرة" value={product.capacity} />
        <Row label="السيريال" value={product.serial} />
      </section>

      <section className="rounded-card border border-ink-100 bg-white p-4">
        <h2 className="mb-2 font-bold text-ink-900">الصور</h2>
        <div className="grid grid-cols-2 gap-3">
          {(Object.entries(urls) as Array<[PhotoKind, string]>).map(([kind, url]) => (
            <figure key={kind}>
              <img
                src={url}
                alt={SHOT_LABELS[kind]}
                className="max-h-40 w-full rounded-lg object-contain"
              />
              <figcaption className="mt-1 text-center text-xs text-ink-500">
                {SHOT_LABELS[kind]}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-700/10 px-3 py-2 text-sm font-medium text-danger-700">
          {error}
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
          type="button"
          onClick={handleSubmit}
          disabled={busy}
          className="flex-1 rounded-card bg-brand-600 px-6 py-3 font-bold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'جارٍ الإرسال...' : 'إرسال طلب التفعيل'}
        </button>
      </div>
    </div>
  )
}
