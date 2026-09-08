import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      // Cobre o que tem lógica. Fora: keys.ts é fiação do t3-env, proxy.ts é
      // middleware do Arcjet (exercitado em runtime, não em unidade) e
      // index.ts é barril de reexport.
      include: ["encrypt.ts", "secure-action.ts"],
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
      "server-only": path.resolve(__dirname, "./__tests__/server-only.ts"),
    },
  },
});
