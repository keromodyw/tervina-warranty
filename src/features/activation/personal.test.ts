import { describe, expect, it } from 'vitest'
import { personalSchema } from './personal'
import type { PersonalDraft } from '@/core/session/session'

function draft(overrides: Partial<PersonalDraft> = {}): PersonalDraft {
  return {
    full_name: 'محمد أحمد',
    phone: '01012345678',
    technician_name: 'فني التركيب',
    technician_phone: '01112345678',
    governorate: 'القاهرة',
    city: 'مدينة-نصر',
    ...overrides,
  }
}

describe('personalSchema', () => {
  it('accepts a complete, valid step-1 draft', () => {
    const result = personalSchema.safeParse(draft())
    expect(result.success).toBe(true)
  })

  it('rejects a too-short name', () => {
    const result = personalSchema.safeParse(draft({ full_name: 'أب' }))
    expect(result.success).toBe(false)
  })

  it('rejects a phone that is not a usable number', () => {
    expect(personalSchema.safeParse(draft({ phone: 'abc' })).success).toBe(false)
    expect(personalSchema.safeParse(draft({ technician_phone: '' })).success).toBe(false)
  })

  it('rejects a governorate outside the 27-name list', () => {
    const result = personalSchema.safeParse(draft({ governorate: 'أتلانتس', city: 'أي مكان' }))
    expect(result.success).toBe(false)
  })

  it('rejects a city that does not belong to the chosen governorate', () => {
    const result = personalSchema.safeParse(draft({ governorate: 'القاهرة', city: 'الإسكندرية' }))
    expect(result.success).toBe(false)
  })

  it('trims surrounding whitespace before validating', () => {
    const result = personalSchema.safeParse(draft({ full_name: '  محمد أحمد  ' }))
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.full_name).toBe('محمد أحمد')
  })
})
