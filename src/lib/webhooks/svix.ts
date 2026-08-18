import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Svix signature verification, by hand.
 *
 * Resend signs webhooks with Svix. Pulling in the `svix` package for three
 * lines of HMAC is the same call `src/lib/email/send.ts` already made about
 * the Resend API itself — no SDK, no extra dependency, no version to keep in
 * step with. The scheme is documented and stable: sign
 * `${id}.${timestamp}.${body}` with HMAC-SHA256 over the base64-decoded
 * secret (after its `whsec_` prefix), base64-encode the result, and compare
 * against each `v1,<signature>` entry in the `svix-signature` header — Svix
 * sends more than one during a signing-key rotation, and any match is valid.
 *
 * An unverified webhook is an open write endpoint into engagement data: a
 * forged "bounced" event could quietly stop mail to a real client. Every
 * caller must check the result before touching the database.
 */

export type SvixHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

export function svixHeadersFrom(headers: Headers): SvixHeaders {
  return {
    id: headers.get("svix-id"),
    timestamp: headers.get("svix-timestamp"),
    signature: headers.get("svix-signature"),
  };
}

/** Five minutes either side — long enough for real network delay, short enough to block a replayed body. */
const TOLERANCE_SECONDS = 5 * 60;

export type VerifyResult = { ok: true } | { ok: false; reason: string };

export function verifySvixSignature(
  headers: SvixHeaders,
  body: string,
  secret: string,
): VerifyResult {
  if (!headers.id || !headers.timestamp || !headers.signature) {
    return { ok: false, reason: "missing svix-id, svix-timestamp or svix-signature" };
  }

  const timestamp = Number(headers.timestamp);
  if (!Number.isFinite(timestamp)) {
    return { ok: false, reason: "svix-timestamp is not a number" };
  }
  const ageSeconds = Math.abs(Date.now() / 1000 - timestamp);
  if (ageSeconds > TOLERANCE_SECONDS) {
    return { ok: false, reason: "svix-timestamp is outside the tolerance window" };
  }

  const key = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  let keyBytes: Buffer;
  try {
    keyBytes = Buffer.from(key, "base64");
  } catch {
    return { ok: false, reason: "the webhook secret is not valid base64" };
  }

  const signedContent = `${headers.id}.${headers.timestamp}.${body}`;
  const expected = createHmac("sha256", keyBytes).update(signedContent).digest("base64");
  const expectedBytes = Buffer.from(expected, "base64");

  const candidates = headers.signature.split(" ").filter(Boolean);
  for (const candidate of candidates) {
    const [version, value] = candidate.split(",");
    if (version !== "v1" || !value) continue;
    let candidateBytes: Buffer;
    try {
      candidateBytes = Buffer.from(value, "base64");
    } catch {
      continue;
    }
    if (
      candidateBytes.length === expectedBytes.length &&
      timingSafeEqual(candidateBytes, expectedBytes)
    ) {
      return { ok: true };
    }
  }

  return { ok: false, reason: "no signature in svix-signature matched" };
}
