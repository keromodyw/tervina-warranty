/**
 * Governorate -> official sector (D17).
 *
 * Keys MUST match the `name` strings in src/data/governorates.ts byte-for-byte.
 * This is not a theoretical concern: the workbook generator emits
 * `الاسماعيلية` (no hamza) while the PROJECT_MAP table was written as
 * `الإسماعيلية`. A key that differs by one character fails the lookup silently
 * and leaves the sector blank on an issued certificate.
 *
 * sector.test.ts asserts coverage of all 27 names from the generated data, so
 * that class of typo cannot reach production. The assertion is the safety net -
 * do not "fix" a failing test by editing this map.
 *
 * Sector values keep the `إقليم` prefix used by the PROJECT_MAP reference table.
 */
export const SECTOR_BY_GOVERNORATE: Readonly<Record<string, string>> = {
  // إقليم القاهرة (3)
  'القاهرة': 'إقليم القاهرة',
  'الجيزة': 'إقليم القاهرة',
  'القليوبية': 'إقليم القاهرة',

  // إقليم الإسكندرية (3)
  'الإسكندرية': 'إقليم الإسكندرية',
  'البحيرة': 'إقليم الإسكندرية',
  'مطروح': 'إقليم الإسكندرية',

  // إقليم الدلتا (5)
  'الدقهلية': 'إقليم الدلتا',
  'كفر الشيخ': 'إقليم الدلتا',
  'الغربية': 'إقليم الدلتا',
  'المنوفية': 'إقليم الدلتا',
  'دمياط': 'إقليم الدلتا',

  // إقليم القناة (7)
  'بورسعيد': 'إقليم القناة',
  'الاسماعيلية': 'إقليم القناة',
  'السويس': 'إقليم القناة',
  'الشرقية': 'إقليم القناة',
  'شمال سيناء': 'إقليم القناة',
  'جنوب سيناء': 'إقليم القناة',
  'البحر الأحمر': 'إقليم القناة',

  // إقليم شمال الصعيد (3)
  'بني سويف': 'إقليم شمال الصعيد',
  'المنيا': 'إقليم شمال الصعيد',
  'الفيوم': 'إقليم شمال الصعيد',

  // إقليم وسط الصعيد (2)
  'أسيوط': 'إقليم وسط الصعيد',
  'الوادي الجديد': 'إقليم وسط الصعيد',

  // إقليم جنوب الصعيد (4)
  'سوهاج': 'إقليم جنوب الصعيد',
  'قنا': 'إقليم جنوب الصعيد',
  'الأقصر': 'إقليم جنوب الصعيد',
  'أسوان': 'إقليم جنوب الصعيد',
}

export const SECTORS = [
  'إقليم القاهرة',
  'إقليم الإسكندرية',
  'إقليم الدلتا',
  'إقليم القناة',
  'إقليم شمال الصعيد',
  'إقليم وسط الصعيد',
  'إقليم جنوب الصعيد',
] as const

export type Sector = (typeof SECTORS)[number]

export function sectorFor(governorate: string): Sector | null {
  return (SECTOR_BY_GOVERNORATE[governorate] as Sector | undefined) ?? null
}

/**
 * The wizard auto-fills the sector and does not offer a manual override, so a
 * null here is a data bug the UI must surface rather than quietly submit null
 * (customers.sector is NOT NULL).
 */
export function sectorRequiredMessage(): string {
  return 'تعذر تحديد القطاع تلقائيًا، الرجاء اختيار المحافظة والمدينة مرة أخرى.'
}
