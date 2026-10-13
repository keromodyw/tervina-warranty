/**
 * Label quad detection (D27) - dependency-free, no OpenCV.js.
 *
 * The label is a bright (white), roughly rectangular card held in the hand, so
 * the frame is found from its own bright corners, not from the barcode and not
 * from a plain sharpness score:
 *
 *   grayscale -> Otsu threshold (bright = label)
 *             -> largest 4-connected bright component
 *             -> convex hull -> minimum-area rectangle (4 corners)
 *             -> validity gates
 *
 * The caller downscales to ~240px long edge before calling this, scales the
 * returned corners back to full resolution and calls expandQuad, so the whole
 * thing is unit-testable on a synthetic frame with exact expected corners.
 */

export type Pt = { x: number; y: number }
export type Quad = [Pt, Pt, Pt, Pt]
export type Gray = { data: Uint8ClampedArray | Uint8Array; width: number; height: number }

/**
 * Otsu's method: the threshold that maximises between-class variance. The
 * convention is "bright = value > t", so t is the last index of the lower class.
 *
 * Returns -1 when there is no valid split (a flat or unimodal frame with zero
 * contrast). Callers MUST treat -1 as "no label", otherwise every pixel reads as
 * bright and the whole frame becomes a bogus quad.
 */
export function otsuThreshold(data: Uint8ClampedArray | Uint8Array): number {
  const hist = new Array<number>(256).fill(0)
  for (let i = 0; i < data.length; i++) hist[data[i]!]!++

  const total = data.length
  let sum = 0
  for (let t = 0; t < 256; t++) sum += t * hist[t]!

  let sumB = 0
  let wB = 0
  let best = -1
  let bestVar = -1

  for (let t = 0; t < 256; t++) {
    wB += hist[t]!
    if (wB === 0) continue
    const wF = total - wB
    if (wF === 0) break

    sumB += t * hist[t]!
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) * (mB - mF)
    if (between > bestVar) {
      bestVar = between
      best = t
    }
  }
  return best
}

/** Largest 4-connected bright component; returns its pixel coordinates. */
function largestBrightComponent(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  threshold: number,
): Pt[] {
  const bright = new Uint8Array(width * height)
  for (let i = 0; i < bright.length; i++) bright[i] = data[i]! > threshold ? 1 : 0

  const seen = new Uint8Array(width * height)
  const stack: number[] = []
  let best: number[] = []

  for (let start = 0; start < bright.length; start++) {
    if (bright[start] === 0 || seen[start] === 1) continue
    const component: number[] = []
    stack.length = 0
    stack.push(start)
    seen[start] = 1

    while (stack.length > 0) {
      const p = stack.pop()!
      component.push(p)
      const x = p % width
      const y = (p / width) | 0

      if (x > 0) tryPush(p - 1)
      if (x < width - 1) tryPush(p + 1)
      if (y > 0) tryPush(p - width)
      if (y < height - 1) tryPush(p + width)
    }

    if (component.length > best.length) best = component

    function tryPush(n: number) {
      if (bright[n] === 1 && seen[n] === 0) {
        seen[n] = 1
        stack.push(n)
      }
    }
  }

  return best.map((p) => ({ x: p % width, y: (p / width) | 0 }))
}

/** Monotone-chain convex hull (counter-clockwise in a y-down image). */
export function convexHull(points: Pt[]): Pt[] {
  if (points.length < 3) return points
  const pts = points.slice().sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x))

  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

  const lower: Pt[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: Pt[] = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]!
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop()
    upper.push(p)
  }
  lower.pop()
  upper.pop()
  return lower.concat(upper)
}

/** Minimum-area enclosing rectangle of a convex hull (rotating calipers). */
export function minAreaRect(hull: Pt[]): Quad | null {
  const n = hull.length
  if (n < 3) return null

  let bestArea = Infinity
  let best: Quad | null = null

  for (let i = 0; i < n; i++) {
    const a = hull[i]!
    const b = hull[(i + 1) % n]!
    const ex = b.x - a.x
    const ey = b.y - a.y
    const len = Math.hypot(ex, ey)
    if (len === 0) continue
    const ux = ex / len
    const uy = ey / len

    let minU = Infinity
    let maxU = -Infinity
    let minV = Infinity
    let maxV = -Infinity
    for (const p of hull) {
      const u = p.x * ux + p.y * uy
      const v = -p.x * uy + p.y * ux
      if (u < minU) minU = u
      if (u > maxU) maxU = u
      if (v < minV) minV = v
      if (v > maxV) maxV = v
    }

    const area = (maxU - minU) * (maxV - minV)
    if (area < bestArea) {
      bestArea = area
      const toXY = (u: number, v: number): Pt => ({ x: u * ux - v * uy, y: u * uy + v * ux })
      best = [toXY(minU, minV), toXY(maxU, minV), toXY(maxU, maxV), toXY(minU, maxV)]
    }
  }

  return best ? orderQuad(best) : null
}

/** Order corners as topLeft, topRight, bottomRight, bottomLeft. */
export function orderQuad(quad: Quad): Quad {
  const cx = (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4
  const cy = (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4
  const sorted = quad
    .slice()
    .sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx))

  // Rotate so the first point is the top-left (smallest x + y).
  let startIdx = 0
  let bestScore = Infinity
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i]!.x + sorted[i]!.y
    if (s < bestScore) {
      bestScore = s
      startIdx = i
    }
  }
  const out = sorted.slice(startIdx).concat(sorted.slice(0, startIdx)) as Quad
  return out
}

function sideLengths(quad: Quad): [number, number, number, number] {
  return [
    Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y),
    Math.hypot(quad[2].x - quad[1].x, quad[2].y - quad[1].y),
    Math.hypot(quad[3].x - quad[2].x, quad[3].y - quad[2].y),
    Math.hypot(quad[0].x - quad[3].x, quad[0].y - quad[3].y),
  ]
}

function polygonArea(quad: Quad): number {
  let area = 0
  for (let i = 0; i < 4; i++) {
    const a = quad[i]!
    const b = quad[(i + 1) % 4]!
    area += a.x * b.y - b.x * a.y
  }
  return Math.abs(area) / 2
}

/** Interior angle at each vertex, in degrees. */
function interiorAngles(quad: Quad): number[] {
  const angles: number[] = []
  for (let i = 0; i < 4; i++) {
    const prev = quad[(i + 3) % 4]!
    const cur = quad[i]!
    const next = quad[(i + 1) % 4]!
    const v1 = { x: prev.x - cur.x, y: prev.y - cur.y }
    const v2 = { x: next.x - cur.x, y: next.y - cur.y }
    const dot = v1.x * v2.x + v1.y * v2.y
    const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y)
    const cos = mag === 0 ? 1 : Math.max(-1, Math.min(1, dot / mag))
    angles.push((Math.acos(cos) * 180) / Math.PI)
  }
  return angles
}

export type LabelGates = {
  areaFraction: number
  minSideFraction: number
  angles: number[]
  aspect: number
}

/**
 * Validity gates (D27). All must pass. Returns null when the brightest blob is
 * not plausible as the held label, so the caller keeps scanning instead of
 * capturing something unusable.
 */
export function passesLabelGates(quad: Quad, width: number, height: number): boolean {
  const frameArea = width * height
  if (frameArea === 0) return false

  if (polygonArea(quad) / frameArea < 0.12) return false

  const sides = sideLengths(quad)
  const minSide = Math.min(...sides)
  const maxSide = Math.max(...sides)
  if (minSide < 0.08 * Math.min(width, height)) return false
  // "Squareness sane" - reject needle shapes.
  if (minSide / maxSide < 0.1) return false

  for (const angle of interiorAngles(quad)) {
    if (angle < 60 || angle > 120) return false
  }

  return true
}

function centroid(quad: Quad): Pt {
  return {
    x: (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4,
    y: (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4,
  }
}

function lineIntersect(p1: Pt, d1: Pt, p2: Pt, d2: Pt): Pt | null {
  const denom = d1.x * d2.y - d1.y * d2.x
  if (Math.abs(denom) < 1e-9) return null
  const t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / denom
  return { x: p1.x + t * d1.x, y: p1.y + t * d1.y }
}

export type ExpandedQuad = { quad: Quad; tooClose: boolean }

/**
 * Grow the quad outward so it brackets the whole label, not just its printed
 * face (D27). margin = clamp(0.12 * labelWidth, 28, 90) px at full resolution.
 * Each edge is offset along its outward normal and consecutive edges
 * re-intersected, which keeps a rotated label tight.
 *
 * tooClose is set when the expanded quad spills past the frame by more than ~8%
 * of a frame dimension; the UI then asks the user to back off a little instead
 * of capturing a clipped label.
 */
export function expandQuad(quad: Quad, width: number, height: number): ExpandedQuad {
  const sides = sideLengths(quad)
  const labelWidth = (sides[0] + sides[2]) / 2
  const margin = Math.max(28, Math.min(90, 0.12 * labelWidth))

  const c = centroid(quad)
  const offsetEdges: Array<{ p: Pt; d: Pt }> = []
  for (let i = 0; i < 4; i++) {
    const a = quad[i]!
    const b = quad[(i + 1) % 4]!
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const d = { x: (b.x - a.x) / len, y: (b.y - a.y) / len }
    // Candidate normals; pick the one pointing away from the centroid.
    let n = { x: -d.y, y: d.x }
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    if ((mid.x - c.x) * n.x + (mid.y - c.y) * n.y < 0) n = { x: -n.x, y: -n.y }
    offsetEdges.push({ p: { x: a.x + n.x * margin, y: a.y + n.y * margin }, d })
  }

  const corners: Pt[] = []
  for (let i = 0; i < 4; i++) {
    const prev = offsetEdges[(i + 3) % 4]!
    const cur = offsetEdges[i]!
    const hit = lineIntersect(prev.p, prev.d, cur.p, cur.d)
    corners.push(hit ?? quad[i]!)
  }

  const expanded = orderQuad(corners as Quad)

  let overflow = 0
  for (const p of expanded) {
    overflow = Math.max(
      overflow,
      -p.x / width,
      (p.x - width) / width,
      -p.y / height,
      (p.y - height) / height,
    )
  }

  return { quad: expanded, tooClose: overflow > 0.08 }
}

export function findLabelQuad(gray: Gray, options?: { scale?: number }): Quad | null {
  const { data, width, height } = gray
  if (width < 4 || height < 4) return null

  const threshold = otsuThreshold(data)
  if (threshold < 0) return null
  const component = largestBrightComponent(data, width, height, threshold)
  if (component.length < 4) return null

  const hull = convexHull(component)
  const rect = minAreaRect(hull)
  if (!rect) return null

  if (!passesLabelGates(rect, width, height)) return null

  const scale = options?.scale ?? 1
  if (scale === 1) return rect
  return rect.map((p) => ({ x: p.x * scale, y: p.y * scale })) as Quad
}
