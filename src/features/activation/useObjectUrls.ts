import { useEffect, useState } from 'react'
import type { PhotoKind } from '@/core/photos/photoManifest'

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/**
 * Blob -> inline data URL for previews.
 *
 * Deliberately NOT object URLs. Blob object URLs must be revoked, and under
 * React StrictMode's setup/cleanup/setup the throwaway pass revokes any URL
 * created during the same render - leaving the live render pointing at dead
 * blob: URLs (the "photos don't load" bug). A data URL is self-contained and
 * never needs revoking, so a cancelled pass simply drops its result and the
 * real pass wins.
 */
export function useObjectUrls(
  photos: Partial<Record<PhotoKind, Blob>>,
): Partial<Record<PhotoKind, string>> {
  const [urls, setUrls] = useState<Partial<Record<PhotoKind, string>>>({})

  useEffect(() => {
    let cancelled = false
    const entries = Object.entries(photos) as Array<[PhotoKind, Blob]>
    Promise.all(
      entries.map(async ([kind, blob]) => [kind, await blobToDataUrl(blob)] as const),
    )
      .then((pairs) => {
        if (!cancelled) setUrls(Object.fromEntries(pairs))
      })
      .catch(() => {
        /* a dead blob just yields no preview */
      })
    return () => {
      cancelled = true
    }
  }, [photos])

  return urls
}
