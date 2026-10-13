import { NavLink, Link, Outlet } from 'react-router'
import { cn } from '@/core/lib/cn'
import headerLogo from '@/assets/header-logo.png'
import footerPhoto from '@/assets/footer-photo.png'

const NAV = [
  { to: '/ar/activation', label: 'الرئيسية', end: true },
  { to: '/ar/activation/new', label: 'تفعيل الضمان', end: false },
  { to: '/ar/activation/track', label: 'تتبع طلبك', end: false },
] as const

export function AppShell() {
  return (
    <div dir="rtl" className="flex min-h-dvh flex-col bg-surface">
      <header className="border-b border-ink-100 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/ar/activation" className="flex items-center">
            <img src={headerLogo} alt="ترفينا" className="h-10 w-auto sm:h-12" />
          </Link>
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
        <img src={footerPhoto} alt="ترفينا" className="h-auto w-full object-cover" />
      </footer>
    </div>
  )
}
