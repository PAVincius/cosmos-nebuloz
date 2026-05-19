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
      exclude: ["**/*.d.ts", "**/schema.ts", "node_modules/**"],
      // API app is primarily webhook/cron route handlers — covered by E2E.
      // Unit threshold is a floor to prevent total regression, not a target.
      thresholds: {
        lines: 2,
        functions: 5,
        branches: 0,
        statements: 2,
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
