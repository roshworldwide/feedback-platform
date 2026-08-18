import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, serverEnv } from "@/lib/env";

/**
 * The service-role client.
 *
 * RLS denies `anon` everything, which is correct: a recipient clicking a
 * tracking pixel has no session and must never be able to reach the database
 * from the browser. Opens, clicks, ratings and audit rows are therefore written
 * by this client, inside a server route, and nowhere else.
 *
 * Importing this module in a client bundle is a hard error rather than a quiet
 * key leak — the throw is at module scope so it fires on import, not on first
 * use.
 */
if (typeof window !== "undefined") {
  throw new Error(
    "@/lib/supabase/admin was imported in the browser. The service role key " +
      "bypasses RLS and may only be used in a server route or a server action.",
  );
}

let cached: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error(
      "createAdminClient() called in the browser — this would leak the service role key",
    );
  }
  if (cached) return cached;

  const { SUPABASE_SERVICE_ROLE_KEY } = serverEnv();

  cached = createClient(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { headers: { "x-cdl-client": "service-role" } },
  });

  return cached;
}

/**
 * Supabase's untyped client hands back `any`. Every call site funnels its
 * result through here instead, so a row shape is stated once, in one place,
 * and `any` never escapes into product code.
 */
export function rows<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

export function row<T>(data: unknown): T | null {
  return data === null || data === undefined ? null : (data as T);
}

/** Postgres unique-violation. A repeat open is a no-op, not an error. */
export const UNIQUE_VIOLATION = "23505";

export function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === UNIQUE_VIOLATION;
}
