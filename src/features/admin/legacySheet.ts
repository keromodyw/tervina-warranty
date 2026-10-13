import type { AdminClaim } from './adminApi'
import { sectorFor } from '@/core/data/sector'

/**
 * The client's legacy warranty ledger (`Last Update 2026.xlsx` -> Sheet1), 23
 * columns A->W, header row only. One mapping drives BOTH the Excel export and
 * the legacy import so they can never drift.
 *
 * Why the importer reads by POSITION, not header name: three columns share the
 * identical header `رقم التليفون` (technician K, owner O, dealer T). Name-based
 * lookup would be ambiguous. The layout is fixed and documented, so position is
 * the safe key; the exporter writes the exact headers so round-trips line up.
 */
export const SHEET_NAME = 'Sheet1'

export const SHEET_HEADERS = [
  'كود التفعيله',
  'سريال الماتور',
  'بدايه الضمان',
  'مده الضمان',
  'نهايه الضمان',
  'نوع الصنف',
  'نوع الموتور',
  'القدرة',
  'كود الفنى',
  'اسم الفني',
  'رقم التليفون',
  'الرقم القومي',
  'صورة البطاقة',
  'اسم المالك',
  'رقم التليفون',
  'المحافظة',
  'المركز',
  'القطاع',
  'اسم التاجر',
  'رقم التليفون',
  'بصوره',
  'اسم الموظف',
  'ملاحظات',
] as const

/** Column indexes (0-based) the importer cares about. */
const COL = {
  serial: 1,
  warrantyStart: 2,
  warrantyMonths: 3,
  itemType: 5,
  productType: 6,
  capacity: 7,
  technicianName: 9,
  technicianPhone: 10,
  fullName: 13,
  phone: 14,
  governorate: 15,
  city: 16,
  sector: 17,
  notes: 22,
} as const

export function claimToRow(claim: AdminClaim): Array<string | number> {
  const c = claim.customer
  const row: Array<string | number> = new Array(SHEET_HEADERS.length).fill('')
  row[0] = claim.activation_code ?? ''
  row[1] = claim.serial
  row[2] = claim.warranty_start ?? ''
  row[3] = claim.warranty_months ?? ''
  row[4] = claim.warranty_end ?? ''
  row[5] = claim.item_type
  row[6] = claim.product_type
  row[7] = claim.capacity ?? ''
  row[8] = ''
  row[9] = claim.technician_name ?? ''
  row[10] = claim.technician_phone ?? ''
  row[11] = ''
  row[12] = ''
  row[13] = c?.full_name ?? ''
  row[14] = c?.phone ?? ''
  row[15] = c?.governorate ?? ''
  row[16] = c?.city ?? ''
  row[17] = c?.sector ?? ''
  row[18] = ''
  row[19] = ''
  row[20] = ''
  row[21] = ''
  row[22] = claim.notes ?? ''
  return row
}

export type LegacyRow = {
  serial: string
  warranty_start: string | null
  warranty_months: number | null
  item_type: string
  product_type: string
  capacity: string | null
  technician_name: string | null
  technician_phone: string | null
  full_name: string
  phone: string
  governorate: string
  city: string
  sector: string
  notes: string | null
}

export type LegacyParseResult = { row: LegacyRow } | { error: string }

function text(value: unknown): string {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).trim()
}

function int(value: unknown): number | null {
  const raw = text(value)
  if (raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

/** ISO yyyy-mm-dd for a Date cell or a parseable string; null otherwise. */
function dateText(value: unknown): string | null {
  if (value == null || value === '') return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  const raw = String(value).trim()
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) return `${iso[1]}-${iso[2]!.padStart(2, '0')}-${iso[3]!.padStart(2, '0')}`
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

/** One worksheet row -> a claim draft, or a per-row error string. */
export function parseLegacyRow(values: Array<unknown>): LegacyParseResult {
  const serial = text(values[COL.serial])
  if (serial === '') return { error: 'السيريال مفقود' }
  if (!/^[0-9]+$/.test(serial)) return { error: `السيريال غير صالح: ${serial}` }

  const fullName = text(values[COL.fullName])
  const phone = text(values[COL.phone])
  const governorate = text(values[COL.governorate])
  const city = text(values[COL.city])
  if (fullName === '') return { error: 'اسم المالك مفقود' }
  if (phone === '') return { error: 'رقم التليفون مفقود' }
  if (governorate === '') return { error: 'المحافظة مفقودة' }
  if (city === '') return { error: 'المركز مفقود' }

  const sector = text(values[COL.sector]) || sectorFor(governorate)
  if (!sector) return { error: 'تعذر تحديد القطاع من المحافظة' }

  const itemType = text(values[COL.itemType])
  const productType = text(values[COL.productType])
  if (itemType === '') return { error: 'الصنف مفقود' }
  if (productType === '') return { error: 'نوع الموتور مفقود' }

  return {
    row: {
      serial,
      warranty_start: dateText(values[COL.warrantyStart]),
      warranty_months: int(values[COL.warrantyMonths]),
      item_type: itemType,
      product_type: productType,
      capacity: text(values[COL.capacity]) || null,
      technician_name: text(values[COL.technicianName]) || null,
      technician_phone: text(values[COL.technicianPhone]) || null,
      full_name: fullName,
      phone,
      governorate,
      city,
      sector,
      notes: text(values[COL.notes]) || null,
    },
  }
}
