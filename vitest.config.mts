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
  },
});
