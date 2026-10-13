import { useEffect, useState } from 'react'
import { currentStaffUserId } from './auth'
import { addStaff, listStaff, setStaffActive, type StaffRow } from './staffApi'

/**
 * Staff management (D28). Admins add colleagues by email; the person signs up
 * with that same email and the database links their account. Deactivating keeps
 * the audit trail (past reviews stay attributed).
 */
export function AdminStaff() {
  const [rows, setRows] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    try {
      setRows(await listStaff())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل قائمة الموظفين.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  async function handleAdd() {
    if (email.trim() === '' || fullName.trim() === '') {
      setError('الاسم والبريد الإلكتروني مطلوبان.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await addStaff(email, fullName, await currentStaffUserId())
      setEmail('')
      setFullName('')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إضافة الموظف.')
    } finally {
      setBusy(false)
    }
  }

  async function handleToggle(row: StaffRow) {
    setBusy(true)
    setError(null)
    try {
      await setStaffActive(row.id, !row.is_active)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث الحالة.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-5">
      <div className="rounded-card border border-ink-100 bg-white p-4">
        <h2 className="mb-3 font-bold text-ink-800">إضافة موظف</h2>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="الاسم"
            className="w-48 rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
          <input
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="w-56 rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleAdd()}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            إضافة
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-400">
          أضف البريد الإلكتروني الذي سيستخدمه الموظف لتسجيل الدخول. عند إنشاء حسابه سيتم الربط تلقائيًا.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-700/10 px-3 py-2 text-sm text-danger-700">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-card border border-ink-100 bg-white">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-ink-50 text-xs text-ink-500">
            <tr>
              <th className="p-3 text-start font-medium">الاسم</th>
              <th className="p-3 text-start font-medium">البريد الإلكتروني</th>
              <th className="p-3 text-start font-medium">الحالة</th>
              <th className="p-3 text-start font-medium">ربط الحساب</th>
              <th className="p-3 text-start font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-ink-100">
                <td className="p-3">{row.full_name}</td>
                <td dir="ltr" className="p-3 text-ink-600">{row.email}</td>
                <td className="p-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      row.is_active ? 'bg-success-600/10 text-success-600' : 'bg-ink-100 text-ink-500'
                    }`}
                  >
                    {row.is_active ? 'نشط' : 'موقوف'}
                  </span>
                </td>
                <td className="p-3 text-xs text-ink-400">{row.user_id ? 'مرتبط' : 'في الانتظار'}</td>
                <td className="p-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleToggle(row)}
                    className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-50 disabled:opacity-60"
                  >
                    {row.is_active ? 'إيقاف' : 'تنشيط'}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-ink-400">لا يوجد موظفون.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
