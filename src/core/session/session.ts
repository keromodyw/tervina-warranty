/**
 * Anonymous session + wizard draft persistence (D1).
 *
 * This module is the ONLY place in the bundle allowed to read or write
 * localStorage with customer data - the M9 gate greps for localStorage PII
 * writes and expects every hit to be here. If you need to cache a claim field
 * elsewhere, add a function here instead.
 *
 * The draft is a single small object (one useReducer in useActivationDraft), so
 * localStorage is deliberate: no Dexie/idb-keyval (PROJECT_MAP [STACK]).
 */
import { z } from 'zod'
import { supabase } from '@/core/supabase/client'
import { phoneForStorage } from '@/core/lib/phone'
import { sectorFor } from '@/core/data/sector'

const DRAFT_KEY = 'tervina.draft.v1'
const DRAFT_VERSION = 1

/** Step 1 fields, exactly as they are collected and later replayed on submit. */
export type PersonalDraft = {
  full_name: string
  phone: string
  technician_name: string
  technician_phone: string
  governorate: string
  city: string
}

/** Step 2 fields. `serial` arrives from the barcode step (M6), not typed here. */
export type ProductDraft = {
  item_type: string
  product_type: string
  capacity: string
  serial: string
  warranty_months: number | null
}

export type Draft = {
  version: typeof DRAFT_VERSION
  step: number
  personal: PersonalDraft
  product: ProductDraft
  /** Client-generated UUID, so a retry reuses one claim (M7 insert ordering). */
  claimId: string | null
  updatedAt: string
}

export function emptyPersonal(): PersonalDraft {
  return {
    full_name: '',
    phone: '',
    technician_name: '',
    technician_phone: '',
    governorate: '',
    city: '',
  }
}

export function emptyProduct(): ProductDraft {
  return {
    item_type: '',
    product_type: '',
    capacity: '',
    serial: '',
    warranty_months: null,
  }
}

export function freshDraft(): Draft {
  return {
    version: DRAFT_VERSION,
    step: 1,
    personal: emptyPersonal(),
    product: emptyProduct(),
    claimId: null,
    updatedAt: new Date().toISOString(),
  }
}

// Validates what comes back out of localStorage. A draft written by an older
// build (or hand-edited) must degrade to "no draft" rather than throw mid-render.
const personalDraftSchema = z.object({
  full_name: z.string(),
  phone: z.string(),
  technician_name: z.string(),
  technician_phone: z.string(),
  governorate: z.string(),
  city: z.string(),
})

const productDraftSchema = z.object({
  item_type: z.string(),
  product_type: z.string(),
  capacity: z.string(),
  serial: z.string(),
  warranty_months: z.number().int().nullable(),
})

const draftSchema = z.object({
  version: z.literal(DRAFT_VERSION),
  step: z.number().int().min(1).max(4),
  personal: personalDraftSchema,
  product: productDraftSchema,
  claimId: z.string().nullable(),
  updatedAt: z.string(),
})

export function serializeDraft(draft: Draft): string {
  return JSON.stringify(draft)
}

export function parseDraft(raw: string | null): Draft | null {
  if (!raw) return null
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return null
  }
  const parsed = draftSchema.safeParse(json)
  return parsed.success ? parsed.data : null
}

/**
 * localStorage can be absent (SSR/tests) or throw (Safari private mode writes).
 * Both must be survivable - a lost draft only costs the customer re-typing,
 * never a broken page.
 */
function getStorage(): Storage | null {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage ?? null
  } catch {
    return null
  }
}

export function loadDraft(): Draft | null {
  const store = getStorage()
  if (!store) return null
  try {
    return parseDraft(store.getItem(DRAFT_KEY))
  } catch {
    return null
  }
}

export function saveDraft(draft: Draft): void {
  const store = getStorage()
  if (!store) return
  try {
    store.setItem(DRAFT_KEY, serializeDraft(draft))
  } catch {
    // Quota or private mode - the in-memory draft still works this session.
  }
}

export function clearDraft(): void {
  const store = getStorage()
  if (!store) return
  try {
    store.removeItem(DRAFT_KEY)
  } catch {
    // Nothing to do.
  }
}

export function hasDraft(): boolean {
  return loadDraft() !== null
}

/**
 * True only when the flow has actually progressed past the personal step, so a
 * draft that merely carries remembered personal info (after a completed submit)
 * does not falsely read as "activation in progress" on the landing page.
 */
export function hasIncompleteDraft(): boolean {
  const draft = loadDraft()
  return draft !== null && draft.step > 1
}

/**
 * Return the current user id, creating an anonymous session if needed.
 * Anonymous (not email) because a real JWT is what makes RLS ownership work
 * with zero friction (D1). Recovery is track-by-phone (D5).
 */
export async function ensureAnonymousUserId(): Promise<string> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  const existing = sessionData.session?.user?.id
  if (existing) return existing

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  const id = data.user?.id
  if (!id) throw new Error('تعذر إنشاء جلسة التفعيل، حاول مرة أخرى.')
  return id
}

/** The one customers row this session owns (upsert key), typed for the insert. */
export type CustomerRowInput = {
  auth_user_id: string
  full_name: string
  phone: string
  governorate: string
  city: string
  sector: string
}

/**
 * Pure mapping from the form draft to the customers row. sector is derived
 * here, never typed by the customer (D17); phone is normalised to E.164 so the
 * CHECK constraint and track-by-phone agree with the DB trigger.
 */
export function buildCustomerRow(userId: string, personal: PersonalDraft): CustomerRowInput {
  const phone = phoneForStorage(personal.phone)
  if (!phone) throw new Error('رقم الهاتف غير صالح.')

  const sector = sectorFor(personal.governorate)
  if (!sector) {
    throw new Error('تعذر تحديد القطاع تلقائيًا، الرجاء اختيار المحافظة والمركز مرة أخرى.')
  }

  return {
    auth_user_id: userId,
    full_name: personal.full_name.trim(),
    phone,
    governorate: personal.governorate,
    city: personal.city,
    sector,
  }
}

export type UpsertedCustomer = { id: string }

/**
 * Upsert on auth_user_id (UNIQUE) so a refresh, retry or back-navigation
 * updates the same row instead of creating duplicates. RLS "customers insert
 * own / update own" allows exactly this and nothing else.
 */
export async function upsertCustomer(
  userId: string,
  personal: PersonalDraft,
): Promise<UpsertedCustomer> {
  const row = buildCustomerRow(userId, personal)
  const { data, error } = await supabase
    .from('customers')
    .upsert(row, { onConflict: 'auth_user_id' })
    .select('id')
    .single()

  if (error) throw error
  return data
}
