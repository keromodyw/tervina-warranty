import { useState, type FormEvent } from 'react'
import { STATUS_LABELS, trackByPhone, type ClaimStatus, type TrackedClaim } from '@/core/claims/track'

const STATUS_STYLES: Readonly<Record<ClaimStatus, string>> = {
  pending: 'bg-warning-600/10 text-warning-600',
  approved: 'bg-success-600/10 text-success-600',
  declined: 'bg-danger-700/10 text-danger-700',
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
}

/** M8. Track one or more claims by the WhatsApp number used at activation. */
export function TrackPage() {
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [claims, setClaims] = useState<TrackedClaim[] | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setClaims(null)
    try {
      setClaims(await trackByPhone(phone))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر جلب الطلبات، حاول مرة أخرى.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-brand-800">تتبع طلبك</h1>
        <p className="mt-1 text-sm text-ink-500">
          أدخل الرقم الذي استخدمته في التفعيل لعرض حالة الطلبات.
        </p>
      </header>

      <form onSubmit={handleSubmit} noValidate className="flex gap-3">
        <input
          type="tel"
          dir="ltr"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="01xxxxxxxxx"
          className="w-full rounded-lg border border-ink-200 bg-white px-4 py-3 text-start text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
        <button
          type="submit"
          disabled={busy || phone.trim() === ''}
          className="shrink-0 rounded-card bg-brand-600 px-6 py-3 font-bold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? '...' : 'بحث'}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-danger-700/10 px-3 py-2 text-sm font-medium text-danger-700">
          {error}
        </p>
      )}

      {claims !== null && claims.length === 0 && (
        <p className="mt-6 rounded-card border border-ink-100 bg-white p-6 text-center text-ink-500">
          لا توجد طلبات مسجلة على هذا الرقم.
        </p>
      )}

      {claims !== null && claims.length > 0 && (
        <ul className="mt-6 grid gap-4">
          {claims.map((claim) => (
            <li key={claim.activation_code} className="rounded-card border border-ink-100 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <span dir="ltr" className="font-bold text-brand-700">
                  {claim.activation_code}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[claim.status] ?? ''}`}
                >
                  {STATUS_LABELS[claim.status] ?? claim.status}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-500">الصنف</dt>
                  <dd className="font-medium text-ink-900">{claim.item_type}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-500">المنتج</dt>
                  <dd className="font-medium text-ink-900">{claim.product_type}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-500">السيريال</dt>
                  <dd dir="ltr" className="font-medium text-ink-900">
                    {claim.serial}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-500">القدرة</dt>
                  <dd className="font-medium text-ink-900">{claim.capacity || '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-500">تاريخ التفعيل</dt>
                  <dd className="font-medium text-ink-900">{formatDate(claim.submitted_at)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-500">نهاية الضمان</dt>
                  <dd className="font-medium text-ink-900">{formatDate(claim.warranty_end)}</dd>
                </div>
              </dl>

              {claim.status === 'declined' && claim.decline_reason && (
                <p className="mt-3 rounded-lg bg-danger-700/10 px-3 py-2 text-sm text-danger-700">
                  <span className="font-semibold">سبب الرفض: </span>
                  {claim.decline_reason}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
