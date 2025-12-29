// backend/lib/supabase.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/supabase'
import type { Env } from '../src/types/env'

export const getSupabaseClient = (env: Env): SupabaseClient<Database> => {
  const url = env.SUPABASE_URL
  const key = env.SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      `Missing env: SUPABASE_URL or SERVICE_ROLE_KEY (SUPABASE_URL=${!!url}, SERVICE_ROLE_KEY=${!!key})`
    )
  }

  return createClient<Database>(url, key, {
    auth: { persistSession: false },
  })
}
