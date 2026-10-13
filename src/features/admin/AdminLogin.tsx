import { useState, type FormEvent } from 'react'
import { signInStaff } from './auth'

/** Staff login. Credentials are checked by Supabase Auth; authorisation (the
 * staff row) is checked by RLS immediately after in useStaff(). */
export function AdminLogin({ onSuccess, notStaff = false }: { onSuccess: () => void; notStaff?: boolean }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signInStaff(email.trim(), password)
      onSuccess()
    } catch {
      setError('بيانات الدخول غير صحيحة.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm rounded-card border border-ink-100 bg-white p-6">
      <h1 className="text-lg font-bold text-brand-800">دخول فريق العمل</h1>
      <p className="mt-1 text-sm text-ink-500">هذه الصفحة مخصّصة للمراجعة الداخلية فقط.</p>

      {notStaff && (
        <p className="mt-4 rounded-lg bg-warning-600/10 px-3 py-2 text-sm text-warning-600">
          هذا الحساب مسجّل لكنه غير مصرّح له بالدخول. تواصل مع مسؤول النظام لإضافتك.
        </p>
      )}

      <form onSubmit={submit} noValidate className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-ink-700">البريد الإلكتروني</span>
          <input
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            className="rounded-lg border border-ink-200 px-3 py-2 text-start outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-ink-700">كلمة المرور</span>
          <input
            type="password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="rounded-lg border border-ink-200 px-3 py-2 text-start outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-danger-700/10 px-3 py-2 text-sm text-danger-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || email.trim() === '' || password === ''}
          className="rounded-card bg-brand-600 px-5 py-3 font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? '...' : 'دخول'}
        </button>
      </form>
    </div>
  )
}
