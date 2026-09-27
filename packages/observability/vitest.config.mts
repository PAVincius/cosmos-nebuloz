import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      // Só o scrubber tem lógica testável em unidade; server/client/edge.ts
      // são fiação de Sentry.init (exercitados em runtime, não em unidade).
      include: ["scrub.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
