import { NavLink, Outlet } from 'react-router'
import { cn } from '@/core/lib/cn'

const NAV: ReadonlyArray<{ to: string; label: string; end: boolean }> = [
  { to: '/', label: 'الرئيسية', end: true },
  { to: '/ar/activation', label: 'تفعيل الضمان', end: false },
  { to: '/ar/track', label: 'تتبع طلبك', end: false },
]

export function AppShell() {
  return (
    <div dir="rtl" className="flex min-h-dvh flex-col bg-surface">
      <header className="border-b border-ink-100 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <span className="text-lg font-bold text-brand-800">تروفينا</span>
          <nav className="flex items-center gap-1 text-sm">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-2 font-medium transition-colors',
                    isActive
                      ? 'bg-brand-50 text-brand-600'
                      : 'text-ink-500 hover:bg-brand-50 hover:text-brand-600',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-ink-100 bg-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-4 text-center text-sm text-ink-400">
          <p>
            للاستفسار عن الضمان اتصل على <span className="ltr-nums">19301</span>
          </p>
        </div>
      </footer>
    </div>
  )
}