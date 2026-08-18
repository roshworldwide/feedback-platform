import { getSessionProfile } from "@/lib/supabase/server";
import { aiAvailable, checkAiRateLimit, numbersPreserved, streamCompletion } from "@/lib/ai";

/**
 * The Compose "AI Check" action.
 *
 * Polishes tone, spacing and structure for a client-facing insights report.
 * The numbers-preserved guard is enforced here, in code, after the full
 * response is collected — a model instruction not to invent a figure is a
 * request, not a guarantee, so the response is rejected server-side if any
 * number in the body changed rather than trusting the prompt.
 */

export const dynamic = "force-dynamic";

const SYSTEM =
  "You polish the body of a client-facing insights report for tone, spacing " +
  "and structure. Keep the meaning, the facts and every number exactly as " +
  "given — you must not add, remove or change any figure, date, percentage " +
  "or count. Keep Markdown formatting (headings, lists, bold) intact. Return " +
  "only the polished body text, with no preamble, no commentary, and no " +
  "code fence around it.";

const MAX_BODY_LENGTH = 20_000;

export async function POST(request: Request): Promise<Response> {
  const profile = await getSessionProfile();
  if (!profile) {
    return Response.json(
      { ok: false, message: "Your session is no longer active. Sign in again." },
      { status: 401 },
    );
  }

  if (!aiAvailable()) {
    return Response.json(
      { ok: false, message: "AI Check is off — no API key is configured." },
      { status: 503 },
    );
  }

  const rate = checkAiRateLimit(String(profile.id));
  if (!rate.ok) {
    return Response.json({ ok: false, message: rate.message }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const source = typeof body?.text === "string" ? body.text : "";
  if (source.trim() === "") {
    return Response.json(
      { ok: false, message: "There is no text to check yet." },
      { status: 400 },
    );
  }
  if (source.length > MAX_BODY_LENGTH) {
    return Response.json(
      { ok: false, message: `That text is too long to check (over ${MAX_BODY_LENGTH.toLocaleString()} characters).` },
      { status: 400 },
    );
  }

  const result = await streamCompletion({
    system: SYSTEM,
    prompt: source,
    maxTokens: 4096,
    signal: request.signal,
  });

  if (!result.ok) {
    return Response.json({ ok: false, message: result.message }, { status: 502 });
  }

  let revised = "";
  try {
    for await (const chunk of result.chunks) revised += chunk;
  } catch (cause) {
    console.error("[api/ai/polish] stream failed", cause);
    return Response.json(
      { ok: false, message: "The AI check was interrupted. Try again." },
      { status: 502 },
    );
  }

  revised = revised.trim();
  if (!numbersPreserved(source, revised)) {
    return Response.json(
      {
        ok: false,
        message:
          "The AI check changed a number in the text, so nothing was applied — this is a hard rule, not a judgment call. Try again, or edit the body yourself.",
      },
      { status: 422 },
    );
  }

  return Response.json({ ok: true, original: source, revised });
}
