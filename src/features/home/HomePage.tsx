import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { hasIncompleteDraft } from '@/core/session/session'
import heroImage from '@/assets/hero.png'
import homePhoto from '@/assets/home-photo.png'

/**
 * Landing (dual action, D13). If an activation is genuinely in progress
 * (step > 1) the customer resumes with zero re-entry - the check lives in
 * session.ts so no PII is read here.
 */
export function HomePage() {
  const [resumable, setResumable] = useState(false)

  useEffect(() => {
    setResumable(hasIncompleteDraft())
  }, [])

  return (
    <div className="mx-auto max-w-3xl">
      <img src={heroImage} alt="" className="w-full rounded-card" />

      <div className="mt-8 text-center">
        <h1 className="text-2xl font-bold text-brand-800">تفعيل ضمان المنتجات</h1>
        <p className="mt-3 text-ink-500">
          فعّل ضمان المنتج الخاص بك، أو تابع حالة طلبك السابق.
        </p>
      </div>

      {resumable && (
        <div className="mt-6 rounded-card border border-warning-500/40 bg-warning-500/10 px-4 py-3 text-sm text-ink-700">
          لديك طلب قيد التفعيل لم يكتمل بعد.{' '}
          <Link to="/ar/activation/new" className="font-bold text-link hover:underline">
            متابعة التفعيل
          </Link>
        </div>
      )}

      <div className="mt-8 grid items-center gap-6 sm:grid-cols-2">
        <div className="grid gap-4">
          <Link
            to="/ar/activation/new"
            className="rounded-card bg-brand-600 px-6 py-4 text-center font-bold text-white transition-colors hover:bg-brand-700"
          >
            تفعيل ضمان منتج
          </Link>
          <Link
            to="/ar/activation/track"
            className="rounded-card border-2 border-brand-600 px-6 py-4 text-center font-bold text-brand-600 transition-colors hover:bg-brand-50"
          >
            تتبع طلبك
          </Link>
        </div>
        <img src={homePhoto} alt="" className="w-full rounded-card" />
      </div>
    </div>
  )
}
