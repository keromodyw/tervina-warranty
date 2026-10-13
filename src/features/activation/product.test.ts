import { describe, expect, it } from 'vitest'
import { productSchema } from './product'
import type { ProductDraft } from '@/core/session/session'

function draft(overrides: Partial<ProductDraft> = {}): ProductDraft {
  return {
    item_type: 'طلمبات اعماق',
    product_type: 'فاما',
    capacity: '1ح',
    serial: '',
    warranty_months: 60,
    ...overrides,
  }
}

describe('productSchema', () => {
  it('accepts a valid cross-field pair', () => {
    expect(productSchema.safeParse(draft()).success).toBe(true)
  })

  it('rejects a product_type that does not belong to the item_type', () => {
    // ماتريكس belongs to "طلمبات ايطالى تحضير", not "طلمبات اعماق".
    const result = productSchema.safeParse(draft({ item_type: 'طلمبات اعماق', product_type: 'ماتريكس' }))
    expect(result.success).toBe(false)
  })

  it('accepts the same product under a different item', () => {
    // فاما is valid under both اعماق and ايطالى تحضير - the key is the pair.
    expect(productSchema.safeParse(draft({ item_type: 'طلمبات غاطس', product_type: 'فاما' })).success).toBe(true)
  })

  it('rejects an unknown item_type', () => {
    expect(productSchema.safeParse(draft({ item_type: 'أشياء' })).success).toBe(false)
  })

  it('rejects an invalid capacity', () => {
    expect(productSchema.safeParse(draft({ capacity: '9ح' })).success).toBe(false)
  })
})
