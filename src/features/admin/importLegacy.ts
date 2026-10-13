import { adminSupabase } from '@/core/supabase/adminClient'
import { phoneForStorage } from '@/core/lib/phone'
import type { LegacyRow } from './legacySheet'

/**
 * Legacy import (A7). Each good row becomes an ALREADY-REVIEWED approved claim:
 * reviewed + sent + photos_exported are forced true, because these are historical
 * certificates, not new work. Serial is globally unique (D18), so re-importing
 * the same ledger fails per row on the duplicate - the import doubles as the
 * duplicate/fraud baseline.
 *
 * Malformed rows are reported individually and never abort the batch.
 */

export type ImportOutcome = {
  imported: number
  failed: Array<{ serial: string; error: string }>
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function importLegacyRows(
  rows: LegacyRow[],
  staffUserId: string | null,
): Promise<ImportOutcome> {
  const failed: Array<{ serial: string; error: string }> = []
  let imported = 0

  for (const row of rows) {
    try {
      const phone = phoneForStorage(row.phone)
      if (!phone) throw new Error('رقم تليفون غير صالح')

      const customerId = await findOrCreateCustomer(row, phone)
      const now = new Date().toISOString()

      const { error } = await adminSupabase.from('warranty_claims').insert({
        customer_id: customerId,
        serial: row.serial,
        item_type: row.item_type,
        product_type: row.product_type,
        capacity: row.capacity,
        warranty_months: row.warranty_months,
        warranty_start: row.warranty_start ?? today(),
        technician_name: row.technician_name,
        technician_phone: row.technician_phone ? phoneForStorage(row.technician_phone) : null,
        status: 'approved',
        reviewed_at: now,
        reviewed_by: staffUserId,
        sent_to_customer: true,
        sent_at: now,
        photos_exported: true,
        source: 'legacy',
        notes: row.notes,
      })
      if (error) throw error
      imported += 1
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      failed.push({
        serial: row.serial,
        error: message.includes('duplicate') || message.includes('23505') ? 'السيريال مكرر' : message,
      })
    }
  }

  return { imported, failed }
}

async function findOrCreateCustomer(row: LegacyRow, phone: string): Promise<string> {
  const { data } = await adminSupabase
    .from('customers')
    .select('id')
    .eq('phone', phone)
    .limit(1)
  const existing = (data ?? [])[0] as { id: string } | undefined
  if (existing) return existing.id

  const { data: created, error } = await adminSupabase
    .from('customers')
    .insert({
      auth_user_id: null,
      full_name: row.full_name,
      phone,
      governorate: row.governorate,
      city: row.city,
      sector: row.sector,
    })
    .select('id')
    .single()
  if (error) throw error
  return (created as { id: string }).id
}
