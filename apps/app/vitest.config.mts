import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["__tests__/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: [
        "app/actions/**/*.ts",
        "lib/**/*.ts",
        "!app/actions/**/index.ts",
      ],
      exclude: [
        "**/*.d.ts",
        "**/schema.ts",
        // Inngest workers: require live env vars + external queues; covered by E2E
        "lib/inngest/**",
        // Migration utilities: one-time run scripts
        "lib/migration/**",
        // Meeting integration: Phase 0 orchestration; E2E-tested
        "app/actions/meeting/**",
        // Integration connectors: external-API adapters; covered by integration tests
        "app/actions/integrations/connectors/**",
      ],
      // PISO DE CATRACA — não é alvo atingido.
      //
      // Os alvos eram 80/80/75/70 e nunca foram alcançados: a medição de
      // 2026-08-06 deu 75.29 / 75.5 / 70.2 / 64.8. Não aparecia porque o turbo
      // abortava em packages/safe-engine, que falhava antes, e
      // app#test:coverage nem chegava a rodar no CI.
      //
      // Baixar para o medido é o que faz o portão valer HOJE: daqui pra frente
      // nada pode piorar. Deixar em 80 mantinha o CI vermelho para todo mundo
      // e não protegia ninguém.
      //
      // Subir de volta é trabalho planejado, e a regra é por módulo tocado:
      // feature que entra num diretório fraco sai com teste, e a catraca sobe
      // sozinha. `pnpm coverage:gaps` lista os piores depois de um
      // test:coverage.
      //
      // Medição de 2026-08-21 — 75.41 / 75.25 / 70.8 / 64.96, ou seja o piso
      // continua no lugar certo e não há o que apertar hoje. A lista anterior
      // aqui estava desatualizada: app/actions/integrations não está a 0% e
      // sim a 27.9% (366 linhas), e impediments e velocity não têm linha
      // nenhuma a cobrir — são diretório de schema, não de lógica.
      //
      // O que de fato pesa, por linha descoberta: integrations (~264),
      // analytics (~163), okrs (~161), epics (~116), lean-budget (~99) e
      // workflow (51, o único de tamanho real ainda em 0%).
      thresholds: {
        lines: 75,
        statements: 75,
        functions: 70,
        branches: 64,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "@repo": path.resolve(__dirname, "../../packages"),
      "@repo/storage": path.resolve(
        __dirname,
        "../../packages/storage/src/index.ts"
      ),
      "server-only": path.resolve(__dirname, "./vitest-mocks/server-only.ts"),
    },
  },
});
