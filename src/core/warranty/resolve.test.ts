import { describe, expect, it } from 'vitest'
import { ITEM_TYPES, PRODUCT_TYPES_BY_ITEM, productTypesFor } from '@/data/productOptions'
import { WARRANTY_BASE } from './base'
import { buildWarrantyIndex, resolveWarrantyMonths, validateDurationMonths } from './resolve'

describe('generated warranty baseline', () => {
  it('covers every product in every item type', () => {
    for (const item of ITEM_TYPES) {
      const bucket = (WARRANTY_BASE as Record<string, Record<string, number | null>>)[item]
      expect(bucket, `no bucket for ${item}`).toBeDefined()
      for (const product of productTypesFor(item)) {
        expect(
          Object.prototype.hasOwnProperty.call(bucket, product),
          `${item} / ${product} missing from baseline`,
        ).toBe(true)
      }
    }
  })

  it('has exactly 22 product rules across the 6 item types', () => {
    const buckets = WARRANTY_BASE as Record<string, Record<string, number | null>>
    const total = Object.values(buckets).reduce((n, b) => n + Object.keys(b).length, 0)
    expect(Object.keys(buckets)).toHaveLength(6)
    expect(total).toBe(22)
  })

  it('uses a nested shape, not flattened computed keys', () => {
    // Regression guard. { ['item','product']: n } is stringified by JS to
    // "item,product"; a lookup joining with '' then matches nothing and every
    // product claims to have no warranty.
    for (const key of Object.keys(WARRANTY_BASE)) {
      expect(key.includes(',')).toBe(false)
      expect(typeof (WARRANTY_BASE as Record<string, unknown>)[key]).toBe('object')
    }
  })

  it('leaves the four sports-equipment products unconfigured', () => {
    // السباحة ships with NULL on purpose (D22), not missing data.
    for (const p of ['scp', 'sbp', 'lp', 'vmax']) {
      expect(resolveWarrantyMonths('سباحه', p)).toBeNull()
    }
  })

  it('resolves the agreed durations', () => {
    expect(resolveWarrantyMonths('طلمبات صينى تحضير', 'ترفينا')).toBe(24)
    expect(resolveWarrantyMonths('طلمبات صينى تحضير', 'ميرو')).toBe(12)
    expect(resolveWarrantyMonths('طلمبات ايطالى تحضير', 'ماتريكس')).toBe(84)
    expect(resolveWarrantyMonths('طلمبات ايطالى تحضير', 'رودلف')).toBe(36)
    expect(resolveWarrantyMonths('طلمبات اعماق', 'ترفينا')).toBe(60)
    expect(resolveWarrantyMonths('طلمبات غاطس', 'فاما')).toBe(60)
    expect(resolveWarrantyMonths('حمايه', 'خزان تيوبلس 19لتر')).toBe(12)
    expect(resolveWarrantyMonths('حمايه', 'خزان تيوبلس 24 لتر')).toBe(18)
  })
})

describe('resolveWarrantyMonths precedence', () => {
  const db = buildWarrantyIndex([
    { item_type: 'طلمبات صينى تحضير', product_type: 'ترفينا', warranty_months: 36 },
    { item_type: 'طلمبات صينى تحضير', product_type: 'ميرو', warranty_months: null },
    { item_type: 'حمايه', product_type: 'خزان تيوبلس 24 لتر', warranty_months: null },
  ])

  it('prefers the DB row over the generated baseline', () => {
    expect(resolveWarrantyMonths('طلمبات صينى تحضير', 'ترفينا', db)).toBe(36)
  })

  it('treats an explicit null row as authoritative, not as absent', () => {
    // This is the subtle one. ميرو is 12 in the baseline; an admin clearing it
    // must not see 12 come back, or the Settings field looks broken.
    expect(resolveWarrantyMonths('طلمبات صينى تحضير', 'ميرو', db)).toBeNull()
    // And a baseline-only resolution still returns 12 when no row exists.
    expect(resolveWarrantyMonths('طلمبات صينى تحضير', 'فرندس', db)).toBe(12)
  })

  it('falls back to the baseline when no row exists at all', () => {
    expect(resolveWarrantyMonths('طلمبات ايطالى تحضير', 'فينوكس', db)).toBe(36)
  })

  it('returns null for an unknown pair', () => {
    expect(resolveWarrantyMonths('سباحه', 'unknown', db)).toBeNull()
  })
})

describe('taxonomy integrity', () => {
  it('has a product list for all 6 item types', () => {
    for (const item of ITEM_TYPES) {
      expect(PRODUCT_TYPES_BY_ITEM[item]?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('does not leak a flat product list across cascades', () => {
    // حمايه products must not appear under طلمبات, and vice versa.
    expect(productTypesFor('حمايه')).not.toContain('ترفينا')
    expect(productTypesFor('طلمبات صينى تحضير')).not.toContain('scp')
  })
})

describe('validateDurationMonths', () => {
  it('treats empty as null, never 0', () => {
    expect(validateDurationMonths('')).toEqual({ ok: true, value: null })
    expect(validateDurationMonths('   ')).toEqual({ ok: true, value: null })
  })

  it('accepts a plain number including 0', () => {
    expect(validateDurationMonths('12')).toEqual({ ok: true, value: 12 })
    expect(validateDurationMonths('0')).toEqual({ ok: true, value: 0 })
  })

  it('rejects non-numeric input', () => {
    expect(validateDurationMonths('12 شهر').ok).toBe(false)
    expect(validateDurationMonths('-4').ok).toBe(false)
    expect(validateDurationMonths('1.5').ok).toBe(false)
  })

  it('rejects values beyond the DB check bound', () => {
    expect(validateDurationMonths('121').ok).toBe(false)
    expect(validateDurationMonths('9999').ok).toBe(false)
  })
})
