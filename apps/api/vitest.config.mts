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
