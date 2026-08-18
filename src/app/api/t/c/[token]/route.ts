import { env } from "@/lib/env";
import { safeUrl } from "@/lib/email/markdown";
import { recordClick, resolveRecipient } from "@/lib/email/tracking";

/**
 * The click redirect.
 *
 * It records a `click` and NOTHING ELSE. It does not write an open row — the
 * `recipient_engagement` view already derives "opened" as EXISTS(open OR
 * click), so a synthetic open here would count every clicker twice. That is
 * precisely the defect this rebuild exists to remove; the comment stays so the
 * next person to read this file knows the omission is deliberate.
 *
 * The destination is validated before the redirect. A campaign whose
 * `report_url` is empty, relative, or a `javascript:` URI never becomes an open
 * redirect — the reader gets a plain, calm page instead.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private, max-age=0",
} as const;

/**
 * A bare HTML response, returned when a click link cannot be honoured.
 *
 * This is served outside React and outside the stylesheet, so the token layer
 * does not exist here and the Titanium values have to be written literally —
 * the one other place in the app where that is correct. It stays deliberately
 * plain: whoever sees it clicked a link in an email and is owed a sentence, not
 * an application shell.
 */
function notice(title: string, detail: string, status = 200): Response {
  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${title}</title></head>` +
    `<body style="margin:0;background:#EFEDEA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">` +
    `<div style="max-width:520px;margin:12vh auto;padding:32px;background:#F7F6F4;border:1px solid #E3E0DB;border-radius:20px;">` +
    `<h1 style="margin:0 0 8px;font-size:22px;line-height:28px;color:#0B0B0B;">${title}</h1>` +
    `<p style="margin:0;font-size:15px;line-height:23px;color:#4A4741;">${detail}</p>` +
    `</div></body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", ...NO_STORE },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  try {
    const { token } = await context.params;
    const recipient = await resolveRecipient(token);

    if (!recipient) {
      return notice(
        "This link has expired",
        "The report it pointed to is no longer being tracked. Ask your account lead for a fresh copy — nothing is wrong with your email.",
      );
    }

    // Record first, redirect second: a slow redirect is better than a lost fact.
    await recordClick(recipient, request.headers);

    const destination = safeUrl(recipient.report_url);
    if (!destination) {
      return notice(
        "No report is linked to this message yet",
        "We recorded that you tried to open it. Your account lead has been able to see this, and will send the link shortly.",
      );
    }

    return new Response(null, {
      status: 302,
      headers: { Location: destination, ...NO_STORE },
    });
  } catch (cause) {
    console.error("[api/t/c] unhandled", cause);
    // Never a 500 to a recipient. Fall back to a page that explains itself.
    return notice(
      "We could not open that link",
      `Something on our side failed, not on yours. Try again in a moment, or open ${env.NEXT_PUBLIC_APP_URL} directly.`,
      200,
    );
  }
}
