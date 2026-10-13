/**
 * Step 1 validation. Mirrors the customers table constraints so the form can
 * reject bad input before an anonymous session is created - the customer should
 * never discover a problem three steps later at submit (M7).
 */
import { z } from 'zod'
import { GOVERNORATES } from '@/data/governorates'
import { phoneForStorage } from '@/core/lib/phone'
import { sectorFor } from '@/core/data/sector'
import type { PersonalDraft } from '@/core/session/session'

const GOVERNORATE_BY_NAME = new Map(GOVERNORATES.map((g) => [g.name, g]))

export const personalSchema = z
  .object({
    full_name: z.string().trim().min(3, 'الاسم قصير جدًا'),
    phone: z.string().trim().min(1, 'رقم الواتساب مطلوب'),
    technician_name: z.string().trim().min(3, 'اسم الفني قصير جدًا'),
    technician_phone: z.string().trim().min(1, 'رقم هاتف الفني مطلوب'),
    governorate: z.string().min(1, 'المحافظة مطلوبة'),
    city: z.string().min(1, 'المركز مطلوب'),
  })
  .superRefine((value, ctx) => {
    if (phoneForStorage(value.phone) === null) {
      ctx.addIssue({ code: 'custom', path: ['phone'], message: 'رقم الواتساب غير صالح' })
    }
    if (phoneForStorage(value.technician_phone) === null) {
      ctx.addIssue({ code: 'custom', path: ['technician_phone'], message: 'رقم هاتف الفني غير صالح' })
    }

    const governorate = GOVERNORATE_BY_NAME.get(value.governorate)
    if (!governorate) {
      ctx.addIssue({ code: 'custom', path: ['governorate'], message: 'اختر محافظة من القائمة' })
      return
    }
    if (!sectorFor(value.governorate)) {
      ctx.addIssue({ code: 'custom', path: ['governorate'], message: 'تعذر تحديد القطاع لهذه المحافظة' })
    }
    if (!governorate.cities.includes(value.city)) {
      ctx.addIssue({ code: 'custom', path: ['city'], message: 'اختر مركزًا تابعًا لهذه المحافظة' })
    }
  })

/** Parses the draft into the trimmed, validated shape used on submit. */
export function parsePersonal(draft: PersonalDraft) {
  return personalSchema.safeParse(draft)
}
