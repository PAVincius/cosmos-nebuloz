import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**", "src/index.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      // resolve.ts e modules.ts marcam server-only; fora do bundler do Next o
      // pacote não resolve. Mesmo stub que apps/app usa.
      "server-only": path.resolve(__dirname, "./src/__tests__/server-only.ts"),
    },
  },
});
