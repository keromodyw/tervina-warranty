/**
 * M0 stub. The 4-step wizard arrives across M3–M7:
 *   PersonalStep → ProductStep → PhotoStep → ReviewStep → SuccessStep
 * Order matters: item_type must be known before the photo manifest can exist
 * (D13/D14).
 */
export function ActivationPage() {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <h1 className="text-xl font-bold text-brand-800">تفعيل الضمان</h1>
      <p className="mt-2 text-ink-500">
        أربع خطوات: البيانات الشخصية ← بيانات المنتج ← التصوير ← المراجعة.
      </p>
    </div>
  )
}