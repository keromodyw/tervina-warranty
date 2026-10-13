/**
 * Focus score (D27). Variance of the Laplacian: a sharp frame has bright
 * high-frequency edges and therefore a large response variance; an out-of-focus
 * frame is smooth and its variance collapses toward zero.
 *
 * Pure and cheap - the caller downscales to ~240px first, so this runs inline
 * without a worker.
 */
import type { Gray } from './labelQuad'

/** Raw variance of the 4-neighbour Laplacian over the interior pixels. */
export function varianceOfLaplacian(gray: Gray): number {
  const { data, width, height } = gray
  if (width < 3 || height < 3) return 0

  let sum = 0
  let sumSq = 0
  let count = 0

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const lap =
        4 * data[i]! - data[i - 1]! - data[i + 1]! - data[i - width]! - data[i + width]!
      sum += lap
      sumSq += lap * lap
      count++
    }
  }

  if (count === 0) return 0
  const mean = sum / count
  return sumSq / count - mean * mean
}

/**
 * Squash the raw variance into 0..1. The half-saturation constant is chosen so a
 * blank/smooth frame reads near 0 and a crisp printed label reads well above the
 * auto-capture threshold.
 */
export const SHARPNESS_HALF_SATURATION = 500

export function normalizeSharpness(rawVariance: number): number {
  if (rawVariance <= 0) return 0
  return rawVariance / (rawVariance + SHARPNESS_HALF_SATURATION)
}

export function sharpnessScore(gray: Gray): number {
  return normalizeSharpness(varianceOfLaplacian(gray))
}
