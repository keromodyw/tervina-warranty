import { useRef, useState } from 'react'
import { currentStaffUserId } from './auth'
import { listClaims, type OrdersFilter } from './adminApi'
import { buildWorkbook, downloadBlob, readLegacyWorkbook } from './excel'
import { importLegacyRows, type ImportOutcome } from './importLegacy'
import { buildPhotoArchive } from './archive'
import type { LegacyRow } from './legacySheet'

/**
 * Bulk toolbar for the orders screen (A7 / D20 / Excel). Three jobs:
 *   - export the ledger to the client's own Sheet1 layout,
 *   - import an old ledger (legacy certificates, forced approved),
 *   - zip every not-yet-exported photo, one folder per serial.
 * exceljs + client-zip are imported lazily via excel.ts/archive.ts.
 */
export function AdminBulk({ onChanged }: { onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [excelOpen, setExcelOpen] = useState(false)
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')
  const [pending, setPending] = useState<{ rows: LegacyRow[]; errors: Array<{ row: number; error: string }> } | null>(null)
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setError(null)
    setMessage(null)
  }

  async function exportExcel(scope: 'all' | 'today' | 'range') {
    reset()
    setBusy('excel')
    try {
      const filter: OrdersFilter =
        scope === 'today'
          ? { from: new Date(new Date().toDateString()).toISOString() }
          : scope === 'range'
            ? {
                ...(rangeFrom ? { from: rangeFrom } : {}),
                ...(rangeTo ? { to: `${rangeTo}T23:59:59` } : {}),
              }
            : {}
      const claims = await listClaims(filter)
      if (claims.length === 0) {
        setError('لا توجد بيانات في هذا النطاق.')
        return
      }
      const blob = await buildWorkbook(claims)
      const stamp = new Date().toISOString().slice(0, 10)
      downloadBlob(blob, `tervina-warranty-${stamp}.xlsx`)
      setMessage(`تم تنزيل ${claims.length} صف.`)
      setExcelOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إنشاء ملف الإكسيل.')
    } finally {
      setBusy(null)
    }
  }

  async function handleFile(file: File) {
    reset()
    setBusy('parse')
    try {
      const result = await readLegacyWorkbook(file)
      setPending({ rows: result.rows, errors: result.errors })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر قراءة الملف.')
    } finally {
      setBusy(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function confirmImport() {
    if (!pending) return
    reset()
    setBusy('import')
    try {
      const result = await importLegacyRows(pending.rows, await currentStaffUserId())
      setOutcome(result)
      setPending(null)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الاستيراد.')
    } finally {
      setBusy(null)
    }
  }

  async function exportPhotos() {
    reset()
    setBusy('photos')
    try {
      const claims = await listClaims({ status: 'approved', exported: false })
      if (claims.length === 0) {
        setError('لا توجد صور جديدة للتحميل.')
        return
      }
      const result = await buildPhotoArchive(claims)
      if (result.photoCount === 0) {
        setError('لا توجد صور جديدة للتحميل.')
        return
      }
      const stamp = new Date().toISOString().slice(0, 10)
      downloadBlob(result.blob, `tervina-photos-${stamp}.zip`)
      setMessage(`تم تحميل ${result.photoCount} صورة لـ ${result.claimCount} طلب.`)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل الصور.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => { reset(); setExcelOpen(true) }} disabled={Boolean(busy)}
          className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-60">
          تحميل الإكسيل
        </button>

        <button type="button" onClick={() => fileRef.current?.click()} disabled={Boolean(busy)}
          className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-60">
          {busy === 'parse' ? 'جاري القراءة...' : 'استيراد بيانات قديمة'}
        </button>
        <input ref={fileRef} type="file" accept=".xlsx" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f) }} />

        <button type="button" onClick={() => void exportPhotos()} disabled={Boolean(busy)}
          className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-60">
          {busy === 'photos' ? 'جاري التحميل...' : 'تحميل الصور'}
        </button>

        {(busy === 'excel' || busy === 'import') && (
          <span className="text-sm text-ink-500">جاري التنفيذ...</span>
        )}
        {message && <span className="text-sm text-success-600">{message}</span>}
        {error && <span className="text-sm text-danger-700">{error}</span>}
      </div>

      {excelOpen && (
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-ink-100 bg-ink-50/50 p-3">
          <button type="button" disabled={Boolean(busy)} onClick={() => void exportExcel('all')}
            className="rounded-lg bg-ink-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
            الكل
          </button>
          <button type="button" disabled={Boolean(busy)} onClick={() => void exportExcel('today')}
            className="rounded-lg bg-ink-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
            انهاردة
          </button>
          <div className="flex items-end gap-2">
            <label className="text-xs text-ink-500">من
              <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)}
                className="mt-1 block rounded-lg border border-ink-200 px-2 py-1 text-sm" />
            </label>
            <label className="text-xs text-ink-500">إلى
              <input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)}
                className="mt-1 block rounded-lg border border-ink-200 px-2 py-1 text-sm" />
            </label>
            <button type="button" disabled={Boolean(busy) || (!rangeFrom && !rangeTo)} onClick={() => void exportExcel('range')}
              className="rounded-lg bg-ink-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
              فترة معينة
            </button>
          </div>
          <button type="button" onClick={() => setExcelOpen(false)} className="text-sm text-ink-500 hover:underline">
            إغلاق
          </button>
        </div>
      )}

      {pending && (
        <ImportPreview pending={pending} busy={busy === 'import'} onCancel={() => setPending(null)} onConfirm={() => void confirmImport()} />
      )}

      {outcome && (
        <div className="mt-3 rounded-xl border border-ink-100 p-3 text-sm">
          <p className="font-medium text-success-600">تم استيراد {outcome.imported} طلب.</p>
          {outcome.failed.length > 0 && (
            <>
              <p className="mt-2 font-medium text-danger-700">فشل {outcome.failed.length} صف:</p>
              <ul className="mt-1 max-h-40 overflow-auto text-xs text-ink-600">
                {outcome.failed.slice(0, 50).map((f, i) => (
                  <li key={i}>سيريال {f.serial}: {f.error}</li>
                ))}
              </ul>
            </>
          )}
          <button type="button" onClick={() => setOutcome(null)} className="mt-2 text-xs text-ink-500 hover:underline">إغلاق</button>
        </div>
      )}
    </div>
  )
}

function ImportPreview({
  pending,
  busy,
  onCancel,
  onConfirm,
}: {
  pending: { rows: LegacyRow[]; errors: Array<{ row: number; error: string }> }
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="mt-3 rounded-xl border border-warning-600/40 bg-warning-600/5 p-3 text-sm">
      <p className="font-medium text-ink-800">
        سيتم استيراد {pending.rows.length} طلب كموثَّق (تمت المراجعة والإرسال).
      </p>
      {pending.errors.length > 0 && (
        <>
          <p className="mt-2 font-medium text-danger-700">تم تجاهل {pending.errors.length} صف غير صالح:</p>
          <ul className="mt-1 max-h-40 overflow-auto text-xs text-ink-600">
            {pending.errors.slice(0, 50).map((e, i) => (
              <li key={i}>صف {e.row}: {e.error}</li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={busy || pending.rows.length === 0} onClick={onConfirm}
          className="rounded-lg bg-ink-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
          {busy ? 'جاري الاستيراد...' : 'تأكيد الاستيراد'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-600">
          إلغاء
        </button>
      </div>
    </div>
  )
}
