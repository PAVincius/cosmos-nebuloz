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
      thresholds: {
        lines: 80,
        statements: 80,
        // Connectors/workers excluded above; 77%+ achievable for unit-testable code
        functions: 75,
        // Branch coverage harder for action guards; 70%+ on unit-testable code
        branches: 70,
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
      // sonner is a root-level pnpm dep, not hoisted into apps/app — alias it explicitly
      sonner: path.resolve(
        __dirname,
        "../../node_modules/.pnpm/sonner@2.0.7_react-dom@19.2.1_react@19.2.1__react@19.2.1/node_modules/sonner"
      ),
    },
  },
});
