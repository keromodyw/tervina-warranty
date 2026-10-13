/**
 * Canvas glue for the capture step. Kept separate from the pure vision modules
 * (labelQuad/sharpness) so those stay testable without a DOM.
 */
import type { Gray, Quad } from './labelQuad'

export type GrabbedFrame = {
  gray: Gray
  /** downscaled-width / frame-width */
  scale: number
  frameWidth: number
  frameHeight: number
}

/**
 * A reusable frame grabber: one canvas, one ctx, no per-frame allocation. The
 * video is drawn small (maxDim long edge) so detection runs on ~240px, which is
 * cheap enough to do inline without a worker.
 */
export function createFrameGrabber(video: HTMLVideoElement, maxDim = 240) {
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null

  return {
    grab(): GrabbedFrame | null {
      const frameWidth = video.videoWidth
      const frameHeight = video.videoHeight
      if (frameWidth === 0 || frameHeight === 0) return null

      const scale = Math.min(1, maxDim / Math.max(frameWidth, frameHeight))
      const width = Math.max(1, Math.round(frameWidth * scale))
      const height = Math.max(1, Math.round(frameHeight * scale))

      if (!canvas) {
        canvas = document.createElement('canvas')
        ctx = canvas.getContext('2d', { willReadFrequently: true })
      }
      if (!canvas || !ctx) return null
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }

      ctx.drawImage(video, 0, 0, width, height)
      const image = ctx.getImageData(0, 0, width, height)
      return { gray: grayscale(image), scale, frameWidth, frameHeight }
    },
  }
}

export function grayscale(image: ImageData): Gray {
  const { data, width, height } = image
  const out = new Uint8ClampedArray(width * height)
  for (let i = 0, j = 0; j < out.length; i += 4, j++) {
    out[j] = (data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114) | 0
  }
  return { data: out, width, height }
}

/**
 * Grab a high-resolution ImageData straight from the video for barcode decoding.
 * Kept separate from the small detection frame: barcodes need pixels, the quad
 * detector does not. Returns the downscale factor so a decoded barcode's corners
 * (in grab pixels) can be mapped back to full-res frame coordinates for cropping.
 */
export function createImageGrabber(video: HTMLVideoElement, maxDim = 720) {
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null

  return {
    grab(): { image: ImageData; scale: number } | null {
      const frameWidth = video.videoWidth
      const frameHeight = video.videoHeight
      if (frameWidth === 0 || frameHeight === 0) return null

      const scale = Math.min(1, maxDim / Math.max(frameWidth, frameHeight))
      const width = Math.max(1, Math.round(frameWidth * scale))
      const height = Math.max(1, Math.round(frameHeight * scale))

      if (!canvas) {
        canvas = document.createElement('canvas')
        ctx = canvas.getContext('2d', { willReadFrequently: true })
      }
      if (!canvas || !ctx) return null
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }

      ctx.drawImage(video, 0, 0, width, height)
      return { image: ctx.getImageData(0, 0, width, height), scale }
    },
  }
}

/** Copy a sub-rectangle out of a grayscale buffer. */
export function cropGray(
  gray: Gray,
  rect: { x: number; y: number; width: number; height: number },
): Gray {
  const clamped = clampRect(rect, gray.width, gray.height)
  const x = Math.round(clamped.x)
  const y = Math.round(clamped.y)
  const w = Math.max(1, Math.round(clamped.width))
  const h = Math.max(1, Math.round(clamped.height))
  const out = new Uint8ClampedArray(w * h)
  for (let row = 0; row < h; row++) {
    const src = (y + row) * gray.width + x
    out.set(gray.data.subarray(src, src + w), row * w)
  }
  return { data: out, width: w, height: h }
}

export function scaleQuad(quad: Quad, factor: number): Quad {
  return quad.map((p) => ({ x: p.x * factor, y: p.y * factor })) as Quad
}

export function boundingBox(quad: Quad): { x: number; y: number; width: number; height: number } {
  const xs = quad.map((p) => p.x)
  const ys = quad.map((p) => p.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY }
}

export function clampRect(
  rect: { x: number; y: number; width: number; height: number },
  frameWidth: number,
  frameHeight: number,
): { x: number; y: number; width: number; height: number } {
  const x = Math.max(0, Math.min(rect.x, frameWidth - 1))
  const y = Math.max(0, Math.min(rect.y, frameHeight - 1))
  const width = Math.max(1, Math.min(rect.width, frameWidth - x))
  const height = Math.max(1, Math.min(rect.height, frameHeight - y))
  return { x, y, width, height }
}

export type CaptureSource = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement

/**
 * Crop a rectangle out of the full-resolution frame and encode it as JPEG. The
 * label is roughly upright, so the axis-aligned bounding box of the expanded
 * quad is enough; a perspective warp is not worth the extra code here.
 */
export async function cropToJpeg(
  source: CaptureSource,
  rect: { x: number; y: number; width: number; height: number },
  frameWidth: number,
  frameHeight: number,
  quality = 0.92,
): Promise<Blob | null> {
  const sourceWidth = frameWidth || (source as HTMLVideoElement).videoWidth
  const sourceHeight = frameHeight || (source as HTMLVideoElement).videoHeight
  const clamped = clampRect(rect, sourceWidth, sourceHeight)

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(clamped.width)
  canvas.height = Math.round(clamped.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.drawImage(
    source,
    clamped.x,
    clamped.y,
    clamped.width,
    clamped.height,
    0,
    0,
    canvas.width,
    canvas.height,
  )

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality))
}

export function fullFrameRect(frameWidth: number, frameHeight: number) {
  return { x: 0, y: 0, width: frameWidth, height: frameHeight }
}
