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
      exclude: ["**/*.d.ts", "**/schema.ts"],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "@repo": path.resolve(__dirname, "../../packages"),
      "server-only": path.resolve(__dirname, "./vitest-mocks/server-only.ts"),
      // sonner is a root-level pnpm dep, not hoisted into apps/app — alias it explicitly
      "sonner": path.resolve(__dirname, "../../node_modules/.pnpm/sonner@2.0.7_react-dom@19.2.1_react@19.2.1__react@19.2.1/node_modules/sonner"),
    },
  },
});
