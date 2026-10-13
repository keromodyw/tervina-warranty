import { describe, expect, it } from 'vitest'
import { checkSerial, isValidSerial, isAcceptedFormat, MAX_SERIAL_LENGTH } from './serial'

describe('checkSerial', () => {
  it('accepts digits-only of any length', () => {
    // No fixed length is known yet, so short and long must both pass.
    expect(checkSerial('12345')).toEqual({ ok: true, serial: '12345' })
    expect(checkSerial('9'.repeat(MAX_SERIAL_LENGTH))).toEqual({
      ok: true,
      serial: '9'.repeat(MAX_SERIAL_LENGTH),
    })
  })

  it('preserves leading zeros', () => {
    // A numeric cast would destroy these, which is why serial stays text.
    expect(checkSerial('00712345678')).toEqual({ ok: true, serial: '00712345678' })
  })

  it('trims surrounding whitespace from a decoded value', () => {
    expect(checkSerial('  123456  ')).toEqual({ ok: true, serial: '123456' })
  })

  it('rejects empty', () => {
    expect(checkSerial('')).toEqual({ ok: false, reason: 'empty' })
    expect(checkSerial('   ')).toEqual({ ok: false, reason: 'empty' })
  })

  it('rejects anything non-numeric', () => {
    expect(checkSerial('123-456')).toEqual({ ok: false, reason: 'non_digits' })
    expect(checkSerial('ABC123')).toEqual({ ok: false, reason: 'non_digits' })
    expect(checkSerial('١٢٣')).toEqual({ ok: false, reason: 'non_digits' })
  })

  it('rejects a payload beyond the sane bound', () => {
    const tooLong = '1'.repeat(MAX_SERIAL_LENGTH + 1)
    expect(checkSerial(tooLong)).toEqual({ ok: false, reason: 'too_long' })
  })
})

describe('isValidSerial', () => {
  it('is the boolean shorthand', () => {
    expect(isValidSerial('123')).toBe(true)
    expect(isValidSerial('12a')).toBe(false)
  })
})

describe('isAcceptedFormat', () => {
  it('accepts Code128 in its common spellings', () => {
    expect(isAcceptedFormat('CODE_128')).toBe(true)
    expect(isAcceptedFormat('Code128')).toBe(true)
    expect(isAcceptedFormat('code-128')).toBe(true)
  })

  it('accepts the other common 1-D symbologies', () => {
    expect(isAcceptedFormat('Code39')).toBe(true)
    expect(isAcceptedFormat('CODE_39')).toBe(true)
    expect(isAcceptedFormat('ITF')).toBe(true)
    expect(isAcceptedFormat('EAN_13')).toBe(true)
    expect(isAcceptedFormat('UPCA')).toBe(true)
    expect(isAcceptedFormat('Codabar')).toBe(true)
  })

  it('rejects the 2-D symbologies we must not store', () => {
    // Pointing the camera at an invoice QR must not become the serial.
    expect(isAcceptedFormat('QR_CODE')).toBe(false)
    expect(isAcceptedFormat('DATA_MATRIX')).toBe(false)
    expect(isAcceptedFormat('PDF_417')).toBe(false)
    expect(isAcceptedFormat('Aztec')).toBe(false)
  })
})
