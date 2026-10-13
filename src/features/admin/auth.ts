import { adminSupabase } from '@/core/supabase/adminClient'

/**
 * Staff authentication (D28). Supabase Auth owns the credentials; the `staff`
 * table owns authorisation. A signed-in user with no staff row can do nothing -
 * checkIsStaff() reads the table and RLS returns zero rows for non-staff.
 */

export async function signInStaff(email: string, password: string): Promise<void> {
  const { error } = await adminSupabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOutStaff(): Promise<void> {
  await adminSupabase.auth.signOut()
}

export async function currentStaffEmail(): Promise<string | null> {
  const { data } = await adminSupabase.auth.getSession()
  return data.session?.user.email ?? null
}

export async function currentStaffUserId(): Promise<string | null> {
  const { data } = await adminSupabase.auth.getSession()
  return data.session?.user.id ?? null
}

/**
 * Authoritative gate: true only when RLS lets THIS session read the staff table,
 * which is exactly the is_staff() check the database enforces everywhere else.
 */
export async function checkIsStaff(): Promise<boolean> {
  const { data, error } = await adminSupabase.from('staff').select('id').limit(1)
  if (error) return false
  return (data?.length ?? 0) > 0
}
