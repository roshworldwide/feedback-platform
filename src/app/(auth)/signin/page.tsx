import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/supabase/server";
import { SignInForm } from "./signin-form";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** A `next` that leaves the origin is not a destination, it is an attack. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/overview";
  return raw;
}

function reasonOf(raw: string | null): "inactive" | "oauth" | null {
  return raw === "inactive" || raw === "oauth" ? raw : null;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const next = safeNext(first(params.next));
  const reason = reasonOf(first(params.reason));

  // A person with a live, active profile has no business on this screen.
  // The check is never allowed to throw the page — if auth is unreachable the
  // form is exactly what should be shown.
  let signedIn = false;
  try {
    signedIn = (await getSessionProfile()) !== null;
  } catch {
    signedIn = false;
  }
  if (signedIn) redirect(next);

  return <SignInForm next={next} reason={reason} detail={first(params.detail)} />;
}
