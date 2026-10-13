import { Fragment, useCallback, useEffect, useState } from 'react'
import { STATUS_LABELS, type ClaimStatus } from '@/core/claims/track'
import { SHOT_LABELS } from '@/core/photos/photoManifest'
import { cn } from '@/core/lib/cn'
import {
  approveClaim,
  claimPhotoUrls,
  declineClaim,
  listClaims,
  markSent,
  saveNotes,
  type AdminClaim,
  type ClaimPhoto,
} from './adminApi'
import { currentStaffUserId } from './auth'
import { buildWhatsAppUrl } from './whatsapp'
import { AdminBulk } from './AdminBulk'
import { PhotoLightbox } from './PhotoLightbox'

const STATUS_STYLES: Readonly<Record<ClaimStatus, string>> = {
  pending: 'bg-warning-600/10 text-warning-600',
  approved: 'bg-success-600/10 text-success-600',
  declined: 'bg-danger-700/10 text-danger-700',
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ar-EG')
}

function photoLabel(kind: string): string {
  return (SHOT_LABELS as Record<string, string>)[kind] ?? kind
}

/** Has a review note but was neither approved nor declined -> on hold. */
function isOnHold(claim: AdminClaim): boolean {
  return claim.status === 'pending' && (claim.notes ?? '').trim() !== ''
}

export function AdminOrders() {
  const [status, setStatus] = useState<ClaimStatus | ''>('')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [claims, setClaims] = useState<AdminClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 350)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    listClaims({ status, search: debounced })
      .then((rows) => {
        if (active) setClaims(rows)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'تعذر تحميل الطلبات.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [status, debounced, reloadKey])

  const refresh = useCallback(() => setReloadKey((k) => k + 1), [])

  return (
    <div>
      <AdminBulk onChanged={refresh} />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ClaimStatus | '')}
          className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
        >
          <option value="">كل الحالات</option>
          <option value="pending">قيد المراجعة</option>
          <option value="approved">تمت الموافقة</option>
          <option value="declined">مرفوضة</option>
        </select>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالاسم أو الهاتف أو السيريال"
          className="min-w-56 flex-1 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />

        <button
          type="button"
          onClick={refresh}
          className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50"
        >
          تحديث
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-danger-700/10 px-3 py-2 text-sm text-danger-700">
          {error}
        </p>
      )}

      <p className="mt-3 text-xs text-ink-400">
        {loading ? 'جارٍ التحميل...' : `${claims.length} طلب`}
      </p>

      <div className="mt-2 overflow-x-auto rounded-card border border-ink-100 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-ink-50 text-xs text-ink-500">
            <tr>
              <th className="p-3 text-start font-medium">كود التفعيل</th>
              <th className="p-3 text-start font-medium">السيريال</th>
              <th className="p-3 text-start font-medium">العميل</th>
              <th className="p-3 text-start font-medium">المنتج</th>
              <th className="p-3 text-start font-medium">الحالة</th>
              <th className="p-3 text-start font-medium">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((claim) => {
              const open = expanded === claim.id
              const onHold = isOnHold(claim)
              return (
                <Fragment key={claim.id}>
                  <tr
                    onClick={() => setExpanded(open ? null : claim.id)}
                    className={cn(
                      'cursor-pointer border-t border-ink-100',
                      onHold ? 'bg-warning-600/10 hover:bg-warning-600/15' : 'hover:bg-brand-50/40',
                    )}
                  >
                    <td dir="ltr" className="p-3 font-semibold text-brand-700">
                      {claim.activation_code ?? '—'}
                    </td>
                    <td dir="ltr" className="p-3">{claim.serial}</td>
                    <td className="p-3">
                      <div>{claim.customer?.full_name ?? '—'}</div>
                      <div dir="ltr" className="text-xs text-ink-400">{claim.customer?.phone ?? ''}</div>
                    </td>
                    <td className="p-3">
                      <div>{claim.item_type}</div>
                      <div className="text-xs text-ink-400">{claim.product_type}</div>
                    </td>
                    <td className="p-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[claim.status]}`}>
                        {STATUS_LABELS[claim.status]}
                      </span>
                      {onHold && (
                        <span className="ms-2 rounded-full bg-warning-600 px-2.5 py-1 text-xs font-bold text-white">
                          مُعلق
                        </span>
                      )}
                      {claim.sent_to_customer && (
                        <span className="ms-2 text-xs text-ink-400">أُرسل</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-ink-500">{formatDate(claim.created_at)}</td>
                  </tr>
                  {onHold && !open && (
                    <tr className="border-t border-warning-600/30 bg-warning-600/10">
                      <td colSpan={6} className="px-3 pb-3 pt-1 text-xs text-ink-700">
                        <span className="font-bold text-warning-600">ملاحظات: </span>
                        {claim.notes}
                      </td>
                    </tr>
                  )}
                  {open && (
                    <tr className="border-t border-ink-100 bg-ink-50/40">
                      <td colSpan={6} className="p-4">
                        <ClaimDetail claim={claim} onChanged={refresh} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {!loading && claims.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-ink-400">
                  لا توجد طلبات مطابقة.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ClaimDetail({ claim, onChanged }: { claim: AdminClaim; onChanged: () => void }) {
  const [photos, setPhotos] = useState<ClaimPhoto[] | null>(null)
  const [notes, setNotes] = useState(claim.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    claimPhotoUrls(claim.id)
      .then((rows) => {
        if (active) setPhotos(rows)
      })
      .catch(() => {
        if (active) setPhotos([])
      })
    return () => {
      active = false
    }
  }, [claim.id])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تنفيذ العملية.')
    } finally {
      setBusy(false)
    }
  }

  async function handleApprove() {
    const staffId = await currentStaffUserId()
    await run(() => approveClaim(claim.id, staffId))
  }

  async function handleDecline() {
    const reason = window.prompt('سبب الرفض:')
    if (!reason || reason.trim() === '') return
    const staffId = await currentStaffUserId()
    await run(() => declineClaim(claim.id, reason.trim(), staffId))
  }

  function handleSend() {
    window.open(buildWhatsAppUrl(claim), '_blank', 'noopener')
    void run(() => markSent(claim.id))
  }

  return (
    <div className="grid gap-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <Row label="المحافظة" value={claim.customer?.governorate ?? '—'} />
        <Row label="المركز" value={claim.customer?.city ?? '—'} />
        <Row label="القطاع" value={claim.customer?.sector ?? '—'} />
        <Row label="القدرة" value={claim.capacity ?? '—'} />
        <Row label="اسم الفني" value={claim.technician_name ?? '—'} />
        <Row label="رقم الفني" value={claim.technician_phone ?? '—'} />
        <Row label="مدة الضمان" value={claim.warranty_months == null ? '—' : `${claim.warranty_months} شهر`} />
        <Row label="بداية الضمان" value={formatDate(claim.warranty_start)} />
        <Row label="نهاية الضمان" value={formatDate(claim.warranty_end)} />
        <Row label="المصدر" value={claim.source} />
        <Row label="تاريخ المراجعة" value={formatDate(claim.reviewed_at)} />
        {claim.decline_reason && <Row label="سبب الرفض" value={claim.decline_reason} />}
      </dl>

      <div>
        <p className="mb-2 text-sm font-semibold text-ink-700">الصور</p>
        {photos === null ? (
          <p className="text-xs text-ink-400">جارٍ تحميل الصور...</p>
        ) : photos.length === 0 ? (
          <p className="text-xs text-ink-400">لا توجد صور.</p>
        ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((photo, i) => (
            <figure key={photo.kind}>
              <button
                type="button"
                onClick={() => setLightbox(i)}
                className="group relative block w-full"
                aria-label={`عرض ${photoLabel(photo.kind)} بالحجم الكامل`}
              >
                <img
                  src={photo.url}
                  alt={photoLabel(photo.kind)}
                  className="h-32 w-full rounded-lg object-cover ring-1 ring-ink-100 transition group-hover:opacity-90"
                />
                <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 text-xs font-semibold text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
                  عرض بالحجم الكامل
                </span>
              </button>
              <figcaption className="mt-1 text-center text-xs text-ink-500">
                {photoLabel(photo.kind)}
              </figcaption>
            </figure>
          ))}
        </div>
        )}

        {lightbox !== null && photos !== null && (
          <PhotoLightbox photos={photos} startIndex={lightbox} onClose={() => setLightbox(null)} />
        )}
      </div>

      <div className="grid gap-2">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="ملاحظات المراجعة"
          rows={2}
          className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => saveNotes(claim.id, notes))}
            className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-600 hover:bg-white disabled:opacity-60"
          >
            حفظ الملاحظات
          </button>
          <button
            type="button"
            disabled={busy || claim.status === 'approved'}
            onClick={() => void handleApprove()}
            className="rounded-lg bg-success-600 px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            اعتماد
          </button>
          <button
            type="button"
            disabled={busy || claim.status === 'declined'}
            onClick={() => void handleDecline()}
            className="rounded-lg bg-danger-700 px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            رفض
          </button>
          <button
            type="button"
            disabled={busy || claim.status !== 'approved'}
            onClick={handleSend}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {claim.sent_to_customer ? 'إعادة إرسال واتساب' : 'إرسال للعميل'}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-700/10 px-3 py-2 text-sm text-danger-700">
          {error}
        </p>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-400">{label}</dt>
      <dd className="font-medium text-ink-700">{value}</dd>
    </div>
  )
}
