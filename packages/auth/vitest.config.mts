import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["__tests__/**/*.test.ts"],
    // server.ts valida BETTER_AUTH_SECRET no corpo do módulo e lança se
    // faltar. Atribuir dentro do teste não resolve: o import de ../server é
    // içado acima de qualquer statement. Tem de existir antes de carregar.
    env: {
      BETTER_AUTH_SECRET: "test-secret-com-32-caracteres-ok!",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      // server.ts é o guard multi-tenant — requireTenantSession aparece 1245
      // vezes no código de aplicação. O resto do pacote é componente React e
      // fiação de env, coberto em outro nível.
      include: ["server.ts"],
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
