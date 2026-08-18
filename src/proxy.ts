import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * One job: refresh the session and keep unauthenticated traffic out of the
 * application. Everything it needs is in `lib/supabase/middleware.ts` so the
 * public-path list is stated exactly once.
 */
export default async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except the static payload. Matching the tracking and feedback
     * routes deliberately — they still need a refreshed response, they simply
     * are not gated.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf)$).*)",
  ],
};
