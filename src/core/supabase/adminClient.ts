import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Admin client. Deliberately a SECOND client with its own storageKey so the
 * staff email/password session never clobbers the customer's anonymous session
 * (or vice versa): the public site and the panel can be open in the same browser
 * without logging each other out.
 *
 * The anon key is public by design - authorisation is entirely RLS via the
 * staff table (is_staff()), never the client.
 */
export const adminSupabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'tervina-admin-auth',
  },
  global: {
    headers: { 'x-application-name': 'tervina-admin' },
  },
})
