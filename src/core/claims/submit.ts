/**
 * M7 - submit the claim.
 *
 * ORDER MATTERS: the storage upload policy (storage_object_owned_by_caller in
 * ..._09_storage.sql) only allows writing into `claims/{uuid}/...` when a
 * warranty_claims row with that uuid already exists and belongs to the caller.
 * So the claim row is inserted FIRST, then the photos are uploaded, then the
 * claim_photos rows are written. (Earlier notes proposed "upload first, insert
 * the claim last"; that is impossible under the current policy, and the policy
 * is the one that keeps A from writing into B's folder.)
 *
 * The claim id is generated on the client and cached in the draft, so a retry
 * after a network drop reuses the same row instead of filing a duplicate.
 */
import { supabase } from '@/core/supabase/client'
import { phoneForStorage } from '@/core/lib/phone'
import { upsertCustomer, type PersonalDraft, type ProductDraft } from '@/core/session/session'
import { SERIAL_SHOT_KINDS, type PhotoKind } from '@/core/photos/photoManifest'

export type PhotoMap = Partial<Record<PhotoKind, Blob>>

export type SubmitResult = { claimId: string; activationCode: string }

export function newClaimId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // crypto.randomUUID needs a secure context; this fallback keeps the flow
  // alive on plain http during LAN testing.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

type ClaimRow = {
  id: string
  customer_id: string
  item_type: string
  product_type: string
  capacity: string | null
  serial: string
  warranty_months: number | null
  warranty_start: string
  technician_name: string | null
  technician_phone: string | null
  source: string
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function isAlreadyExists(error: {
  message?: string | undefined
  statusCode?: string | number | undefined
}): boolean {
  const message = (error.message ?? '').toLowerCase()
  return message.includes('already exists') || message.includes('duplicate') || error.statusCode === '409'
}

export async function submitClaim(input: {
  userId: string
  claimId: string | null
  personal: PersonalDraft
  product: ProductDraft
  photos: PhotoMap
}): Promise<SubmitResult> {
  const { userId, personal, product, photos } = input
  const claimId = input.claimId ?? newClaimId()

  const customer = await upsertCustomer(userId, personal)

  const row: ClaimRow = {
    id: claimId,
    customer_id: customer.id,
    item_type: product.item_type,
    product_type: product.product_type,
    capacity: product.capacity.trim() === '' ? null : product.capacity,
    serial: product.serial.trim(),
    warranty_months: product.warranty_months,
    warranty_start: today(),
    technician_name: personal.technician_name.trim() === '' ? null : personal.technician_name.trim(),
    technician_phone: phoneForStorage(personal.technician_phone),
    source: 'web',
  }

  let activationCode: string

  const { data: inserted, error: insertError } = await supabase
    .from('warranty_claims')
    .insert(row)
    .select('id, activation_code')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      // A unique clash on `serial` means another claim (pending or approved)
      // already owns it - a partial index lets declined claims release theirs,
      // so a rejected submission never locks the customer out.
      if (/serial/i.test(insertError.message ?? '')) {
        throw new Error(
          'هذا السيريال مُسجَّل بالفعل في طلب آخر. راجع الرقم، أو تواصل مع خدمة العملاء على 19301.',
        )
      }
      // Retry after a partial submit: the row is already there, read it back.
      const { data: existing, error: readError } = await supabase
        .from('warranty_claims')
        .select('id, activation_code')
        .eq('id', claimId)
        .single()
      if (readError || !existing?.activation_code) throw insertError
      activationCode = existing.activation_code
    } else {
      throw insertError
    }
  } else {
    activationCode = inserted.activation_code
  }

  // Which photos already landed on a previous attempt.
  const { data: existingPhotos } = await supabase
    .from('claim_photos')
    .select('kind')
    .eq('claim_id', claimId)
  const done = new Set((existingPhotos ?? []).map((p) => p.kind as PhotoKind))

  for (const [kind, blob] of Object.entries(photos) as Array<[PhotoKind, Blob]>) {
    if (done.has(kind)) continue

    const storagePath = `claims/${claimId}/${kind}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('claim-photos')
      .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: false })

    // A retry may find the object already uploaded; that is not fatal.
    if (uploadError && !isAlreadyExists(uploadError)) throw uploadError

    const { error: photoError } = await supabase.from('claim_photos').insert({
      claim_id: claimId,
      kind,
      storage_path: storagePath,
      detected_serial: SERIAL_SHOT_KINDS.includes(kind) ? product.serial.trim() : null,
    })
    if (photoError) throw photoError
  }

  return { claimId, activationCode }
}
