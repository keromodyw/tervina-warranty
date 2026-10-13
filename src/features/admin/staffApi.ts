import { adminSupabase } from '@/core/supabase/adminClient'

/**
 * Staff management (D28). Supabase Auth owns credentials; this table owns
 * authorisation. Adding a row by email is enough - the on_auth_user_created
 * trigger links user_id the first time that email signs up. is_active=false
 * revokes access immediately without deleting the person's history.
 */

export type StaffRow = {
  id: string
  user_id: string | null
  email: string
  full_name: string
  is_active: boolean
  created_at: string
}

export async function listStaff(): Promise<StaffRow[]> {
  const { data, error } = await adminSupabase
    .from('staff')
    .select('id, user_id, email, full_name, is_active, created_at')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as StaffRow[]
}

export async function addStaff(email: string, fullName: string, addedBy: string | null): Promise<void> {
  const { error } = await adminSupabase
    .from('staff')
    .insert({ email: email.trim().toLowerCase(), full_name: fullName.trim(), added_by: addedBy })
  if (error) throw error
}

export async function setStaffActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await adminSupabase.from('staff').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}

export async function updateStaffName(id: string, fullName: string): Promise<void> {
  const { error } = await adminSupabase.from('staff').update({ full_name: fullName.trim() }).eq('id', id)
  if (error) throw error
}
