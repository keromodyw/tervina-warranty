import { supabase } from '@/core/supabase/client'
import { buildWarrantyIndex, type WarrantyIndex, type WarrantyRuleRow } from './resolve'

/**
 * Admin-editable durations (D22). warranty_rules is public SELECT, so the
 * wizard reads it directly and overlays it on the generated baseline via
 * resolveWarrantyMonths. A read failure is not fatal: the baseline still
 * resolves, so the wizard degrades instead of dead-ending.
 */
export async function fetchWarrantyIndex(): Promise<WarrantyIndex> {
  const { data, error } = await supabase
    .from('warranty_rules')
    .select('item_type, product_type, warranty_months')

  if (error) throw error
  return buildWarrantyIndex((data ?? []) as WarrantyRuleRow[])
}
