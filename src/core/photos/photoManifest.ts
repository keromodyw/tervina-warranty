/**
 * Conditional photo manifest (D13/D14). The shots required depend on item_type:
 * the two water-treatment ("تحضير") pumps need a rosetta label + bowl barcode;
 * everything else needs a product label. `invoice` is manual and optional for
 * every type, so it can never block the flow.
 *
 * kinds must stay in lockstep with:
 *   - claim_photos_kind_valid and claim_photos_path_fmt in ..._06_claim_photos.sql
 *   - the storage policies in ..._09_storage.sql
 */
import type { ItemType } from '@/data/productOptions'

export type PhotoKind = 'rosetta_label' | 'bowl_barcode' | 'product_label' | 'invoice'
export type CaptureMode = 'auto' | 'manual'

export type Shot = {
  kind: PhotoKind
  mode: CaptureMode
  required: boolean
}

/** "تحضير" = the two water-treatment pumps. */
export const PREPARATION_TYPES: readonly ItemType[] = ['طلمبات ايطالى تحضير', 'طلمبات صينى تحضير']

export function isPreparationType(item: string): boolean {
  return (PREPARATION_TYPES as readonly string[]).includes(item)
}

export function manifestFor(item: string): Shot[] {
  if (isPreparationType(item)) {
    return [
      { kind: 'rosetta_label', mode: 'auto', required: true },
      // bowl barcode carries the Code128 -> serial.
      { kind: 'bowl_barcode', mode: 'auto', required: true },
      { kind: 'invoice', mode: 'manual', required: false },
    ]
  }
  return [
    { kind: 'product_label', mode: 'auto', required: true },
    { kind: 'invoice', mode: 'manual', required: false },
  ]
}

/** Arabic labels for the capture UI. */
export const SHOT_LABELS: Readonly<Record<PhotoKind, string>> = {
  rosetta_label: 'الملصق على الروزتة المعدن',
  bowl_barcode: 'الباركود على القصعة',
  product_label: 'ملصق المنتج',
  invoice: 'الفاتورة (اختياري)',
}

/** Which shots carry the Code128 serial. */
export const SERIAL_SHOT_KINDS: readonly PhotoKind[] = ['bowl_barcode', 'product_label']
