import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import { SHOT_LABELS } from '@/core/photos/photoManifest'
import { cn } from '@/core/lib/cn'

export type LightboxPhoto = { kind: string; url: string }

const MIN_SCALE = 1
const MAX_SCALE = 6
const STEP = 1.4

function photoLabel(kind: string): string {
  return (SHOT_LABELS as Record<string, string>)[kind] ?? kind
}

/**
 * Full-screen photo viewer for the admin review screen. Staff open a claim's
 * photos here to read the label/serial at full size. Zoom with the buttons or
 * the mouse wheel, drag to pan, arrow keys to change photo, Esc to close.
 */
export function PhotoLightbox({
  photos,
  startIndex,
  onClose,
}: {
  photos: LightboxPhoto[]
  startIndex: number
  onClose: () => void
}) {
  const [index, setIndex] = useState(startIndex)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)

  const photo = photos[index]
  const hasMultiple = photos.length > 1

  const reset = useCallback(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  const show = useCallback(
    (next: number) => {
      setIndex((next + photos.length) % photos.length)
      reset()
    },
    [photos.length, reset],
  )

  const zoom = useCallback((factor: number) => {
    setScale((current) => {
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, current * factor))
      if (next === MIN_SCALE) setOffset({ x: 0, y: 0 })
      return next
    })
  }, [])

  useEffect(() => {
    closeRef.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') show(index + 1)
      if (event.key === 'ArrowLeft') show(index - 1)
      if (event.key === '+' || event.key === '=') zoom(STEP)
      if (event.key === '-' || event.key === '_') zoom(1 / STEP)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, onClose, show, zoom])

  function onWheel(event: ReactWheelEvent) {
    event.preventDefault()
    zoom(event.deltaY < 0 ? STEP : 1 / STEP)
  }

  function onPointerDown(event: ReactPointerEvent) {
    if (scale <= MIN_SCALE) return
    ;(event.target as Element).setPointerCapture(event.pointerId)
    dragRef.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y }
  }

  function onPointerMove(event: ReactPointerEvent) {
    const drag = dragRef.current
    if (!drag) return
    setOffset({ x: drag.ox + (event.clientX - drag.x), y: drag.oy + (event.clientY - drag.y) })
  }

  function onPointerUp() {
    dragRef.current = null
  }

  if (!photo) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photoLabel(photo.kind)}
      className="fixed inset-0 z-[60] flex flex-col bg-black/95 text-white"
      onClick={onClose}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20"
        >
          إغلاق ✕
        </button>
        <span className="text-sm text-white/80">
          {photoLabel(photo.kind)}
          {hasMultiple && ` — ${index + 1}/${photos.length}`}
        </span>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        onWheel={onWheel}
        onClick={(event) => event.stopPropagation()}
      >
        <img
          src={photo.url}
          alt={photoLabel(photo.kind)}
          draggable={false}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
          className={cn(
            'max-h-full max-w-full select-none object-contain',
            scale > MIN_SCALE ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in',
          )}
        />

        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                show(index - 1)
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-4 py-3 text-2xl hover:bg-white/20"
              aria-label="الصورة السابقة"
            >
              ›
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                show(index + 1)
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-4 py-3 text-2xl hover:bg-white/20"
              aria-label="الصورة التالية"
            >
              ‹
            </button>
          </>
        )}
      </div>

      <div
        className="flex items-center justify-center gap-2 px-4 py-4"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" onClick={() => zoom(1 / STEP)} className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20">
          تصغير −
        </button>
        <button type="button" onClick={reset} className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20">
          الحجم الأصلي
        </button>
        <button type="button" onClick={() => zoom(STEP)} className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20">
          تكبير +
        </button>
      </div>
    </div>
  )
}
