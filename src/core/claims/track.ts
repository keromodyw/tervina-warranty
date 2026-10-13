/**
 * M8 - public tracking by phone. Backed by track_claims_by_phone(), which is
 * SECURITY DEFINER and returns ONLY serial/type/status/dates - never names,
 * phones, auth ids or photo paths (see ..._08_track_rpc.sql). The RPC is granted
 * to anon, so a visitor who never started an activation can still look up a
 * warranty with the phone number they already know.
 */
import { supabase } from '@/core/supabase/client'
import { phoneForStorage } from '@/core/lib/phone'

export type ClaimStatus = 'pending' | 'approved' | 'declined'

export type TrackedClaim = {
  activation_code: string
  serial: string
  item_type: string
  product_type: string
  capacity: string | null
  status: ClaimStatus
  decline_reason: string | null
  warranty_start: string | null
  warranty_end: string | null
  submitted_at: string
}

export const STATUS_LABELS: Readonly<Record<ClaimStatus, string>> = {
  pending: 'قيد المراجعة',
  approved: 'تمت الموافقة',
  declined: 'مرفوض',
}

/**
 * Returns [] for a phone with no claims (the RPC returns zero rows, not an
 * error). Throws only on a real failure, and never with the raw phone echoed
 * back in the message.
 */
export async function trackByPhone(rawPhone: string): Promise<TrackedClaim[]> {
  const phone = phoneForStorage(rawPhone)
  if (!phone) throw new Error('رقم الهاتف غير صالح.')

  const { data, error } = await supabase.rpc('track_claims_by_phone', { p_phone: phone })
  if (error) throw error
  return (data ?? []) as TrackedClaim[]
}
