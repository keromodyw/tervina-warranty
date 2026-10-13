import { useEffect, useState } from 'react'
import { loadDashboard, type DashboardData } from './adminApi'

export function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    loadDashboard()
      .then((d) => {
        if (active) setData(d)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'تعذر تحميل الإحصائيات.')
      })
    return () => {
      active = false
    }
  }, [])

  if (error) {
    return <p className="rounded-lg bg-danger-700/10 px-3 py-2 text-sm text-danger-700">{error}</p>
  }
  if (!data) {
    return <p className="py-12 text-center text-ink-500">جارٍ التحميل...</p>
  }

  const cards = [
    { label: 'إجمالي الطلبات', value: data.total },
    { label: 'قيد المراجعة', value: data.pending },
    { label: 'تمت الموافقة', value: data.approved },
    { label: 'مرفوضة', value: data.declined },
    { label: 'تم الإرسال للعميل', value: data.sent },
    { label: 'صور تم رفعها', value: data.exported },
    { label: 'طلبات اليوم', value: data.today },
    { label: 'طلبات الشهر', value: data.month },
  ]

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-card border border-ink-100 bg-white p-4">
            <p className="text-xs text-ink-400">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-brand-700">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Distribution title="حسب الصنف" rows={data.byItem} total={data.total} />
        <Distribution title="حسب القطاع" rows={data.bySector} total={data.total} />
        <Distribution title="حسب المحافظة" rows={data.byGovernorate} total={data.total} />
      </div>
    </div>
  )
}

function Distribution({
  title,
  rows,
  total,
}: {
  title: string
  rows: Array<{ label: string; count: number }>
  total: number
}) {
  return (
    <div className="rounded-card border border-ink-100 bg-white p-4">
      <h2 className="mb-3 text-sm font-bold text-ink-900">{title}</h2>
      {rows.length === 0 && <p className="text-xs text-ink-400">لا توجد بيانات.</p>}
      <ul className="grid gap-2">
        {rows.map((row) => {
          const pct = total > 0 ? Math.round((row.count / total) * 100) : 0
          return (
            <li key={row.label}>
              <div className="flex justify-between text-xs text-ink-600">
                <span>{row.label}</span>
                <span>{row.count}</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
