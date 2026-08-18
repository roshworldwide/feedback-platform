import { serverEnv } from "@/lib/env";

/**
 * The delivery adapter.
 *
 * With `RESEND_API_KEY` set this posts to Resend over `fetch` — no SDK, no
 * extra dependency, no version to keep in step. Without it, development gets a
 * logger that reports success, so the whole compose → send → track loop is
 * exercisable on a laptop with no provider account and no risk of a real
 * message reaching a real client.
 *
 * A send never throws. A failed address is a recorded outcome, not a crash in
 * the middle of a 40-recipient loop.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  /** Overrides `EMAIL_FROM`. Used by the Sender settings tab. */
  from?: string | null;
  headers?: Record<string, string>;
};

export type SendResult =
  | { ok: true; id: string; provider: "resend" | "dev" }
  | { ok: false; error: string; provider: "resend" | "dev" };

type ResendResponse = { id?: string; message?: string; name?: string };

export function emailProvider(): "resend" | "dev" {
  return serverEnv().RESEND_API_KEY ? "resend" : "dev";
}

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const env = serverEnv();
  const from = message.from?.trim() || env.EMAIL_FROM;

  if (!env.RESEND_API_KEY) {
    // The no-op path. Loud enough to notice, quiet enough to run in a loop.
    console.info(
      "[email:dev] would send to %s — %s (%d bytes of HTML)",
      message.to,
      message.subject,
      message.html.length,
    );
    return {
      ok: true,
      id: `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      provider: "dev",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: message.replyTo ?? undefined,
        headers: message.headers,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as ResendResponse;

    if (!response.ok) {
      return {
        ok: false,
        provider: "resend",
        error: payload.message ?? `Resend returned ${response.status}`,
      };
    }
    return { ok: true, provider: "resend", id: payload.id ?? "unknown" };
  } catch (cause) {
    return {
      ok: false,
      provider: "resend",
      error: cause instanceof Error ? cause.message : "Could not reach the mail provider",
    };
  }
}
