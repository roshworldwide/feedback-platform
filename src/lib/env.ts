import { z } from "zod";

/**
 * Fail at boot, not at 2am.
 *
 * The service-role key is validated lazily and only on the server, so a
 * client bundle can never reference it — importing it in a client component
 * is a build-time error rather than a runtime key leak.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY missing"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, "SUPABASE_SERVICE_ROLE_KEY missing"),
  RESEND_API_KEY: z.string().optional(),
  /** Gmail/Workspace SMTP fallback — used when RESEND_API_KEY isn't set. See email/send.ts. */
  GMAIL_USER: z.string().optional(),
  GMAIL_APP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default("Convin Data Labs <convinlabs@convin.ai>"),
  INTERNAL_EMAIL_DOMAINS: z.string().default("convin.ai"),
  CRON_SECRET: z.string().optional(),
  /** The Svix signing secret Resend shows when a webhook endpoint is registered. */
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
});

function parsePublic() {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid public environment:\n${parsed.error.issues
        .map((i) => `  · ${i.path.join(".")}: ${i.message}`)
        .join("\n")}`,
    );
  }
  return parsed.data;
}

export const env = parsePublic();

let serverEnvCache: z.infer<typeof serverSchema> | null = null;

export function serverEnv() {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() called in the browser — this would leak the service role key");
  }
  if (serverEnvCache) return serverEnvCache;

  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    GMAIL_USER: process.env.GMAIL_USER,
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
    EMAIL_FROM: process.env.EMAIL_FROM,
    INTERNAL_EMAIL_DOMAINS: process.env.INTERNAL_EMAIL_DOMAINS,
    CRON_SECRET: process.env.CRON_SECRET,
    RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid server environment:\n${parsed.error.issues
        .map((i) => `  · ${i.path.join(".")}: ${i.message}`)
        .join("\n")}`,
    );
  }
  serverEnvCache = parsed.data;
  return serverEnvCache;
}

export function internalDomains() {
  return serverEnv()
    .INTERNAL_EMAIL_DOMAINS.split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}
