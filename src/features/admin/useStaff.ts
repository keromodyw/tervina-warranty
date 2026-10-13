import { useCallback, useEffect, useState } from 'react'
import { adminSupabase } from '@/core/supabase/adminClient'
import { checkIsStaff, signOutStaff } from './auth'

export type StaffState = {
  loading: boolean
  email: string | null
  isStaff: boolean
  /** Present only when a session exists but the user is not (or no longer) staff. */
  notStaff: boolean
}

/**
 * Resolves the admin session: email from Supabase Auth + an authoritative staff
 * check against RLS. Refreshes after login/logout so the gate re-evaluates.
 */
export function useStaff() {
  const [state, setState] = useState<StaffState>({
    loading: true,
    email: null,
    isStaff: false,
    notStaff: false,
  })

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }))
    const { data } = await adminSupabase.auth.getSession()
    const email = data.session?.user.email ?? null
    const isStaff = email ? await checkIsStaff() : false
    setState({ loading: false, email, isStaff, notStaff: email !== null && !isStaff })
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const signOut = useCallback(async () => {
    await signOutStaff()
    await refresh()
  }, [refresh])

  return { ...state, refresh, signOut }
}
