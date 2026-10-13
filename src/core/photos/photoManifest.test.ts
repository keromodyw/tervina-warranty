import { describe, expect, it } from 'vitest'
import { manifestFor, isPreparationType, SERIAL_SHOT_KINDS } from './photoManifest'

describe('manifestFor', () => {
  it('gives preparation pumps a rosetta label + bowl barcode + optional invoice', () => {
    const shots = manifestFor('طلمبات ايطالى تحضير')
    expect(shots.map((s) => s.kind)).toEqual(['rosetta_label', 'bowl_barcode', 'invoice'])
    expect(shots.filter((s) => s.required).map((s) => s.kind)).toEqual(['rosetta_label', 'bowl_barcode'])
  })

  it('gives everything else a product label + optional invoice', () => {
    const shots = manifestFor('طلمبات غاطس')
    expect(shots.map((s) => s.kind)).toEqual(['product_label', 'invoice'])
    expect(shots.filter((s) => s.required).map((s) => s.kind)).toEqual(['product_label'])
  })

  it('never marks the invoice as required or auto', () => {
    for (const item of ['طلمبات ايطالى تحضير', 'حمايه', 'سباحه']) {
      const invoice = manifestFor(item).find((s) => s.kind === 'invoice')
      expect(invoice).toMatchObject({ required: false, mode: 'manual' })
    }
  })

  it('classifies exactly the two preparation pumps', () => {
    expect(isPreparationType('طلمبات ايطالى تحضير')).toBe(true)
    expect(isPreparationType('طلمبات صينى تحضير')).toBe(true)
    expect(isPreparationType('طلمبات اعماق')).toBe(false)
  })

  it('carries the serial only on the barcode-bearing shots', () => {
    expect(SERIAL_SHOT_KINDS).toEqual(['bowl_barcode', 'product_label'])
  })
})
