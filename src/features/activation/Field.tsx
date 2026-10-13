import type { ReactNode } from 'react'

export const inputClass =
  'w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-ink-900 outline-none focus:border-brand-500'

export const readOnlyClass =
  'w-full rounded-lg border border-ink-100 bg-brand-50 px-3 py-2 text-ink-500'

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  error?: string | undefined
  hint?: string | undefined
  children: ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink-700">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-ink-400">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-danger-700">
          {error}
        </p>
      )}
    </div>
  )
}
