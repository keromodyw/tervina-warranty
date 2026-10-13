import { useEffect, useState } from 'react'
import { adminSupabase } from '@/core/supabase/adminClient'
import { PRODUCT_TYPES_BY_ITEM } from '@/data/productOptions'
import { currentStaffUserId } from './auth'

const ruleKey = (item: string, product: string) => `${item}\u0000${product}`

/**
 * Settings (D22): edit warranty durations per (item_type, product_type). An empty
 * field means NULL (not configured) - the wizard then falls back to the generated
 * constants. Writes are staff-only via RLS; the DB also clamps 0..120.
 */
export function AdminSettings() {
  const [months, setMonths] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    adminSupabase
      .from('warranty_rules')
      .select('item_type, product_type, warranty_months')
      .then(({ data, error: loadError }) => {
        if (!active) return
        if (loadError) {
          setError(loadError.message)
          setLoading(false)
          return
        }
        const next: Record<string, string> = {}
        for (const row of data ?? []) {
          const r = row as { item_type: string; product_type: string; warranty_months: number | null }
          next[ruleKey(r.item_type, r.product_type)] =
            r.warranty_months == null ? '' : String(r.warranty_months)
        }
        setMonths(next)
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function save(item: string, product: string) {
    const k = ruleKey(item, product)
    const raw = (months[k] ?? '').trim()
    const value = raw === '' ? null : Number(raw)
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 120)) {
      setError('القيمة يجب أن تكون رقمًا صحيحًا بين 0 و 120.')
      return
    }

    setSavingKey(k)
    setError(null)
    const { error: upsertError } = await adminSupabase.from('warranty_rules').upsert(
      {
        item_type: item,
        product_type: product,
        warranty_months: value,
        updated_by: await currentStaffUserId(),
      },
      { onConflict: 'item_type,product_type' },
    )
    setSavingKey(null)
    if (upsertError) {
      setError(upsertError.message)
      return
    }
    setSavedKey(k)
    window.setTimeout(() => setSavedKey((current) => (current === k ? null : current)), 1500)
  }

  if (loading) {
    return <p className="py-12 text-center text-ink-500">جارٍ التحميل...</p>
  }

  return (
    <div className="grid gap-5">
      <p className="text-sm text-ink-500">
        اترك الحقل فارغًا لعدم تفعيل مدة ضمان لهذا المنتج. القيم بالشهور.
      </p>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-700/10 px-3 py-2 text-sm text-danger-700">
          {error}
        </p>
      )}

      {Object.entries(PRODUCT_TYPES_BY_ITEM).map(([item, products]) => (
        <section key={item} className="rounded-card border border-ink-100 bg-white p-4">
          <h2 className="mb-3 font-bold text-ink-900">{item}</h2>
          <ul className="grid gap-2">
            {products.map((product) => {
              const k = ruleKey(item, product)
              const saving = savingKey === k
              const saved = savedKey === k
              return (
                <li key={product} className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-ink-700">{product}</span>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={months[k] ?? ''}
                    placeholder="—"
                    onChange={(e) => setMonths((m) => ({ ...m, [k]: e.target.value }))}
                    className="w-24 rounded-lg border border-ink-200 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  />
                  <span className="w-8 text-xs text-ink-400">شهر</span>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void save(item, product)}
                    className="w-16 rounded-lg border border-brand-500 px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-60"
                  >
                    {saving ? '...' : saved ? 'تم' : 'حفظ'}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
