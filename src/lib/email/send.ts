import nodemailer from "nodemailer";
import { serverEnv } from "@/lib/env";

/**
 * The delivery adapter.
 *
 * Three tiers, checked in order: `RESEND_API_KEY` posts to Resend over
 * `fetch` — no SDK, no extra dependency, no version to keep in step.
 * `GMAIL_USER` + `GMAIL_APP_PASSWORD` sends through Gmail/Workspace's own
 * SMTP relay instead — no domain DNS verification needed, since the mailbox
 * is already Google's to vouch for, but `from` has to be that same mailbox
 * (or a configured "send as" alias of it) — Gmail's relay silently rewrites
 * or rejects a `from` it doesn't recognise. Without either, development gets
 * a logger that reports success, so the whole compose → send → track loop is
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

export type EmailProvider = "resend" | "gmail" | "dev";

export type SendResult =
  | { ok: true; id: string; provider: EmailProvider }
  | { ok: false; error: string; provider: EmailProvider };

type ResendResponse = { id?: string; message?: string; name?: string };

export function emailProvider(): EmailProvider {
  const env = serverEnv();
  if (env.RESEND_API_KEY) return "resend";
  if (env.GMAIL_USER && env.GMAIL_APP_PASSWORD) return "gmail";
  return "dev";
}

let gmailTransport: ReturnType<typeof nodemailer.createTransport> | null = null;

/** Memoised per process — one transport, reused, not reconnected on every send. */
function gmailTransportFor(user: string, appPassword: string) {
  if (!gmailTransport) {
    gmailTransport = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass: appPassword },
    });
  }
  return gmailTransport;
}

async function sendViaGmail(message: EmailMessage, from: string): Promise<SendResult> {
  const env = serverEnv();
  // Guaranteed present — sendEmail() only reaches here after emailProvider()
  // confirmed both vars are set.
  const user = env.GMAIL_USER!;
  const appPassword = env.GMAIL_APP_PASSWORD!;

  try {
    const transport = gmailTransportFor(user, appPassword);
    const info = await transport.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo ?? undefined,
      headers: message.headers,
    });
    return { ok: true, provider: "gmail", id: info.messageId ?? "unknown" };
  } catch (cause) {
    return {
      ok: false,
      provider: "gmail",
      error: cause instanceof Error ? cause.message : "Could not reach Gmail's SMTP relay",
    };
  }
}

async function sendViaResend(message: EmailMessage, from: string, apiKey: string): Promise<SendResult> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
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

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const env = serverEnv();
  const from = message.from?.trim() || env.EMAIL_FROM;
  const provider = emailProvider();

  if (provider === "dev") {
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

  if (provider === "gmail") return sendViaGmail(message, from);
  return sendViaResend(message, from, env.RESEND_API_KEY!);
}
