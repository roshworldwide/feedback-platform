import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

/**
 * Session refresh at the edge.
 *
 * Supabase access tokens are short-lived. Without a refresh on every request a
 * signed-in person is silently logged out mid-task, which is exactly the class
 * of failure v1 papered over by never expiring a PIN at all.
 *
 * These surfaces are reachable without a session, and only these:
 *
 *   /signin        the way in
 *   /f/*           the public feedback page a recipient opens from an email
 *   /u/*           the unsubscribe page/one-click endpoint, same reasoning
 *   /api/t/*       the tracking pixel and click redirect, called by mail clients
 *   /api/cron/*    called by the scheduler, authenticated by CRON_SECRET as a
 *                  bearer token inside the route itself — it has no session
 *                  to present here, and never will
 *   /api/webhooks/* called by Resend, authenticated by a Svix signature inside
 *                  the route itself, for the same reason
 *
 * The last two are not "public" in the sense of admitting anyone — each
 * route enforces its own auth immediately after this middleware lets the
 * request through. What they cannot do is present a browser session cookie,
 * so gating them here would make them permanently unreachable rather than
 * merely inconvenient.
 */
const PUBLIC_EXACT = new Set(["/signin"]);
const PUBLIC_PREFIXES = ["/f/", "/u/", "/api/t/", "/api/cron/", "/api/webhooks/"] as const;

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  // Held in a closure so `setAll` can rebuild it with refreshed cookies.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() revalidates against the auth server. getSession() only decodes
  // the cookie, which a client can forge — never use it for a gate.
  let signedIn = false;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = Boolean(user);
  } catch {
    // Auth unreachable. An unverifiable session is not a session: fall through
    // as signed out rather than admitting a request we could not check.
    signedIn = false;
  }

  const { pathname, search } = request.nextUrl;

  if (!signedIn && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.search = "";
    // Preserve the destination so the trip through sign-in is not a detour.
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  // Deliberately NOT bouncing a signed-in caller off /signin. A session whose
  // profile is deactivated is signed in and may read nothing; bouncing it would
  // ping-pong against the app guard forever. /signin decides that case itself,
  // because only it can tell a live profile from a dead one.
  return response;
}
