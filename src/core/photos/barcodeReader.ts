/**
 * Serial barcode reader. Wraps zxing-wasm, which is lazy-loaded via dynamic
 * import() so it never joins the wizard shell bundle (D2), and self-hosted - the
 * .wasm lives in public/wasm and is served from `import.meta.env.BASE_URL`,
 * never a CDN, so a blocked third-party request cannot break scanning.
 *
 * Two rules the rest of the app depends on:
 *   - only 1-D symbologies are read (matrices like QR are ignored); on top of
 *     that isAcceptedFormat() is a whitelist, not a silent accept
 *   - a decode with any non-digit is rejected here and the FSM keeps scanning
 *     (D26); a valid serial stays a string, so 0071234 remains 0071234.
 */
import { checkSerial, isAcceptedFormat } from '@/core/lib/serial'

export type QuadPoint = { x: number; y: number }
/** Corner order: topLeft, topRight, bottomRight, bottomLeft. */
export type Quad = [QuadPoint, QuadPoint, QuadPoint, QuadPoint]

export type BarcodeRead = {
  serial: string
  /** Barcode corners in image pixels, for the capture rect fallback. */
  quad: Quad | null
}

type Reader = typeof import('zxing-wasm/reader')

const WASM_DIR = `${import.meta.env.BASE_URL}wasm/`

/**
 * Every linear (1-D) symbology, via zxing's `AllLinear` meta-format, so Code128
 * labels are read alongside Code39/ITF/Codabar/EAN-UPC. Matrix codes stay out so
 * an invoice QR can never be mistaken for a serial; the digits-only rule in
 * checkSerial() is the second line of defence.
 */
const FORMATS = ['AllLinear'] as const

let readerPromise: Promise<Reader> | null = null

async function loadReader(): Promise<Reader> {
  if (readerPromise === null) {
    readerPromise = (async () => {
      const zx = await import('zxing-wasm/reader')
      await zx.prepareZXingModule({
        overrides: { locateFile: (path: string) => `${WASM_DIR}${path}` },
        fireImmediately: true,
      })
      return zx
    })().catch((err: unknown) => {
      // Allow a later retry instead of caching a rejected promise forever.
      readerPromise = null
      throw err
    })
  }
  return readerPromise
}

/**
 * `tryHarder: false` is the fast path for the live scan loop (many frames per
 * second); the manual button passes true for a slower, more forgiving read.
 */
export async function readSerialFromImage(
  input: Blob | ImageData,
  options?: { tryHarder?: boolean },
): Promise<BarcodeRead | null> {
  const zx = await loadReader()

  const results = await zx.readBarcodes(input, {
    formats: [...FORMATS],
    tryHarder: options?.tryHarder ?? true,
    returnErrors: false,
  })

  for (const result of results) {
    if (!result.isValid) continue
    if (!isAcceptedFormat(result.format)) continue
    const check = checkSerial(result.text)
    if (!check.ok) continue
    return { serial: check.serial, quad: quadFromPosition(result.position) }
  }

  return null
}

function quadFromPosition(position: {
  topLeft?: QuadPoint
  topRight?: QuadPoint
  bottomRight?: QuadPoint
  bottomLeft?: QuadPoint
}): Quad | null {
  const { topLeft, topRight, bottomRight, bottomLeft } = position
  if (!topLeft || !topRight || !bottomRight || !bottomLeft) return null
  return [topLeft, topRight, bottomRight, bottomLeft]
}
