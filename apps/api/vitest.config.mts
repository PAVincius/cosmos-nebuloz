import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["__tests__/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["app/**/*.ts", "app/**/*.tsx", "lib/**/*.ts"],
      exclude: [
        "**/*.d.ts",
        "**/schema.ts",
        "node_modules/**",
        // Scaffolding do Next, sem lógica de negócio: o layout raiz só aninha
        // providers e o global-error renderiza a página de erro chamando
        // captureException. Testá-los mediria o framework, não o que
        // escrevemos — e as rotas de verdade (health, webhooks de auth e
        // pagamento, cron) já estão em 100%.
        "app/layout.tsx",
        "app/global-error.tsx",
      ],
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
      "@": path.resolve(__dirname, "./"),
      "@repo": path.resolve(__dirname, "../../packages"),
    },
  },
});
