import { env } from "@/lib/env";
import { parseRating, recordRating, resolveRecipient } from "@/lib/email/tracking";

/**
 * The rating endpoint.
 *
 * UPSERTs on `recipient_id`, which is UNIQUE — one rating per recipient per
 * campaign, forever. A second click corrects the first rather than adding to
 * it, which is why the average is trustworthy and why "12 ratings" means twelve
 * people.
 *
 * It writes no `email_events` row. Inferring an open from a rating would be the
 * same class of mistake as inferring one from a click; if the pixel or the CTA
 * did not fire, engagement stays unrecorded and honest.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private, max-age=0",
} as const;

function wantsJson(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";
  return accept.includes("application/json") || contentType.includes("application/json");
}

/** The public page is the only thing a recipient is ever redirected to. */
function landing(token: string, rating: number | null) {
  const base = `${env.NEXT_PUBLIC_APP_URL}/f/${encodeURIComponent(token)}`;
  return rating === null ? base : `${base}?r=${rating}`;
}

async function ratingFrom(request: Request, url: URL): Promise<number | null> {
  const fromQuery = parseRating(url.searchParams.get("r"));
  if (fromQuery !== null) return fromQuery;
  if (request.method !== "POST") return null;

  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body: unknown = await request.json();
      if (body && typeof body === "object" && "rating" in body) {
        return parseRating((body as { rating: unknown }).rating);
      }
      return null;
    }
    const form = await request.formData();
    return parseRating(form.get("rating") ?? form.get("r"));
  } catch {
    return null;
  }
}

async function handle(
  request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  const json = wantsJson(request);
  let token = "";
  try {
    ({ token } = await context.params);
    const url = new URL(request.url);
    const rating = await ratingFrom(request, url);

    const recipient = await resolveRecipient(token);
    if (!recipient) {
      return json
        ? Response.json(
            { ok: false, error: "unknown-token" },
            { status: 404, headers: NO_STORE },
          )
        : Response.redirect(landing(token, null), 302);
    }

    if (rating === null) {
      return json
        ? Response.json(
            { ok: false, error: "invalid-rating" },
            { status: 400, headers: NO_STORE },
          )
        : Response.redirect(landing(token, null), 302);
    }

    const outcome = await recordRating(recipient, rating);

    if (json) {
      return outcome.ok
        ? Response.json(
            { ok: true, rating: outcome.rating, created: outcome.created },
            { headers: NO_STORE },
          )
        : Response.json({ ok: false, error: outcome.reason }, { status: 503, headers: NO_STORE });
    }

    return Response.redirect(landing(token, rating), 302);
  } catch (cause) {
    console.error("[api/t/r] unhandled", cause);
    // A recipient never sees a 500. They see the page that thanks them.
    return json
      ? Response.json({ ok: false, error: "failed" }, { status: 503, headers: NO_STORE })
      : Response.redirect(landing(token, null), 302);
  }
}

export function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  return handle(request, context);
}

export function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  return handle(request, context);
}
