import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/__tests__/**/*.test.ts"],
    // Compilar roda o auto-layout e o bpmnlint; o teste do bpmn-js monta um
    // canvas no jsdom. Nada disso é lento, mas o padrão de 5 s é apertado para
    // a primeira importação a frio numa máquina de CI.
    testTimeout: 20_000,
  },
});
