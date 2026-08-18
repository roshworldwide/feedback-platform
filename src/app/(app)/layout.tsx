import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import type { ShellProfile } from "@/components/shell";
import { getSessionProfile } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * The gate.
 *
 * The proxy has already established that a session exists. This asks the
 * second question the proxy cannot: does that session still resolve to an
 * active profile? A departed colleague keeps a valid token until it expires —
 * v1 let departed staff sign in indefinitely, and this is the control that
 * makes that impossible.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/signin?reason=inactive");

  const shellProfile: ShellProfile = {
    id: String(profile.id),
    email: String(profile.email),
    full_name: String(profile.full_name ?? ""),
    role: String(profile.role),
  };

  return <AppShell profile={shellProfile}>{children}</AppShell>;
}
