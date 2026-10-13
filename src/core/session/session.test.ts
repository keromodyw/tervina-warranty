import { describe, expect, it } from 'vitest'
import {
  buildCustomerRow,
  freshDraft,
  parseDraft,
  serializeDraft,
  type PersonalDraft,
} from './session'

function personal(overrides: Partial<PersonalDraft> = {}): PersonalDraft {
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

describe('draft (de)serialisation', () => {
  it('round-trips a draft', () => {
    const draft = freshDraft()
    draft.personal = personal()
    draft.step = 2
    const parsed = parseDraft(serializeDraft(draft))
    expect(parsed).toEqual(draft)
  })

  it('returns null for absent, malformed or future drafts', () => {
    expect(parseDraft(null)).toBeNull()
    expect(parseDraft('')).toBeNull()
    expect(parseDraft('not json')).toBeNull()
    expect(parseDraft(JSON.stringify({ version: 2, step: 1 }))).toBeNull()
    expect(parseDraft(JSON.stringify({ version: 1, step: 1 }))).toBeNull()
  })
})

describe('buildCustomerRow', () => {
  it('normalises the phone and derives the sector', () => {
    const row = buildCustomerRow('user-1', personal())
    expect(row.auth_user_id).toBe('user-1')
    expect(row.phone).toBe('+201012345678')
    expect(row.sector).toBe('إقليم القاهرة')
    expect(row.full_name).toBe('محمد أحمد')
  })

  it('throws on an unusable phone rather than sending junk to the DB', () => {
    expect(() => buildCustomerRow('user-1', personal({ phone: 'abc' }))).toThrow()
  })

  it('throws when the governorate cannot resolve to a sector', () => {
    expect(() => buildCustomerRow('user-1', personal({ governorate: 'أتلانتس' }))).toThrow()
  })
})
