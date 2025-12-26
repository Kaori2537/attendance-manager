// backend/lib/supabaseDailyReport.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/supabase'

export const getDailyReportSupabaseClient = (env: {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}) => {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
}
