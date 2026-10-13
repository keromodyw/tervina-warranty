import { downloadZip } from 'client-zip'
import { markExported, photosForClaims, signedUrls, type AdminClaim } from './adminApi'

/**
 * Bulk photo archive (D20). One folder per serial, holding that claim's photos.
 * Runs entirely in the admin browser: staff RLS lists the rows, Storage returns
 * short-lived signed URLs, client-zip streams them into a single .zip. Claims
 * are marked photos_exported=true only AFTER the zip is assembled.
 */

export type ArchiveResult = { blob: Blob; claimCount: number; photoCount: number }

// client-zip caps how many in-flight fetches it will keep open, so keep the
// pool small and predictable.
const FETCH_CONCURRENCY = 6

async function fetchBlob(url: string): Promise<Blob> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`تعذر تنزيل إحدى الصور (${response.status}).`)
  return response.blob()
}

export async function buildPhotoArchive(claims: AdminClaim[]): Promise<ArchiveResult> {
  const claimIds = claims.map((c) => c.id)
  const photos = await photosForClaims(claimIds)
  if (photos.length === 0) return { blob: new Blob([]), claimCount: 0, photoCount: 0 }

  const serialByClaim = new Map(claims.map((c) => [c.id, c.serial]))
  const urls = await signedUrls(photos.map((p) => p.storage_path))

  const targets = photos.flatMap((photo) => {
    const url = urls.get(photo.storage_path)
    if (!url) return []
    const serial = serialByClaim.get(photo.claim_id) ?? photo.claim_id
    return [{ name: `${serial}/${photo.kind}.jpg`, url }]
  })
  if (targets.length === 0) return { blob: new Blob([]), claimCount: 0, photoCount: 0 }

  // A string input is written as literal text by client-zip, not fetched as a
  // URL, so every photo must be resolved to a real Blob up front.
  const files: Array<{ name: string; input: Blob }> = []
  for (let i = 0; i < targets.length; i += FETCH_CONCURRENCY) {
    const batch = targets.slice(i, i + FETCH_CONCURRENCY)
    const resolved = await Promise.all(
      batch.map(async (target) => ({ name: target.name, input: await fetchBlob(target.url) })),
    )
    files.push(...resolved)
  }

  const blob = await downloadZip(files).blob()

  const exportedClaimIds = [...new Set(files.map((f) => f.name.split('/')[0]))]
    .map((serial) => claims.find((c) => c.serial === serial)?.id)
    .filter((id): id is string => Boolean(id))
  await markExported(exportedClaimIds)

  return { blob, claimCount: exportedClaimIds.length, photoCount: files.length }
}
