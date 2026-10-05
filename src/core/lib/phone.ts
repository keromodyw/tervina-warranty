/**
 * Egyptian phone normalisation.
 *
 * This MUST stay in lockstep with public.normalize_phone() in
 * supabase/migrations/20260101120100_02_helpers.sql. If the two disagree,
 * tracking silently returns zero rows for a customer who definitely exists -
 * a failure with no error message, only missing data. The test suite pins the
 * shared cases; see phone.test.ts.
 */

/** Arabic-Indic (٠-٩) and Eastern Arabic-Indic (۰-۹) folded to ASCII. */
const NON_ASCII_DIGITS = /[٠-٩۰-۹]/g
const NON_DIGIT = /[^0-9]/g

export function normalizePhone(raw: string | null | undefined): string | null {
  if (raw == null) return null

  // Order matters. Folding first is required: stripping non-ASCII first would
  // delete Arabic-Indic digits entirely and return null for a valid number typed
  // on an Arabic keyboard.
  const digits = raw.replace(NON_ASCII_DIGITS, foldArabicDigits).replace(NON_DIGIT, '')
  if (digits === '') return null

  // Branch order mirrors the SQL CASE exactly. Do not reorder.
  if (digits.startsWith('00')) {
    // International prefix written out, e.g. 0020...
    const rest = digits.slice(2)
    return rest === '' ? null : `+${rest}`
  }
  if (digits.startsWith('20') && digits.length === 12) return `+${digits}`
  if (digits.startsWith('0')) return `+20${stripLeadingZeros(digits.slice(1))}`
  // Egyptian mobile typed without its leading zero: 1012345678.
  if (digits.length === 10) return `+20${digits}`

  // Anything else already carries its own country code. Do NOT force it into an
  // Egyptian number - +1 415 555 2671 must survive intact.
  return `+${digits}`
}

function foldArabicDigits(ch: string): string {
  const c = ch.codePointAt(0)!
  if (c >= 0x0660 && c <= 0x0669) return String(c - 0x0660)
  return String(c - 0x06f0)
}

/** SQL ltrim(x, '0') - removes every leading zero, and returns '' if all are. */
function stripLeadingZeros(s: string): string {
  const out = s.replace(/^0+/, '')
  return out
}

/** Mirrors the customers_phone_is_e164 CHECK constraint. */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9][0-9]{7,14}$/.test(phone)
}

/**
 * Ready-to-store value, or null when the input cannot be a phone number.
 * Checked before submit so the CHECK constraint never has to reject a claim
 * after the customer has already filled in three steps.
 */
export function phoneForStorage(raw: string): string | null {
  const n = normalizePhone(raw)
  if (n === null || !isValidE164(n)) return null
  return n
}

/** Human-facing hint. Kept here so the wizard and the tracker cannot disagree. */
export function phoneHint(): string {
  return 'مثال: 01012345678'
}
