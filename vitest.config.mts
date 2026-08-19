import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Without this, Vitest resolves imports with plain Node/Vite defaults and
 * has no idea `@/*` means `src/*` — every test happened to avoid that path
 * so far by importing its subject with a relative specifier, which is what
 * let this go unnoticed. `src/components/compose/vocabulary.test.ts` is the
 * first test whose subject itself imports another module via `@/`, and it
 * failed to resolve until this file existed. Kept in sync with the `@/*`
 * mapping in tsconfig.json by hand, since there's no path-alias plugin here.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    /**
     * `src/lib/env.ts` throws at import time if the public Supabase vars are
     * missing — correct for the app (fail at boot, not at 2am), but it means
     * any test that transitively imports `@/lib/ai` (which imports `env.ts`)
     * fails before it can run at all, since `.env.local` deliberately isn't
     * loaded into this process. These are placeholders satisfying shape
     * validation only, never a real connection. ANTHROPIC_API_KEY is
     * deliberately left unset, so `aiAvailable()` still reports false here —
     * the "no AI key" path is exactly what several tests need to exercise.
     */
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder-anon-key-for-vitest-only",
      SUPABASE_SERVICE_ROLE_KEY: "placeholder-service-role-key-for-vitest-only",
    },
  },
});
