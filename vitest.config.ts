import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // Unit tests exercise pure TS logic — bypass the Tailwind v4 PostCSS pipeline.
  css: { postcss: { plugins: [] } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // `server-only` throws outside a React Server Component bundle; stub it so
      // server-only lib modules can be unit-tested in plain Node.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
      "@": path.resolve(__dirname),
    },
  },
});
