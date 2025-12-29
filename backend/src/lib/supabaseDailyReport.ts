// backend/src/lib/supabaseDailyReport.ts
import { createClient } from '@supabase/supabase-js'
import type { Env } from '../types/env'

export const getDailyReportSupabaseClient = (env: Env) => {
  if (!env.SUPABASE_URL) throw new Error('SUPABASE_URL missing')
  if (!env.SERVICE_ROLE_KEY) throw new Error('SERVICE_ROLE_KEY missing')

  return createClient(env.SUPABASE_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}
