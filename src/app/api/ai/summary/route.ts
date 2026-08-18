import { getSessionProfile, createClient } from "@/lib/supabase/server";
import { aiAvailable, checkAiRateLimit, streamCompletion } from "@/lib/ai";

/**
 * The Overview "Generate summary" action.
 *
 * Reads structured ratings and comments for the period server-side — the
 * client never gets to choose what the model sees — and streams the reply
 * back as plain text. Cached per period so a re-click within the TTL is
 * free, exactly what the UI promises.
 */

export const dynamic = "force-dynamic";

const SYSTEM =
  "You summarize client feedback for an internal reporting team. You are " +
  "given a list of star ratings (1-5) and any written comments, each tagged " +
  "with the report it was given for. Write 3 to 5 short bullet points, plain " +
  "text, one dash per line: what clients praised, what they criticised, and " +
  "which report or theme most needs attention. Never invent a number, a " +
  "client name, or a quote that was not given to you. If the data is too " +
  "thin to say something specific, say so plainly instead of padding.";

type CacheEntry = { text: string; expiresAt: number };
const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map<string, CacheEntry>();

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function num(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function firstNameOf(fullName: string): string {
  const trimmed = fullName.trim();
  return trimmed === "" ? "A client contact" : trimmed.split(/\s+/)[0];
}

export async function POST(request: Request): Promise<Response> {
  const profile = await getSessionProfile();
  if (!profile) {
    return new Response("Your session is no longer active. Sign in again.", { status: 401 });
  }

  if (!aiAvailable()) {
    return new Response("AI summaries are off — no API key is configured.", { status: 503 });
  }

  const rate = checkAiRateLimit(String(profile.id));
  if (!rate.ok) {
    return new Response(rate.message, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const from = typeof body?.from === "string" ? body.from : null;
  const to = typeof body?.to === "string" ? body.to : null;
  const excludeInternal = body?.excludeInternal !== false;
  const excludeTests = body?.excludeTests !== false;
  if (!from || !to) {
    return new Response("Missing period.", { status: 400 });
  }

  const cacheKey = JSON.stringify({ from, to, excludeInternal, excludeTests });
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return new Response(cached.text, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-CDL-Cache": "hit" },
    });
  }

  const supabase = await createClient();
  let query = supabase
    .from("recipient_engagement")
    .select("full_name, rating, comment, report_number, title")
    .not("rating", "is", null)
    .gte("sent_at", from)
    .lt("sent_at", to)
    .order("rated_at", { ascending: false })
    .range(0, 199);
  if (excludeTests) query = query.eq("is_test", false);
  if (excludeInternal) query = query.eq("is_internal", false);

  const { data, error } = await query;
  if (error) {
    return new Response(`Couldn't read this period's feedback — ${error.message}.`, {
      status: 502,
    });
  }

  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  if (rows.length === 0) {
    const text = "No ratings or comments in this period yet.";
    return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const lines = rows.map((row) => {
    const reportNumber = str(row.report_number);
    const title = str(row.title);
    const label = reportNumber ? `${reportNumber} · ${title}` : title || "an unlabelled report";
    const comment = str(row.comment).trim();
    const who = firstNameOf(str(row.full_name));
    return comment
      ? `${who} rated "${label}" ${num(row.rating)}/5 and wrote: "${comment}"`
      : `${who} rated "${label}" ${num(row.rating)}/5, no comment.`;
  });

  const result = await streamCompletion({
    system: SYSTEM,
    prompt: `Ratings for this period:\n${lines.join("\n")}`,
    maxTokens: 512,
    signal: request.signal,
  });

  if (!result.ok) {
    return new Response(result.message, { status: 502 });
  }

  let full = "";
  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of result.chunks) {
          full += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
        cache.set(cacheKey, { text: full, expiresAt: Date.now() + CACHE_TTL_MS });
      } catch (cause) {
        console.error("[api/ai/summary] stream failed", cause);
        controller.enqueue(encoder.encode("\n\n[The summary was interrupted. Try again.]"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-CDL-Cache": "miss" },
  });
}
