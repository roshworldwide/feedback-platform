import { recordOpen, resolveRecipient } from "@/lib/email/tracking";

/**
 * The open pixel.
 *
 * Always 200, always a GIF, never cached. Whatever happens behind it — an
 * unknown token, a database that has gone away, a repeat open the unique index
 * refuses — the recipient gets a valid 1×1 image and their inbox stays intact.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// A 43-byte transparent GIF. Decoded once at module load, not per request.
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

function pixelResponse(outcome: string): Response {
  return new Response(new Uint8Array(PIXEL), {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.byteLength),
      "Cache-Control": "no-store, no-cache, must-revalidate, private, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      // Useful in a proxy log, invisible to the reader.
      "X-CDL-Track": outcome,
    },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  let outcome = "failed";
  try {
    const { token } = await context.params;
    const recipient = await resolveRecipient(token);
    if (!recipient) {
      // An unknown token is normal: a forwarded email, an archived campaign,
      // a scanner replaying an old URL. It is not an error condition.
      return pixelResponse("unknown-token");
    }
    outcome = await recordOpen(recipient, request.headers);
  } catch (cause) {
    console.error("[api/t/o] unhandled", cause);
  }
  return pixelResponse(outcome);
}

export async function HEAD(
  request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  const response = await GET(request, context);
  return new Response(null, { status: 200, headers: response.headers });
}
