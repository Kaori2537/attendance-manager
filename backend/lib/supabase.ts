// backend/lib/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/supabase";
import type { Env } from "../src/types/env";

/**
 * Server-side (authoritative) client:
 * - Uses service role key
 * - Bypasses RLS
 */
export const getSupabaseAdminClient = (env: Env): SupabaseClient<Database> => {
  const url = env.SUPABASE_URL;
  const key = (env as any).SUPABASE_SERVICE_ROLE_KEY ?? (env as any).SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      `Missing env: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SERVICE_ROLE_KEY ` +
        `(SUPABASE_URL=${!!url}, hasServiceRoleKey=${!!key})`
    );
  }

  return createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
};

/**
 * User-scoped client:
 * - Uses anon/publishable key
 * - Sends user's JWT as Authorization header (for RLS)
 *
 * NOTE: userJwt must be the JWT you issue (eyJ... with 3 parts), not sb_secret.
 */
export const getSupabaseUserClient = (
  env: Env,
  userJwt: string
): SupabaseClient<Database> => {
  const url = env.SUPABASE_URL;
  const anonKey = (env as any).SUPABASE_ANON_KEY ?? (env as any).ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      `Missing env: SUPABASE_URL or SUPABASE_ANON_KEY (SUPABASE_URL=${!!url}, SUPABASE_ANON_KEY=${!!anonKey})`
    );
  }
  if (!userJwt || userJwt.split(".").length !== 3) {
    throw new Error("Invalid user JWT (expected 3 parts).");
  }

  return createClient<Database>(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${userJwt}`,
      },
    },
    auth: { persistSession: false },
  });
};

/**
 * Backward compatible export:
 * Most of your backend routes expect "getSupabaseClient(env)" to be admin client.
 */
export const getSupabaseClient = getSupabaseAdminClient;
