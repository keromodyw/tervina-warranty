import { Link } from 'react-router'
import type { SubmitResult } from '@/core/claims/submit'

/**
 * Shown after a successful submit. The wizard has already reset the draft to a
 * fresh step 1 (personal info retained), so "new activation" just returns to it.
 */
export function SuccessStep({ result, onNew }: { result: SubmitResult; onNew: () => void }) {
  return (
    <div className="rounded-card border border-ink-100 bg-white p-6 text-center">
      <p className="text-lg font-bold text-success-600">تم إرسال طلب التفعيل بنجاح</p>
      <p className="mt-2 text-sm text-ink-500">كود التفعيل الخاص بك</p>
      <p
        dir="ltr"
        className="mt-1 select-all rounded-lg bg-ink-50 px-4 py-3 text-xl font-bold tracking-widest text-brand-700"
      >
        {result.activationCode}
      </p>
      <p className="mt-3 text-sm text-ink-500">
        سيتم مراجعة الطلب، ويمكنك متابعة حالته برقمك في أي وقت.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          to="/ar/activation/track"
          className="rounded-card bg-brand-600 px-6 py-3 font-bold text-white hover:bg-brand-700"
        >
          متابعة الطلب
        </Link>
        <button
          type="button"
          onClick={onNew}
          className="rounded-card border border-ink-200 px-6 py-3 font-semibold text-ink-600 hover:bg-ink-50"
        >
          تفعيل منتج آخر
        </button>
      </div>
    </div>
  )
}
