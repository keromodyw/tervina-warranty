import { describe, expect, it } from 'vitest'
import { normalizePhone, isValidE164, phoneForStorage } from './phone'

/**
 * These cases are also mirrored in supabase/migrations/..._02_helpers.sql
 * (public.normalize_phone) and asserted by the SQL side. If the two ever drift,
 * tracking returns zero rows for a real customer with no error - so the shared
 * cases live here and are called out in both files.
 */
describe('normalizePhone', () => {
  it('normalises the local 01x form', () => {
    expect(normalizePhone('01012345678')).toBe('+201012345678')
    expect(normalizePhone('01112345678')).toBe('+201112345678')
    expect(normalizePhone('01212345678')).toBe('+201212345678')
    expect(normalizePhone('01512345678')).toBe('+201512345678')
  })

  it('accepts an already-normalised number unchanged', () => {
    expect(normalizePhone('+201012345678')).toBe('+201012345678')
  })

  it('accepts the 20-prefixed form without a plus', () => {
    expect(normalizePhone('201012345678')).toBe('+201012345678')
  })

  it('strips spaces, dashes and Arabic-Indic digits', () => {
    expect(normalizePhone('010 1234 5678')).toBe('+201012345678')
    expect(normalizePhone('010-1234-5678')).toBe('+201012345678')
    expect(normalizePhone('٠١٠١٢٣٤٥٦٧٨')).toBe('+201012345678')
  })

  it('treats a bare 10-digit local as a national number', () => {
    expect(normalizePhone('1234567890')).toBe('+201234567890')
  })

  it('returns null for empty and nullish input', () => {
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone('   ')).toBeNull()
    expect(normalizePhone('----')).toBeNull()
    expect(normalizePhone(null)).toBeNull()
    expect(normalizePhone(undefined)).toBeNull()
  })

  it('does not collapse a number with a country code other than 20', () => {
    // Must not be mangled into an Egyptian number.
    expect(normalizePhone('+14155552671')).toBe('+14155552671')
  })
})

describe('isValidE164', () => {
  it('mirrors the customers_phone_is_e164 CHECK', () => {
    expect(isValidE164('+201012345678')).toBe(true)
    expect(isValidE164('+201234567')).toBe(true)
    expect(isValidE164('201012345678')).toBe(false)
    expect(isValidE164('+001012345678')).toBe(false)
    expect(isValidE164('')).toBe(false)
  })
})

describe('phoneForStorage', () => {
  it('returns a storable value for a real number', () => {
    expect(phoneForStorage('01012345678')).toBe('+201012345678')
  })

  it('returns null rather than persisting junk', () => {
    expect(phoneForStorage('abc')).toBeNull()
    expect(phoneForStorage('')).toBeNull()
  })
})
