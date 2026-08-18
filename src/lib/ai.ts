/**
 * The one place this product calls Anthropic.
 *
 * Every rule here is a direct fix for how v1's AI features failed: an expired
 * key printed a raw provider 401 into the page, and a missing key rendered a
 * button that did nothing useful when pressed. Neither can happen again —
 * `aiAvailable()` is checked before a feature renders at all, and a provider
 * error is always caught and turned into one plain sentence server-side.
 */

import Anthropic from "@anthropic-ai/sdk";
import { serverEnv } from "./env";

export { numbersOf, numbersPreserved } from "./ai-numbers-guard";

const MODEL = "claude-opus-5";
const REQUEST_TIMEOUT_MS = 30_000;

let cached: Anthropic | null = null;

function client(): Anthropic | null {
  const key = serverEnv().ANTHROPIC_API_KEY;
  if (!key) return null;
  if (!cached) cached = new Anthropic({ apiKey: key, timeout: REQUEST_TIMEOUT_MS });
  return cached;
}

/** Whether the feature should render at all — never a button that fails when pressed. */
export function aiAvailable(): boolean {
  return client() !== null;
}

/* ── Per-user rate limit ──────────────────────────────────────────────────
 * In-memory and per-process, which is honest for this app's scale (single
 * deployment). It resets on redeploy and does not share state across
 * instances — swap for a shared store before running more than one.
 */

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_CALLS = 5;
const callLog = new Map<string, number[]>();

export function checkAiRateLimit(userId: string): { ok: true } | { ok: false; message: string } {
  const now = Date.now();
  const recent = (callLog.get(userId) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_CALLS) {
    return {
      ok: false,
      message: "Too many AI requests in the last minute. Wait a moment and try again.",
    };
  }
  recent.push(now);
  callLog.set(userId, recent);
  return { ok: true };
}

/* ── The one call ─────────────────────────────────────────────────────────── */

export type AiStreamResult =
  | { ok: true; chunks: AsyncIterable<string> }
  | { ok: false; message: string };

function reasonOf(cause: unknown): string {
  console.error("[ai]", cause);
  if (cause instanceof Anthropic.RateLimitError) {
    return "The AI service is rate-limited right now. Wait a moment and try again.";
  }
  if (cause instanceof Anthropic.APIConnectionError) {
    return "Could not reach the AI service. Try again in a moment.";
  }
  // Never the provider's own message — v1 printed "Error code: 401 -
  // {'type': 'error', ...}" straight into the page.
  return "The AI service did not respond. Try again, or continue without it.";
}

async function* textDeltasOf(
  stream: AsyncIterable<Anthropic.MessageStreamEvent>,
): AsyncGenerator<string> {
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}

/**
 * Streams a completion. Low effort by default — these are short, mechanical
 * writing tasks (bullet summaries, prose polish), not deep reasoning, and
 * this is a per-click feature a person is waiting on.
 */
export async function streamCompletion(opts: {
  system: string;
  prompt: string;
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<AiStreamResult> {
  const anthropic = client();
  if (!anthropic) {
    return { ok: false, message: "AI features are off — no API key is configured." };
  }

  try {
    const stream = anthropic.messages.stream(
      {
        model: MODEL,
        max_tokens: opts.maxTokens ?? 1024,
        output_config: { effort: "low" },
        system: opts.system,
        messages: [{ role: "user", content: opts.prompt }],
      },
      { signal: opts.signal },
    );
    return { ok: true, chunks: textDeltasOf(stream) };
  } catch (cause) {
    return { ok: false, message: reasonOf(cause) };
  }
}

