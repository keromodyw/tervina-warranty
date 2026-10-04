import { Link } from 'react-router'

/**
 * The two actions from the reference landing page (D13). Stubs for M0 —
 * real navigation targets land with their milestones.
 */
export function HomePage() {
  return (
    <div className="mx-auto max-w-2xl py-10 text-center">
      <h1 className="text-2xl font-bold text-brand-800">تفعيل ضمان المنتجات</h1>
      <p className="mt-3 text-ink-500">
        فعّل ضمان المنتج الخاص بك، أو تابع حالة طلبك السابق.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          to="/ar/activation"
          className="rounded-card bg-brand-600 px-6 py-4 font-bold text-white transition-colors hover:bg-brand-700"
        >
          تفعيل ضمان منتج
        </Link>
        <Link
          to="/ar/track"
          className="rounded-card border-2 border-brand-600 px-6 py-4 font-bold text-brand-600 transition-colors hover:bg-brand-50"
        >
          تتبع طلبك
        </Link>
      </div>
    </div>
  )
}