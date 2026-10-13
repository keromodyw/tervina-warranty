/**
 * Step 2 validation. The cross-field rule (product_type must belong to the
 * chosen item_type) is enforced here AND in the DB, so a hand-crafted payload
 * with a mismatched pair is rejected server-side too (M4 gate).
 */
import { z } from 'zod'
import { ITEM_TYPES, CAPACITIES, productTypesFor, type ItemType } from '@/data/productOptions'
import type { ProductDraft } from '@/core/session/session'

export const productSchema = z
  .object({
    item_type: z.string().min(1, 'الصنف مطلوب'),
    product_type: z.string().min(1, 'نوع المنتج مطلوب'),
    capacity: z.string().min(1, 'القدرة مطلوبة'),
    serial: z.string(),
    warranty_months: z.number().int().nullable(),
  })
  .superRefine((value, ctx) => {
    if (!(ITEM_TYPES as readonly string[]).includes(value.item_type)) {
      ctx.addIssue({ code: 'custom', path: ['item_type'], message: 'اختر صنفًا صحيحًا' })
      return
    }
    if (!productTypesFor(value.item_type).includes(value.product_type)) {
      ctx.addIssue({
        code: 'custom',
        path: ['product_type'],
        message: 'اختر نوع منتج تابعًا للصنف',
      })
    }
    if (!(CAPACITIES as readonly string[]).includes(value.capacity)) {
      ctx.addIssue({ code: 'custom', path: ['capacity'], message: 'اختر القدرة' })
    }
  })

export function isItemType(value: string): value is ItemType {
  return (ITEM_TYPES as readonly string[]).includes(value)
}

export function parseProduct(draft: ProductDraft) {
  return productSchema.safeParse(draft)
}
