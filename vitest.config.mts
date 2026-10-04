import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/lib/engine/**"],
      // PLAN.md 15.5: at least 90% coverage of the engine
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
});
