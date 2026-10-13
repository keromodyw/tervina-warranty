import { useCallback, useMemo, useState } from 'react'
import {
  SHOT_LABELS,
  SERIAL_SHOT_KINDS,
  manifestFor,
  type PhotoKind,
} from '@/core/photos/photoManifest'
import { checkSerial } from '@/core/lib/serial'
import { CameraCapture } from './CameraCapture'
import { useObjectUrls } from './useObjectUrls'
import labelsTutorial from '@/assets/labels-tutorial.png'

export type PhotoMap = Partial<Record<PhotoKind, Blob>>

type Props = {
  itemType: string
  serial: string
  photos: PhotoMap
  onPhoto: (kind: PhotoKind, blob: Blob) => void
  onSerial: (serial: string) => void
  onContinue: () => void
  onBack: () => void
}

/**
 * Step 3 (M5/M6). Walks the conditional manifest and runs the camera for each
 * shot. Serial shots are captured by the camera engine, which only fires once a
 * Code128 actually decodes - so the serial always comes from the label itself,
 * there is no manual entry and no "captured something unreadable" path.
 */
export function PhotoStep({
  itemType,
  serial,
  photos,
  onPhoto,
  onSerial,
  onContinue,
  onBack,
}: Props) {
  const shots = useMemo(() => manifestFor(itemType), [itemType])
  const [active, setActive] = useState<PhotoKind | null>(null)
  const urls = useObjectUrls(photos)

  const needsSerial = shots.some((s) => SERIAL_SHOT_KINDS.includes(s.kind))
  const serialOk = checkSerial(serial).ok
  const requiredDone = shots.filter((s) => s.required).every((s) => photos[s.kind] !== undefined)
  const canContinue = requiredDone && (!needsSerial || serialOk)

  const handleCaptured = useCallback(
    (kind: PhotoKind, blob: Blob, decodedSerial: string | null) => {
      setActive(null)
      onPhoto(kind, blob)
      if (decodedSerial) onSerial(decodedSerial)
    },
    [onPhoto, onSerial],
  )

  return (
    <div className="grid gap-5">
      <figure className="overflow-hidden rounded-card border border-ink-100 bg-white">
        <img src={labelsTutorial} alt="طريقة تصوير الملصقات" className="w-full" />
        <figcaption className="px-4 py-2 text-center text-xs text-ink-500">
          صوّر الملصق كاملًا داخل الإطار مع وضوح النص والباركود.
        </figcaption>
      </figure>

      {shots.map((shot) => {
        const blob = photos[shot.kind]
        const url = urls[shot.kind]
        return (
          <div key={shot.kind} className="rounded-card border border-ink-100 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-ink-900">
                {SHOT_LABELS[shot.kind]}
                {!shot.required && <span className="ms-2 text-xs text-ink-400">اختياري</span>}
              </p>
              <button
                type="button"
                onClick={() => setActive(shot.kind)}
                className="rounded-card border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50"
              >
                {blob ? 'إعادة' : 'التقاط'}
              </button>
            </div>
            {url && (
              <img
                src={url}
                alt={SHOT_LABELS[shot.kind]}
                className="mt-3 max-h-56 w-full rounded-lg object-contain"
              />
            )}
          </div>
        )
      })}

      {needsSerial && (
        <p className={serialOk ? 'text-sm text-success-600' : 'text-sm text-ink-500'}>
          {serialOk
            ? `تم قراءة السيريال: ${serial}`
            : 'سيُقرأ السيريال تلقائيًا عند تصوير الملصق.'}
        </p>
      )}

      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-card border border-ink-200 px-5 py-3 font-semibold text-ink-600 hover:bg-ink-50"
        >
          رجوع
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className="flex-1 rounded-card bg-brand-600 px-6 py-3 font-bold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          التالي
        </button>
      </div>

      {active && (
        <CameraCapture
          kind={active}
          requireBarcode={SERIAL_SHOT_KINDS.includes(active)}
          onCapture={(blob, decodedSerial) => handleCaptured(active, blob, decodedSerial)}
          onCancel={() => setActive(null)}
        />
      )}
    </div>
  )
}
