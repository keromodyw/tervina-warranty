/**
 * Serial validation.
 *
 * PROJECT_MAP [Serial rules]:
 *   - stored as text, never parseInt'd
 *   - digits only
 *   - NO fixed length (no real samples yet - do not invent one)
 *
 * Keeping it text is not over-caution: a Code128 payload can be all digits and
 * still exceed Number.MAX_SAFE_INTEGER, and leading zeros would be destroyed by
 * any numeric cast.
 */

export const MAX_SERIAL_LENGTH = 40

export type SerialCheck =
  | { ok: true; serial: string }
  | { ok: false; reason: 'empty' | 'non_digits' | 'too_long' }

/**
 * Validate a decoded or typed serial.
 *
 * Leading zeros are PRESERVED. They may be significant, and the barcode is the
 * source of truth - never reformat what the label says.
 */
export function checkSerial(raw: string): SerialCheck {
  const trimmed = raw.trim()

  if (trimmed === '') return { ok: false, reason: 'empty' }
  if (!/^[0-9]+$/.test(trimmed)) return { ok: false, reason: 'non_digits' }
  if (trimmed.length > MAX_SERIAL_LENGTH) return { ok: false, reason: 'too_long' }

  return { ok: true, serial: trimmed }
}

export function isValidSerial(raw: string): boolean {
  return checkSerial(raw).ok
}

export function serialErrorMessage(reason: 'empty' | 'non_digits' | 'too_long'): string {
  switch (reason) {
    case 'empty':
      return 'من فضلك أدخل الرقم المكتوب على الملصق'
    case 'non_digits':
      return 'الرقم يجب أن يتكون من أرقام فقط'
    case 'too_long':
      return `الرقم طويل جدًا (الحد الأقصى ${MAX_SERIAL_LENGTH} رقمًا)`
  }
}

/**
 * Symbology check for decoded barcodes. Code128 is the agreed format (D16);
 * anything else means we pointed the camera at the wrong thing (a QR code on an
 * invoice, say) and must not silently store that value as the serial.
 */
export function isAcceptedFormat(format: string): boolean {
  return format.replace(/[-_\s]/g, '').toUpperCase() === 'CODE128'
}
