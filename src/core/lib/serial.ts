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
 * Symbology whitelist for decoded barcodes.
 *
 * The serial label is Code128, but pumps in the field also turn up with Code39,
 * ITF and Codabar markings, so every common 1-D (linear) symbology is accepted -
 * the serial itself is still validated as digits-only by checkSerial(), so a
 * letter-bearing payload can never be stored. 2-D codes (QR / Data Matrix /
 * PDF417 / Aztec) are deliberately NOT accepted: those are what appear on
 * invoices and forms, and pointing the camera at one must not silently become
 * the serial.
 */
const ACCEPTED_FORMATS = new Set([
  'CODE128',
  'CODE39',
  'CODE39STD',
  'CODE39EXT',
  'CODE93',
  'CODE32',
  'PZN',
  'ITF',
  'ITF14',
  'CODABAR',
  'EAN13',
  'EAN8',
  'ISBN',
  'UPCA',
  'UPCE',
  'DATABAR',
  'DATABAROMNI',
  'DATABARSTK',
  'DATABARSTKOMNI',
  'DATABARLTD',
  'DATABAREXP',
  'DATABAREXPSTK',
  'TELEPEN',
  'TELEPENALPHA',
  'TELEPENNUMERIC',
])

export function isAcceptedFormat(format: string): boolean {
  return ACCEPTED_FORMATS.has(format.replace(/[-_\s]/g, '').toUpperCase())
}
