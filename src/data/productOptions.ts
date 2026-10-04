// AUTO-GENERATED from "Last Update 2026.xlsx" -> sheet "code" (rows 53-60)
// Do not hand-edit. Regenerate with: node tools/gen-data.mjs

/** نوع الصنف - top level category */
export const ITEM_TYPES = [
  'طلمبات ايطالى تحضير',
  'طلمبات صينى تحضير',
  'طلمبات اعماق',
  'طلمبات غاطس',
  'حمايه',
  'سباحه',
] as const
export type ItemType = (typeof ITEM_TYPES)[number]

/**
 * نوع المنتج - CASCADING. Options depend on the selected نوع الصنف.
 * A flat list is WRONG here; see PROJECT_MAP.md [DECISIONS LOCKED].
 */
export const PRODUCT_TYPES_BY_ITEM: Record<ItemType, readonly string[]> = {
  ['طلمبات ايطالى تحضير']: ['فاما', 'ماتريكس', 'رافيلو', 'رودلف', 'فينوكس'],
  ['طلمبات صينى تحضير']: ['ترفينا', 'ترفينا بريمير', 'ميرو', 'ميرو بريمير', 'كيرمينا', 'كرمينا بريمير', 'فرندس'],
  ['طلمبات اعماق']: ['فاما', 'ترفينا'],
  ['طلمبات غاطس']: ['فاما', 'ترفينا'],
  ['حمايه']: ['خزان تيوبلس 19لتر', 'خزان تيوبلس 24 لتر'],
  ['سباحه']: ['scp', 'sbp', 'lp', 'vmax'],
}

/** القدرة - independent of item/product type */
export const CAPACITIES = ["0.5ح","1ح","1.5ح","2ح","3ح"] as const

/** الضمان بالشهر - from the sheet, NOT part of the v1 wizard (see ORPHANS O1) */
export const WARRANTY_MONTHS = [0,12,18,24,36,60,84] as const

export function productTypesFor(item: string): readonly string[] {
  return PRODUCT_TYPES_BY_ITEM[item as ItemType] ?? []
}
