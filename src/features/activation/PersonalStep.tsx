import { useState, type FormEvent } from 'react'
import { GOVERNORATES } from '@/data/governorates'
import { sectorFor } from '@/core/data/sector'
import { phoneHint } from '@/core/lib/phone'
import type { PersonalDraft } from '@/core/session/session'
import { personalSchema } from './personal'
import { Field, inputClass, readOnlyClass } from './Field'

type Props = {
  value: PersonalDraft
  onChange: (patch: Partial<PersonalDraft>) => void
  onSubmit: (personal: PersonalDraft) => void
  busy?: boolean
  submitError?: string | null
}

type Errors = Partial<Record<keyof PersonalDraft, string>>

export function PersonalStep({ value, onChange, onSubmit, busy = false, submitError = null }: Props) {
  const [errors, setErrors] = useState<Errors>({})

  const cities = GOVERNORATES.find((g) => g.name === value.governorate)?.cities ?? []
  const sector = value.governorate === '' ? null : sectorFor(value.governorate)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = personalSchema.safeParse(value)
    if (!parsed.success) {
      const next: Errors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof PersonalDraft | undefined
        if (key && next[key] === undefined) next[key] = issue.message
      }
      setErrors(next)
      return
    }
    setErrors({})
    onSubmit(parsed.data)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <Field label="الاسم بالكامل" htmlFor="full_name" error={errors.full_name}>
        <input
          id="full_name"
          name="full_name"
          type="text"
          autoComplete="name"
          className={inputClass}
          value={value.full_name}
          onChange={(e) => onChange({ full_name: e.target.value })}
        />
      </Field>

      <Field label="رقم الواتساب" htmlFor="phone" error={errors.phone} hint={phoneHint()}>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          className={inputClass}
          value={value.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
        />
      </Field>

      <Field label="اسم الفني" htmlFor="technician_name" error={errors.technician_name}>
        <input
          id="technician_name"
          name="technician_name"
          type="text"
          className={inputClass}
          value={value.technician_name}
          onChange={(e) => onChange({ technician_name: e.target.value })}
        />
      </Field>

      <Field label="رقم هاتف الفني" htmlFor="technician_phone" error={errors.technician_phone}>
        <input
          id="technician_phone"
          name="technician_phone"
          type="tel"
          inputMode="tel"
          dir="ltr"
          className={inputClass}
          value={value.technician_phone}
          onChange={(e) => onChange({ technician_phone: e.target.value })}
        />
      </Field>

      <Field label="المحافظة" htmlFor="governorate" error={errors.governorate}>
        <select
          id="governorate"
          name="governorate"
          className={inputClass}
          value={value.governorate}
          onChange={(e) => onChange({ governorate: e.target.value, city: '' })}
        >
          <option value="">اختر المحافظة</option>
          {GOVERNORATES.map((g) => (
            <option key={g.name} value={g.name}>
              {g.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="المركز" htmlFor="city" error={errors.city}>
        <select
          id="city"
          name="city"
          className={inputClass}
          value={value.city}
          disabled={cities.length === 0}
          onChange={(e) => onChange({ city: e.target.value })}
        >
          <option value="">{cities.length === 0 ? 'اختر المحافظة أولًا' : 'اختر المركز'}</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </Field>

      <Field label="القطاع" htmlFor="sector">
        <input
          id="sector"
          name="sector"
          type="text"
          readOnly
          tabIndex={-1}
          className={readOnlyClass}
          value={sector ?? ''}
          placeholder="يُحدد تلقائيًا من المحافظة"
        />
      </Field>

      {submitError && (
        <p role="alert" className="rounded-lg bg-danger-700/10 px-3 py-2 text-sm font-medium text-danger-700">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-card bg-brand-600 px-6 py-3 font-bold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'جارٍ الحفظ...' : 'التالي'}
      </button>
    </form>
  )
}
