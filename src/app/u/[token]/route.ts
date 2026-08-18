import { env } from "@/lib/env";
import { recordUnsubscribe, resolveRecipient } from "@/lib/email/tracking";

/**
 * Unsubscribe — a GET confirmation page and a one-click POST.
 *
 * Gmail and Yahoo's bulk-sender rules require `List-Unsubscribe-Post:
 * List-Unsubscribe=One-Click`, which means the mail client itself issues a
 * bare POST with no human confirmation screen in between — the POST handler
 * below is what that hits, and it must act immediately and return quickly.
 * A person clicking the link inside the email body instead lands on GET,
 * which asks before doing anything, since a click from inside an email
 * client's link-preview crawler must never itself unsubscribe someone.
 *
 * This is served outside React and outside the stylesheet, matching every
 * other page a recipient (not a signed-in user) reaches from an email — see
 * `src/app/api/t/c/[token]/route.ts` for the same reasoning.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private, max-age=0",
} as const;

function page(title: string, body: string, status = 200): Response {
  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${title}</title></head>` +
    `<body style="margin:0;background:#EFEDEA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">` +
    `<div style="max-width:480px;margin:12vh auto;padding:32px;background:#F7F6F4;border:1px solid #E3E0DB;border-radius:20px;">` +
    body +
    `</div></body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", ...NO_STORE },
  });
}

function unknownTokenPage(): Response {
  return page(
    "This link has expired",
    `<h1 style="margin:0 0 8px;font-size:22px;line-height:28px;color:#0B0B0B;">This link has expired</h1>` +
      `<p style="margin:0;font-size:15px;line-height:23px;color:#4A4741;">The report it came from is no longer being tracked, so there is nothing to unsubscribe from.</p>`,
  );
}

function confirmedPage(clientName: string): Response {
  return page(
    "You're unsubscribed",
    `<h1 style="margin:0 0 8px;font-size:22px;line-height:28px;color:#0B0B0B;">You're unsubscribed</h1>` +
      `<p style="margin:0;font-size:15px;line-height:23px;color:#4A4741;">You won't receive any more reports for ${clientName}. If this was a mistake, ask your account lead to add you back.</p>`,
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await context.params;
  const recipient = await resolveRecipient(token);
  if (!recipient) return unknownTokenPage();

  return page(
    "Unsubscribe?",
    `<h1 style="margin:0 0 8px;font-size:22px;line-height:28px;color:#0B0B0B;">Unsubscribe from ${recipient.client_name}'s reports?</h1>` +
      `<p style="margin:0 0 20px;font-size:15px;line-height:23px;color:#4A4741;">${recipient.email} will stop receiving these reports. This does not affect any other list you're on.</p>` +
      `<form method="POST" action="${env.NEXT_PUBLIC_APP_URL}/u/${encodeURIComponent(token)}">` +
      `<button type="submit" style="appearance:none;border:0;border-radius:999px;padding:12px 22px;font-size:14px;font-weight:600;background:#0B0B0B;color:#F7F6F4;cursor:pointer;">Confirm unsubscribe</button>` +
      `</form>`,
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  try {
    const { token } = await context.params;
    const recipient = await resolveRecipient(token);
    if (!recipient) return unknownTokenPage();

    await recordUnsubscribe(recipient);
    return confirmedPage(recipient.client_name);
  } catch (cause) {
    console.error("[u/token] unhandled", cause);
    // A recipient acting on a real email must never see a 500 — the outcome
    // may already be recorded even if this response construction failed.
    return page(
      "We couldn't confirm that",
      `<h1 style="margin:0 0 8px;font-size:22px;line-height:28px;color:#0B0B0B;">We couldn't confirm that</h1>` +
        `<p style="margin:0;font-size:15px;line-height:23px;color:#4A4741;">Something on our side failed. Try the link again in a moment.</p>`,
      200,
    );
  }
}
