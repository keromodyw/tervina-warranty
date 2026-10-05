import { describe, expect, it } from 'vitest'
import { GOVERNORATE_NAMES } from '@/data/governorates'
import { SECTOR_BY_GOVERNORATE, SECTORS, sectorFor } from './sector'

/**
 * The safety net referenced in sector.ts. PROJECT_MAP asks for exactly this:
 * "= 3+3+5+7+3+2+4 = 27, no gaps. Unit test asserts exactly this."
 *
 * It exists because the two hand-maintained lists already disagreed once on
 * الاسماعيلية vs الإسماعيلية. A silent miss leaves sector blank on a
 * certificate, and customers.sector is NOT NULL, so it would surface as a
 * confusing submit failure for one governorate only.
 */
describe('sector mapping', () => {
  const names = [...GOVERNORATE_NAMES]

  it('covers all 27 governorates', () => {
    expect(names).toHaveLength(27)
  })

  it('maps every governorate name, byte-for-byte', () => {
    const missing = names.filter((g) => !(g in SECTOR_BY_GOVERNORATE))
    expect(missing).toEqual([])
  })

  it('has no sector entry for a name that no longer exists', () => {
    const known = new Set(names)
    const stale = Object.keys(SECTOR_BY_GOVERNORATE).filter((g) => !known.has(g))
    expect(stale).toEqual([])
  })

  it('assigns each governorate to exactly one sector', () => {
    // A duplicate would mean the object silently kept only the last value.
    expect(Object.keys(SECTOR_BY_GOVERNORATE)).toHaveLength(27)
  })

  it('uses only the 7 official sector labels', () => {
    const allowed = new Set<string>(SECTORS)
    const bad = Object.values(SECTOR_BY_GOVERNORATE).filter((s) => !allowed.has(s))
    expect(bad).toEqual([])
  })

  it('matches the locked 3+3+5+7+3+2+4 distribution', () => {
    const counts = new Map<string, number>()
    for (const s of Object.values(SECTOR_BY_GOVERNORATE)) {
      counts.set(s, (counts.get(s) ?? 0) + 1)
    }
    expect(
      SECTORS.map((s) => counts.get(s) ?? 0),
    ).toEqual([3, 3, 5, 7, 3, 2, 4])
  })

  it('returns null for an unknown governorate rather than guessing', () => {
    expect(sectorFor('محافظة غير موجودة')).toBeNull()
  })

  it('maps the Sinai and Red Sea governorates into the Canal sector', () => {
    // A known easy-to-get-wrong grouping, asserted explicitly.
    expect(sectorFor('شمال سيناء')).toBe('إقليم القناة')
    expect(sectorFor('جنوب سيناء')).toBe('إقليم القناة')
    expect(sectorFor('البحر الأحمر')).toBe('إقليم القناة')
  })

  it('spells Ismailia the way the generated workbook does', () => {
    // Generator emits الاسماعيلية; the PROJECT_MAP table said الإسماعيلية.
    // If someone "corrects" the spelling here, this test is what stops it.
    expect(sectorFor('الاسماعيلية')).toBe('إقليم القناة')
    expect(sectorFor('الإسماعيلية')).toBeNull()
  })
})
