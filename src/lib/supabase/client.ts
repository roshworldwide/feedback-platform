import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

/**
 * Browser client.
 *
 * Anon key only — it is public by design and every read it performs runs under
 * the caller's RLS policies. The service-role key lives behind `serverEnv()`
 * and can never reach this bundle.
 *
 * `createBrowserClient` memoises internally, so calling this per component is
 * cheap and there is only ever one auth listener per tab.
 */
export function createClient() {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
