import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Where Google lands.
 *
 * The provider returns an authorisation code; this exchanges it for a session
 * and writes the cookies. A route handler is the only place that can — a Server
 * Component's cookie store is read-only.
 *
 * `next` is validated as a same-origin path before it is used, so the callback
 * cannot be turned into an open redirect.
 */
function safeNext(raw: string | null): string {
  if (!raw) return "/overview";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/overview";
  return raw;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  // The provider itself refused — say so rather than showing a blank form.
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError) {
    const url = new URL("/signin", origin);
    url.searchParams.set("reason", "oauth");
    url.searchParams.set("detail", providerError);
    return NextResponse.redirect(url);
  }

  if (!code) {
    const url = new URL("/signin", origin);
    url.searchParams.set("reason", "oauth");
    return NextResponse.redirect(url);
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const url = new URL("/signin", origin);
      url.searchParams.set("reason", "oauth");
      url.searchParams.set("detail", error.message);
      return NextResponse.redirect(url);
    }
  } catch {
    const url = new URL("/signin", origin);
    url.searchParams.set("reason", "oauth");
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL(next, origin));
}
