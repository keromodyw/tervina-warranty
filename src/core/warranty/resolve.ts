import { WARRANTY_BASE } from './base'

/**
 * D22 resolution chain: DB row -> generated baseline -> null.
 *
 * Subtlety worth stating, because the spec's wording hides it: once a DB row
 * exists it is authoritative, INCLUDING when its duration is null. An admin who
 * clears a duration means "this product has no warranty" - falling back to the
 * baseline would resurrect the old 84 months and make the field look like it
 * refused to save. So "is this pair present?" decides, not a null check.
 *
 * The baseline only fills in pairs that have no row at all.
 *
 * Shape note: both layers are NESTED ({ item: { product: months } }) rather than
 * flattened with a joined key. A flattened computed key such as
 * { ['item','product']: n } is stringified by JS to "item,product", which
 * silently fails to match any lookup that joins with '' - every product would
 * resolve to null and every customer would be told the warranty is unconfigured.
 */
export type WarrantyRuleRow = {
  item_type: string
  product_type: string
  warranty_months: number | null
}

/** Nested lookup: item -> product -> duration. */
export type WarrantyIndex = Readonly<Record<string, Readonly<Record<string, number | null>>>>

export function buildWarrantyIndex(rows: readonly WarrantyRuleRow[]): WarrantyIndex {
  const out: Record<string, Record<string, number | null>> = {}
  for (const r of rows) {
    ;(out[r.item_type] ??= {})[r.product_type] = r.warranty_months
  }
  return out
}

const BASE = WARRANTY_BASE as WarrantyIndex

export function resolveWarrantyMonths(
  item: string,
  product: string,
  db?: WarrantyIndex,
): number | null {
  const fromDb = db?.[item]
  if (fromDb && Object.prototype.hasOwnProperty.call(fromDb, product)) {
    return fromDb[product] ?? null
  }

  const fromBase = BASE[item]
  if (fromBase && Object.prototype.hasOwnProperty.call(fromBase, product)) {
    return fromBase[product] ?? null
  }

  return null
}

/** True when no duration is configured, so the wizard can say so up front. */
export function isUnconfigured(item: string, product: string): boolean {
  return resolveWarrantyMonths(item, product) === null
}

/**
 * The 4 sports-equipment products (سباحه) ship with no duration. Admin sets them
 * in Settings; until then the wizard must not dead-end on submit, so it explains
 * the gap instead of failing silently.
 */
export function unconfiguredHint(): string {
  return 'مدة الضمان غير محددة لهذا المنتج بعد، وسيتم تحديثها من قِبل الإدارة.'
}

/** Validate the Settings editor before it is allowed to save a row. */
export function validateDurationMonths(input: string): {
  ok: boolean
  value: number | null
  error?: string
} {
  const trimmed = input.trim()

  // Empty means "not configured" and must save as NULL, never 0 (D22/D25).
  if (trimmed === '') return { ok: true, value: null }

  if (!/^[0-9]+$/.test(trimmed)) {
    return { ok: false, value: null, error: 'أدخل عددًا صحيحًا أو اتركه فارغًا' }
  }

  const n = Number(trimmed)
  if (n < 0 || n > 120) {
    return { ok: false, value: null, error: 'المدة يجب أن تكون بين 0 و 120 شهرًا' }
  }

  return { ok: true, value: n }
}
