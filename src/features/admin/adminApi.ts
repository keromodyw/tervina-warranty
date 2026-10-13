import { adminSupabase } from '@/core/supabase/adminClient'
import type { ClaimStatus } from '@/core/claims/track'

export type AdminCustomer = {
  full_name: string
  phone: string
  governorate: string
  city: string
  sector: string
}

export type AdminClaim = {
  id: string
  activation_code: string | null
  serial: string
  item_type: string
  product_type: string
  capacity: string | null
  status: ClaimStatus
  decline_reason: string | null
  reviewed_at: string | null
  sent_to_customer: boolean
  sent_at: string | null
  photos_exported: boolean
  notes: string | null
  technician_name: string | null
  technician_phone: string | null
  source: string
  warranty_months: number | null
  warranty_start: string
  warranty_end: string | null
  created_at: string
  customer: AdminCustomer | null
}

const CLAIM_SELECT =
  'id, activation_code, serial, item_type, product_type, capacity, status, decline_reason, reviewed_at, sent_to_customer, sent_at, photos_exported, created_at, technician_name, technician_phone, notes, source, warranty_months, warranty_start, warranty_end, customer:customers(full_name, phone, governorate, city, sector)'

export type OrdersFilter = {
  status?: ClaimStatus | ''
  sent?: boolean
  exported?: boolean
  search?: string
  /** Inclusive ISO date bounds on created_at. */
  from?: string
  to?: string
}

/** Strip PostgREST filter metacharacters so user input can't break the query. */
function sanitizeSearch(term: string): string {
  return term.replace(/[%,()*\\]/g, '').trim()
}

export async function listClaims(filter: OrdersFilter = {}): Promise<AdminClaim[]> {
  let query = adminSupabase
    .from('warranty_claims')
    .select(CLAIM_SELECT)
    .order('created_at', { ascending: false })
    .limit(300)

  if (filter.status) query = query.eq('status', filter.status)
  if (filter.sent === true) query = query.eq('sent_to_customer', true)
  if (filter.sent === false) query = query.eq('sent_to_customer', false)
  if (filter.exported === true) query = query.eq('photos_exported', true)
  if (filter.exported === false) query = query.eq('photos_exported', false)
  if (filter.from) query = query.gte('created_at', filter.from)
  if (filter.to) query = query.lte('created_at', filter.to)

  const term = sanitizeSearch(filter.search ?? '')
  if (term) {
    query = query.or(
      `serial.ilike.%${term}%,activation_code.ilike.%${term}%,customers.full_name.ilike.%${term}%,customers.phone.ilike.%${term}%`,
    )
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as AdminClaim[]
}

export async function approveClaim(id: string, staffUserId: string | null): Promise<void> {
  const { error } = await adminSupabase
    .from('warranty_claims')
    .update({
      status: 'approved',
      decline_reason: null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: staffUserId,
    })
    .eq('id', id)
  if (error) throw error
}

export async function declineClaim(
  id: string,
  reason: string,
  staffUserId: string | null,
): Promise<void> {
  const { error } = await adminSupabase
    .from('warranty_claims')
    .update({
      status: 'declined',
      decline_reason: reason,
      reviewed_at: new Date().toISOString(),
      reviewed_by: staffUserId,
    })
    .eq('id', id)
  if (error) throw error
}

export async function markSent(id: string): Promise<void> {
  const { error } = await adminSupabase
    .from('warranty_claims')
    .update({ sent_to_customer: true, sent_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function saveNotes(id: string, notes: string): Promise<void> {
  const { error } = await adminSupabase.from('warranty_claims').update({ notes }).eq('id', id)
  if (error) throw error
}

export async function markExported(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await adminSupabase
    .from('warranty_claims')
    .update({ photos_exported: true })
    .in('id', ids)
  if (error) throw error
}

export type ClaimPhotoRow = { claim_id: string; kind: string; storage_path: string }

export async function photosForClaims(claimIds: string[]): Promise<ClaimPhotoRow[]> {
  if (claimIds.length === 0) return []
  const { data, error } = await adminSupabase
    .from('claim_photos')
    .select('claim_id, kind, storage_path')
    .in('claim_id', claimIds)
  if (error) throw error
  return (data ?? []) as ClaimPhotoRow[]
}

/** Signed URL per storage path (private bucket), valid for one hour. */
export async function signedUrls(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (paths.length === 0) return map
  const { data, error } = await adminSupabase.storage
    .from('claim-photos')
    .createSignedUrls(paths, 3600)
  if (error) throw error
  ;(data ?? []).forEach((entry, i) => {
    const url = (entry as { signedUrl?: string } | undefined)?.signedUrl
    if (url) map.set(paths[i]!, url)
  })
  return map
}

export type ClaimPhoto = { kind: string; url: string }

export async function claimPhotoUrls(claimId: string): Promise<ClaimPhoto[]> {
  const { data, error } = await adminSupabase
    .from('claim_photos')
    .select('kind, storage_path')
    .eq('claim_id', claimId)
  if (error) throw error
  const rows = (data ?? []) as Array<{ kind: string; storage_path: string }>
  if (rows.length === 0) return []

  const { data: signed, error: signErr } = await adminSupabase.storage
    .from('claim-photos')
    .createSignedUrls(
      rows.map((r) => r.storage_path),
      3600,
    )
  if (signErr) throw signErr

  return rows.map((r, i) => ({
    kind: r.kind,
    url: (signed?.[i] as { signedUrl?: string } | undefined)?.signedUrl ?? '',
  }))
}

// ------------------------------------------------------------------ dashboard

export type DashboardData = {
  total: number
  pending: number
  approved: number
  declined: number
  sent: number
  exported: number
  today: number
  month: number
  byItem: Array<{ label: string; count: number }>
  bySector: Array<{ label: string; count: number }>
  byGovernorate: Array<{ label: string; count: number }>
}

export async function loadDashboard(): Promise<DashboardData> {
  const { data, error } = await adminSupabase
    .from('warranty_claims')
    .select('status, sent_to_customer, photos_exported, created_at, item_type, customer:customers(sector, governorate)')
  if (error) throw error
  const rows = (data ?? []) as unknown as Array<{
    status: ClaimStatus
    sent_to_customer: boolean
    photos_exported: boolean
    created_at: string
    item_type: string
    customer: { sector: string; governorate: string } | null
  }>

  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

  const byItem = new Map<string, number>()
  const bySector = new Map<string, number>()
  const byGov = new Map<string, number>()

  let pending = 0
  let approved = 0
  let declined = 0
  let sent = 0
  let exported = 0
  let today = 0
  let month = 0

  for (const row of rows) {
    if (row.status === 'pending') pending += 1
    if (row.status === 'approved') approved += 1
    if (row.status === 'declined') declined += 1
    if (row.sent_to_customer) sent += 1
    if (row.photos_exported) exported += 1
    const created = new Date(row.created_at).getTime()
    if (created >= startOfDay) today += 1
    if (created >= startOfMonth) month += 1

    byItem.set(row.item_type, (byItem.get(row.item_type) ?? 0) + 1)
    const sector = row.customer?.sector
    if (sector) bySector.set(sector, (bySector.get(sector) ?? 0) + 1)
    const gov = row.customer?.governorate
    if (gov) byGov.set(gov, (byGov.get(gov) ?? 0) + 1)
  }

  const toSorted = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }))

  return {
    total: rows.length,
    pending,
    approved,
    declined,
    sent,
    exported,
    today,
    month,
    byItem: toSorted(byItem),
    bySector: toSorted(bySector),
    byGovernorate: toSorted(byGov),
  }
}
