/**
 * M0 stub. The staff gate is NOT a client-side check — every admin read/write is
 * authorised by RLS via the staff table (D28), so hiding this route is UX only.
 * The first admin must be bootstrapped by SQL; there is no admin yet to add one.
 */
export function AdminLayout() {
  return (
    <div className="mx-auto max-w-4xl py-10">
      <h1 className="text-xl font-bold text-brand-800">لوحة التحكم</h1>
      <p className="mt-2 text-ink-500">
        المخزن · الطلبات · الإعدادات · الأدمن
      </p>
    </div>
  )
}