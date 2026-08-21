import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      include: ["index.ts"],
      // Piso no medido, mesmo padrão de catraca dos outros pacotes: portão que
      // vale hoje vale mais que alvo que ninguém alcança e alguém desliga.
      thresholds: {
        lines: 90,
        functions: 100,
        branches: 85,
        statements: 90,
      },
    },
  },
  resolve: {
    alias: {
      // O pacote abre com `import "server-only"`, que lança fora do bundler do
      // Next. Mesmo stub que `apps/backoffice` e `apps/app` já usam.
      "server-only": path.resolve(__dirname, "./__tests__/server-only.ts"),
    },
  },
});
