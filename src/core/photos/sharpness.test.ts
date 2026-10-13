import { describe, expect, it } from 'vitest'
import { normalizeSharpness, sharpnessScore, varianceOfLaplacian } from './sharpness'
import type { Gray } from './labelQuad'

function flat(width: number, height: number, value: number): Gray {
  return { data: new Uint8ClampedArray(width * height).fill(value), width, height }
}

function checker(width: number, height: number, a: number, b: number): Gray {
  const data = new Uint8ClampedArray(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data[y * width + x] = (x + y) % 2 === 0 ? a : b
  }
  return { data, width, height }
}

describe('varianceOfLaplacian', () => {
  it('is zero for a flat frame', () => {
    expect(varianceOfLaplacian(flat(32, 32, 128))).toBe(0)
  })

  it('is large for a high-contrast checker pattern', () => {
    expect(varianceOfLaplacian(checker(32, 32, 0, 255))).toBeGreaterThan(1000)
  })
})

describe('normalizeSharpness', () => {
  it('maps 0 to 0 and is bounded above by 1', () => {
    expect(normalizeSharpness(0)).toBe(0)
    expect(normalizeSharpness(1e9)).toBeLessThan(1)
  })

  it('increases with raw variance', () => {
    expect(normalizeSharpness(1000)).toBeGreaterThan(normalizeSharpness(100))
  })
})

describe('sharpnessScore', () => {
  it('scores a crisp pattern above a smooth one', () => {
    expect(sharpnessScore(checker(48, 48, 0, 255))).toBeGreaterThan(
      sharpnessScore(flat(48, 48, 128)),
    )
  })
})
