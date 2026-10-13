import { describe, expect, it } from 'vitest'
import {
  expandQuad,
  findLabelQuad,
  minAreaRect,
  otsuThreshold,
  passesLabelGates,
  type Gray,
  type Quad,
} from './labelQuad'

function frame(
  width: number,
  height: number,
  fill: number,
  rect?: { x0: number; y0: number; x1: number; y1: number; value: number },
): Gray {
  const data = new Uint8ClampedArray(width * height).fill(fill)
  if (rect) {
    for (let y = rect.y0; y <= rect.y1; y++) {
      for (let x = rect.x0; x <= rect.x1; x++) data[y * width + x] = rect.value
    }
  }
  return { data, width, height }
}

function expectQuadClose(actual: Quad | null, expected: Quad, tol = 4) {
  expect(actual).not.toBeNull()
  for (let i = 0; i < 4; i++) {
    expect(Math.abs(actual![i]!.x - expected[i]!.x)).toBeLessThanOrEqual(tol)
    expect(Math.abs(actual![i]!.y - expected[i]!.y)).toBeLessThanOrEqual(tol)
  }
}

describe('otsuThreshold', () => {
  it('separates a bimodal dark/white frame', () => {
    const g = frame(64, 64, 20, { x0: 16, y0: 16, x1: 47, y1: 47, value: 240 })
    const t = otsuThreshold(g.data)
    expect(t).toBeGreaterThanOrEqual(20)
    expect(t).toBeLessThan(240)
  })
})

describe('findLabelQuad', () => {
  it('finds the four corners of a bright rectangular label', () => {
    const g = frame(160, 120, 20, { x0: 40, y0: 30, x1: 120, y1: 90, value: 240 })
    const quad = findLabelQuad(g)
    expectQuadClose(quad, [
      { x: 40, y: 30 },
      { x: 120, y: 30 },
      { x: 120, y: 90 },
      { x: 40, y: 90 },
    ])
  })

  it('scales corners back to full resolution', () => {
    const g = frame(80, 60, 20, { x0: 20, y0: 15, x1: 60, y1: 45, value: 240 })
    const quad = findLabelQuad(g, { scale: 3 })
    expectQuadClose(quad, [
      { x: 60, y: 45 },
      { x: 180, y: 45 },
      { x: 180, y: 135 },
      { x: 60, y: 135 },
    ])
  })

  it('rejects a blob too small to be the label', () => {
    const g = frame(160, 120, 20, { x0: 4, y0: 4, x1: 12, y1: 12, value: 240 })
    expect(findLabelQuad(g)).toBeNull()
  })

  it('rejects a featureless frame', () => {
    expect(findLabelQuad(frame(160, 120, 128))).toBeNull()
  })
})

describe('passesLabelGates', () => {
  const good: Quad = [
    { x: 40, y: 30 },
    { x: 120, y: 30 },
    { x: 120, y: 90 },
    { x: 40, y: 90 },
  ]

  it('accepts a plausible label', () => {
    expect(passesLabelGates(good, 160, 120)).toBe(true)
  })

  it('rejects a needle shape', () => {
    const needle: Quad = [
      { x: 40, y: 40 },
      { x: 120, y: 40 },
      { x: 120, y: 48 },
      { x: 40, y: 48 },
    ]
    expect(passesLabelGates(needle, 160, 120)).toBe(false)
  })
})

describe('minAreaRect', () => {
  it('wraps a convex hull with four corners', () => {
    const quad = minAreaRect([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 0, y: 5 },
    ])
    expect(quad).not.toBeNull()
    expect(polygonCorners(quad!)).toHaveLength(4)
  })
})

function polygonCorners(q: Quad): Quad {
  return q
}

describe('expandQuad', () => {
  const quad: Quad = [
    { x: 40, y: 30 },
    { x: 120, y: 30 },
    { x: 120, y: 90 },
    { x: 40, y: 90 },
  ]

  it('grows the quad outward by the clamped margin', () => {
    const { quad: expanded, tooClose } = expandQuad(quad, 160, 120)
    expectQuadClose(
      expanded,
      [
        { x: 12, y: 2 },
        { x: 148, y: 2 },
        { x: 148, y: 118 },
        { x: 12, y: 118 },
      ],
      1,
    )
    expect(tooClose).toBe(false)
  })

  it('flags too_close when the expanded quad spills past the frame', () => {
    const nearEdge: Quad = [
      { x: 10, y: 10 },
      { x: 150, y: 10 },
      { x: 150, y: 110 },
      { x: 10, y: 110 },
    ]
    expect(expandQuad(nearEdge, 160, 120).tooClose).toBe(true)
  })
})
