import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Só `__tests__`: o pacote inteiro puxa better-auth e Prisma na carga, e o
    // que se testa aqui é o middleware, que é função pura de (request, resposta
    // do get-session).
    include: ["__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      include: ["proxy.ts"],
      // Piso no medido, truncado — mesmo padrão de catraca dos outros pacotes:
      // portão que vale hoje, não alvo aspiracional. Medição: statements 94.44,
      // branches 94.44, funcs 80, lines 100. O que fica de fora é o `callback`
      // que o app injeta, exercitado por `apps/app` e não por este pacote.
      thresholds: {
        statements: 94,
        branches: 94,
        functions: 80,
        lines: 100,
      },
    },
  },
});
