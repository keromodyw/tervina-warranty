import { NavLink, Outlet } from 'react-router'
import { useStaff } from './useStaff'
import { AdminLogin } from './AdminLogin'

/**
 * Staff gate (B18/D28). This is UX only: every read/write is authorised by RLS
 * through the staff table, so a non-staff visitor who forced this route open
 * would still get zero rows from every query.
 */
const TABS = [
  { to: '/admin/orders', label: 'الطلبات' },
  { to: '/admin/dashboard', label: 'الإحصائيات' },
  { to: '/admin/settings', label: 'الإعدادات' },
  { to: '/admin/staff', label: 'الموظفون' },
] as const

export function AdminLayout() {
  const { loading, email, isStaff, notStaff, refresh, signOut } = useStaff()

  if (loading) {
    return <div className="py-24 text-center text-ink-500">جارٍ التحقق من الصلاحيات...</div>
  }

  if (!isStaff) {
    return <AdminLogin notStaff={notStaff} onSuccess={() => void refresh()} />
  }

  return (
    <div className="mx-auto w-full max-w-6xl py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-brand-800">لوحة مراجعة طلبات التفعيل</h1>
        <div className="flex items-center gap-3 text-sm">
          {email && <span dir="ltr" className="text-ink-500">{email}</span>}
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-md border border-ink-200 px-3 py-1.5 font-medium text-ink-600 hover:bg-ink-50"
          >
            خروج
          </button>
        </div>
      </header>

      <nav className="mt-4 flex gap-1 border-b border-ink-100">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                isActive
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-ink-500 hover:text-brand-600'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-5">
        <Outlet />
      </div>
    </div>
  )
}
