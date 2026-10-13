import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { expandQuad, findLabelQuad, type Quad } from '@/core/photos/labelQuad'
import { sharpnessScore } from '@/core/photos/sharpness'
import {
  boundingBox,
  clampRect,
  createFrameGrabber,
  createImageGrabber,
  cropGray,
  cropToJpeg,
  fullFrameRect,
  scaleQuad,
  type CaptureSource,
} from '@/core/photos/imagePipeline'
import { readSerialFromImage, type BarcodeRead } from '@/core/photos/barcodeReader'
import { SHOT_LABELS, type PhotoKind } from '@/core/photos/photoManifest'

/**
 * Engine tuning.
 *
 * Label shots are fired only when the label is found, is comfortably inside the
 * frame, is SHARP and has barely moved for several consecutive frames - so a
 * shaky or blurred frame can never win. Sharpness is measured on the label crop
 * (not the whole frame) so a cluttered background cannot mask blur.
 *
 * Barcode shots never "capture then fail": the camera keeps scanning the live
 * feed and only fires the shutter the instant a real Code128 decodes. A failed
 * frame changes nothing.
 */
const TICK_MS = 150
const LABEL_SHARPNESS = 0.5
const LABEL_STABLE_FRAMES = 4
/** Movement (as a fraction of the frame diagonal) above which the frame counts as moving. */
const STABLE_MOVE = 0.015
const STABLE_SIZE_CHANGE = 0.22
const BARCODE_DECODE_MS = 150
const WARMUP_MS = 700
/** Detection frame long edge (px). Higher than the old 240 so small labels resolve. */
const DETECT_MAX_DIM = 320
/** Barcode decode frame long edge (px). */
const DECODE_MAX_DIM = 720

type Props = {
  kind: PhotoKind
  requireBarcode: boolean
  onCapture: (blob: Blob, serial: string | null) => void
  onCancel: () => void
}

type Status = 'starting' | 'live' | 'error'

type Rect = { x: number; y: number; width: number; height: number }

function quadStats(quad: Quad): { cx: number; cy: number; w: number; h: number } {
  const xs = quad.map((p) => p.x)
  const ys = quad.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY }
}

/** Score a camera so the main rear sensor wins over ultra-wide / front lenses. */
function cameraScore(label: string): number {
  const l = label.toLowerCase()
  let score = 0
  if (/back|rear|environment|خلف|خلفى|خلفي/.test(l)) score += 10
  if (/front|user|facetime|أمام|امام/.test(l)) score -= 10
  if (/ultra|\bwide\b|wide angle|0[.,]5|عريض/.test(l)) score -= 5
  if (/tele|macro|\b2x\b|\b3x\b|zoom/.test(l)) score -= 2
  return score
}

async function pickRearDeviceId(currentId?: string): Promise<string | undefined> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const cams = devices.filter((d) => d.kind === 'videoinput' && d.deviceId)
    if (cams.length <= 1) return undefined
    const best = [...cams].sort((a, b) => cameraScore(b.label) - cameraScore(a.label))[0]
    if (!best) return undefined
    return best.deviceId && best.deviceId !== currentId ? best.deviceId : undefined
  } catch {
    return undefined
  }
}

/**
 * Ask the sensor for continuous autofocus/exposure/white-balance. Without this a
 * phone can lock focus at whatever it first saw, so the label never gets crisp no
 * matter how long the user holds still. Capabilities differ per device, so each
 * mode is only requested when the track reports it supports "continuous"; all
 * failures are swallowed - the camera still works on the default modes.
 */
async function applyCameraTuning(stream: MediaStream): Promise<void> {
  const track = stream.getVideoTracks()[0]
  if (!track?.applyConstraints) return

  let caps: Record<string, unknown> = {}
  try {
    caps = (track.getCapabilities?.() ?? {}) as Record<string, unknown>
  } catch {
    /* capabilities unavailable */
  }

  const advanced: MediaTrackConstraintSet[] = []
  const enable = (key: 'focusMode' | 'exposureMode' | 'whiteBalanceMode') => {
    const supported = caps[key]
    if (Array.isArray(supported) && supported.includes('continuous')) {
      advanced.push({ [key]: 'continuous' } as MediaTrackConstraintSet)
    }
  }
  enable('focusMode')
  enable('exposureMode')
  enable('whiteBalanceMode')

  if (advanced.length === 0) return
  try {
    await track.applyConstraints({ advanced })
  } catch {
    /* focus/exposure tuning is best-effort */
  }
}

/**
 * The rect captured for a barcode shot. The intent is the WHOLE label, not the
 * strip of bars: prefer the detected label quad, then fall back to the barcode
 * corners grown generously (~75% of their size) so the surrounding label and the
 * serial text are framed too.
 */
function barcodeCaptureRect(
  read: BarcodeRead,
  grabScale: number,
  labelQuad: Quad | null,
  frameW: number,
  frameH: number,
): Rect {
  if (labelQuad) {
    const box = boundingBox(expandQuad(labelQuad, frameW, frameH).quad)
    return { x: box.x, y: box.y, width: box.width, height: box.height }
  }
  if (read.quad) {
    const box = boundingBox(scaleQuad(read.quad, 1 / grabScale))
    const pad = Math.max(box.width, box.height) * 0.75
    return {
      x: box.x - pad,
      y: box.y - pad,
      width: box.width + pad * 2,
      height: box.height + pad * 2,
    }
  }
  return fullFrameRect(frameW, frameH)
}

export function CameraCapture({ kind, requireBarcode, onCapture, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const grabberRef = useRef<ReturnType<typeof createFrameGrabber> | null>(null)
  const imageGrabberRef = useRef<ReturnType<typeof createImageGrabber> | null>(null)
  const quadRef = useRef<Quad | null>(null)
  const prevStatsRef = useRef<{ cx: number; cy: number; w: number; h: number } | null>(null)
  const stableRef = useRef(0)
  const firedRef = useRef(false)
  const liveAtRef = useRef(0)
  const decodingRef = useRef(false)
  const lastDecodeRef = useRef(0)
  const aliveRef = useRef(true)

  const [status, setStatus] = useState<Status>('starting')
  const [hint, setHint] = useState('وجّه الكاميرا نحو الملصق')
  const [scanning, setScanning] = useState(false)

  /** Crop + encode + hand off. Latin-ser is null for plain label shots. */
  const snap = useCallback(
    async (source: CaptureSource, frameW: number, frameH: number, rect: Rect, serial: string | null) => {
      if (firedRef.current) return
      firedRef.current = true
      const blob = await cropToJpeg(source, clampRect(rect, frameW, frameH), frameW, frameH)
      if (blob) {
        onCapture(blob, serial)
      } else {
        firedRef.current = false
        if (aliveRef.current) setHint('تعذر حفظ الصورة، حاول مرة أخرى')
      }
    },
    [onCapture],
  )

  const labelRect = useCallback((quadFull: Quad, frameW: number, frameH: number): Rect => {
    const box = boundingBox(expandQuad(quadFull, frameW, frameH).quad)
    return { x: box.x, y: box.y, width: box.width, height: box.height }
  }, [])

  /**
   * Decode the current frame. On success the shutter fires and the camera is
   * done; on failure it simply keeps scanning (never closes). `auto` is the
   * fast background pass; `manual` ignores the throttle and reads harder.
   */
  const attemptBarcode = useCallback(
    async (mode: 'auto' | 'manual') => {
      if (firedRef.current || decodingRef.current) return
      const video = videoRef.current
      const imageGrabber = imageGrabberRef.current
      if (!video || !imageGrabber) return
      const now = performance.now()
      if (mode === 'auto' && now - lastDecodeRef.current < BARCODE_DECODE_MS) return
      lastDecodeRef.current = now

      const grab = imageGrabber.grab()
      if (!grab) return
      decodingRef.current = true
      if (aliveRef.current) setScanning(true)
      try {
        const read = await readSerialFromImage(grab.image, { tryHarder: mode === 'manual' })
        if (!read) {
          if (mode === 'manual' && aliveRef.current && !firedRef.current) {
            setHint('لم يتم العثور على باركود واضح — قرّب الكاميرا وثبّتها')
          } else if (aliveRef.current && !firedRef.current) {
            setHint('امسك الملصق ثابتًا داخل الإطار...')
          }
          return
        }
        const frameW = video.videoWidth
        const frameH = video.videoHeight
        const rect = barcodeCaptureRect(read, grab.scale, quadRef.current, frameW, frameH)
        await snap(video, frameW, frameH, rect, read.serial)
      } catch {
        if (aliveRef.current && !firedRef.current) setHint('تعذر قراءة الباركود، حاول مرة أخرى')
      } finally {
        decodingRef.current = false
        if (aliveRef.current) setScanning(false)
      }
    },
    [snap],
  )

  // Open the best rear camera, upgrading away from an ultra-wide once labels exist.
  useEffect(() => {
    aliveRef.current = true

    const openStream = (deviceId?: string) =>
      navigator.mediaDevices.getUserMedia({
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
        audio: false,
      })

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error')
        setHint('الكاميرا غير متاحة على هذا الجهاز أو الاتصال. استخدم رفع صورة.')
        return
      }
      try {
        const initial = await openStream()
        if (!aliveRef.current) {
          initial.getTracks().forEach((t) => t.stop())
          return
        }
        const currentId = initial.getVideoTracks()[0]?.getSettings().deviceId
        const betterId = await pickRearDeviceId(currentId)
        let stream = initial
        if (betterId) {
          try {
            const better = await openStream(betterId)
            if (aliveRef.current) {
              initial.getTracks().forEach((t) => t.stop())
              stream = better
            } else {
              better.getTracks().forEach((t) => t.stop())
            }
          } catch {
            /* keep the initial stream */
          }
        }
        if (!aliveRef.current) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        await applyCameraTuning(stream)
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        grabberRef.current = createFrameGrabber(video, DETECT_MAX_DIM)
        imageGrabberRef.current = createImageGrabber(video, DECODE_MAX_DIM)
        liveAtRef.current = Date.now()
        setStatus('live')
        setHint(requireBarcode ? 'امسك الباركود ثابتًا داخل الإطار...' : 'وجّه الكاميرا نحو الملصق')
      } catch {
        if (aliveRef.current) {
          setStatus('error')
          setHint('تعذر فتح الكاميرا. تأكد من السماح بها، أو ارفع صورة.')
        }
      }
    }

    void start()
    return () => {
      aliveRef.current = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [requireBarcode])

  // Main detection loop.
  useEffect(() => {
    if (status !== 'live') return
    const timer = window.setInterval(() => {
      const video = videoRef.current
      const grabber = grabberRef.current
      if (!video || !grabber || video.readyState < 2 || firedRef.current) return

      // Barcode kinds run their own async decode path, but still track the
      // label quad so the shot frames the whole label, not just the bars.
      if (requireBarcode) {
        void attemptBarcode('auto')
        const frame = grabber.grab()
        if (frame) {
          const quadDown = findLabelQuad(frame.gray)
          quadRef.current = quadDown ? scaleQuad(quadDown, 1 / frame.scale) : null
          drawOverlay(overlayRef.current, frame.gray, quadDown)
        }
        return
      }

      const frame = grabber.grab()
      if (!frame) return
      const { gray, scale, frameWidth, frameHeight } = frame
      const quadDown = findLabelQuad(gray)
      drawOverlay(overlayRef.current, gray, quadDown)

      if (Date.now() - liveAtRef.current < WARMUP_MS) {
        setHint('جارٍ التهيئة...')
        return
      }

      if (!quadDown) {
        stableRef.current = 0
        prevStatsRef.current = null
        setHint('لم يتم العثور على الملصق — قرّب الكاميرا أكثر')
        return
      }

      const quadFull = scaleQuad(quadDown, 1 / scale)
      quadRef.current = quadFull

      if (expandQuad(quadFull, frameWidth, frameHeight).tooClose) {
        stableRef.current = 0
        setHint('ابعد الكاميرا قليلًا عن الملصق')
        return
      }

      const sharp = sharpnessScore(cropGray(gray, boundingBox(quadDown))) >= LABEL_SHARPNESS
      if (!sharp) {
        stableRef.current = 0
        setHint('الصورة غير واضحة — ثبّت الكاميرا')
        return
      }

      const stats = quadStats(quadFull)
      const prev = prevStatsRef.current
      const diag = Math.hypot(frameWidth, frameHeight)
      let stable = false
      if (prev) {
        const move = Math.hypot(stats.cx - prev.cx, stats.cy - prev.cy) / diag
        const sizeChange = Math.abs(stats.w * stats.h - prev.w * prev.h) / (prev.w * prev.h || 1)
        stable = move < STABLE_MOVE && sizeChange < STABLE_SIZE_CHANGE
      }
      prevStatsRef.current = stats

      if (!stable) {
        stableRef.current = 0
        setHint('ثبّت الكاميرا قليلًا')
        return
      }

      stableRef.current += 1
      setHint(`جاهز — لا تحرك (${stableRef.current}/${LABEL_STABLE_FRAMES})`)
      if (stableRef.current >= LABEL_STABLE_FRAMES) {
        void snap(video, frameWidth, frameHeight, labelRect(quadFull, frameWidth, frameHeight), null)
      }
    }, TICK_MS)

    return () => window.clearInterval(timer)
  }, [status, requireBarcode, attemptBarcode, labelRect, snap])

  function handleManual() {
    const video = videoRef.current
    if (!video) return
    if (requireBarcode) {
      void attemptBarcode('manual')
      return
    }
    const quad = quadRef.current
    const rect = quad ? labelRect(quad, video.videoWidth, video.videoHeight) : fullFrameRect(video.videoWidth, video.videoHeight)
    void snap(video, video.videoWidth, video.videoHeight, rect, null)
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    try {
      if (requireBarcode) {
        const read = await readSerialFromImage(file, { tryHarder: true })
        if (!read) {
          setHint('تعذر قراءة الباركود من الصورة، جرّب صورة أوضح.')
          return
        }
        const image = await loadImage(url)
        const labelQuad = detectOnImage(image)
        const rect = barcodeCaptureRect(read, 1, labelQuad, image.naturalWidth, image.naturalHeight)
        await snap(image, image.naturalWidth, image.naturalHeight, rect, read.serial)
        return
      }
      const image = await loadImage(url)
      const quad = detectOnImage(image)
      const rect = quad
        ? boundingBox(expandQuad(quad, image.naturalWidth, image.naturalHeight).quad)
        : fullFrameRect(image.naturalWidth, image.naturalHeight)
      await snap(image, image.naturalWidth, image.naturalHeight, rect, null)
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-contain"
          aria-label={SHOT_LABELS[kind]}
        />
        <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />

        {scanning && status === 'live' && (
          <div className="absolute left-1/2 top-6 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-sm">
            جارٍ قراءة الباركود...
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center">
            <p className="text-sm text-white/90">{hint}</p>
            <label className="cursor-pointer rounded-card bg-brand-600 px-5 py-2 font-semibold text-white">
              رفع صورة
              <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </label>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <button type="button" onClick={onCancel} className="rounded-card px-4 py-2 text-sm text-white/80">
          إلغاء
        </button>
        <p aria-live="polite" className="flex-1 text-center text-sm text-white/90">
          {hint}
        </p>
        <button
          type="button"
          onClick={handleManual}
          disabled={status !== 'live'}
          className="rounded-full bg-white px-6 py-3 font-bold text-black disabled:opacity-40"
        >
          {requireBarcode ? 'قراءة' : 'التقاط'}
        </button>
      </div>
    </div>
  )
}

function drawOverlay(canvas: HTMLCanvasElement | null, gray: { width: number; height: number }, quad: Quad | null) {
  if (!canvas) return
  canvas.width = gray.width
  canvas.height = gray.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (!quad) return
  ctx.strokeStyle = '#16a34a'
  ctx.lineWidth = 2
  ctx.beginPath()
  quad.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  ctx.closePath()
  ctx.stroke()
}

function detectOnImage(image: HTMLImageElement): Quad | null {
  const maxDim = 320
  const scale = Math.min(1, maxDim / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const quad = findLabelQuad({ data: data.data, width: canvas.width, height: canvas.height })
  return quad ? scaleQuad(quad, 1 / scale) : null
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image load failed'))
    image.src = url
  })
}
