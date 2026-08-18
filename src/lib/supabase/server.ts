import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * Request-scoped client carrying the caller's session, so every query runs
 * under that user's RLS policies. This is the only client used for anything a
 * signed-in person reads or writes.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh is handled by middleware, so this is safe to skip.
        }
      },
    },
  });
}

/**
 * The exact shape of `profiles` this app ever reads for the signed-in
 * person. The query builder below has no `Database` generic to infer from,
 * so without this annotation every field — `id` included — comes back as
 * `any`, and an ownership check like `card.ownerId === me` would type-check
 * even if one side silently stopped being a string.
 */
export type SessionProfile = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
};

/** The signed-in profile, or null. Never throws — callers redirect. */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", user.id)
    .single();

  const profile = data as SessionProfile | null;

  // A deactivated account has a valid session and no access. This is the
  // control v1 lacked: departed staff kept working credentials indefinitely.
  if (!profile || !profile.is_active) return null;
  return profile;
}
