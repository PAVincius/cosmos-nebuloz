import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // O pacote real lança em qualquer import fora do bundler do Next (que
      // troca "server-only" por um módulo vazio em build de servidor). Sob
      // vitest não há esse bundler, então precisa do mesmo stub que
      // apps/app/vitest-mocks/server-only.ts já usa.
      "server-only": path.resolve(__dirname, "./vitest-mocks/server-only.ts"),
    },
  },
});
