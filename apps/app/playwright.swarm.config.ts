/**
 * COSMOS UX Swarm — Playwright Configuration
 *
 * Runs persona tests in parallel (1 worker per persona).
 * Each persona writes to their own findings file.
 * After completion, the orchestrator aggregates and generates DCU report.
 *
 * Usage:
 *   pnpm swarm              # full swarm run
 *   pnpm swarm:report       # regenerate report from last run
 */

import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e/personas",

  // Run persona tests in parallel — each persona = 1 worker
  fullyParallel: true,
  workers: 5,

  forbidOnly: !!process.env.CI,
  retries: 0,

  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report/swarm", open: "never" }],
    // Custom JSON reporter for orchestrator
    ["json", { outputFile: "test-results/swarm-results.json" }],
  ],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    navigationTimeout: 20_000,
    actionTimeout: 8000,
  },

  projects: [
    {
      name: "lpm",
      use: { ...devices["Desktop Chrome"] },
      testMatch: "**/personas/lpm.spec.ts",
    },
    {
      name: "rte",
      use: { ...devices["Desktop Chrome"] },
      testMatch: "**/personas/rte.spec.ts",
    },
    {
      name: "po",
      use: { ...devices["Desktop Chrome"] },
      testMatch: "**/personas/po.spec.ts",
    },
    {
      name: "sm",
      use: { ...devices["Desktop Chrome"] },
      testMatch: "**/personas/sm.spec.ts",
    },
    {
      name: "devops",
      use: { ...devices["Desktop Chrome"] },
      testMatch: "**/personas/devops.spec.ts",
    },
  ],

  // Reuse existing dev server
  ...(process.env.PLAYWRIGHT_BASE_URL
    ? {}
    : {
        webServer: {
          command: "pnpm dev",
          url: BASE_URL,
          reuseExistingServer: true,
          timeout: 120_000,
          env: { NODE_ENV: "test" },
        },
      }),

  outputDir: "test-results/swarm",
  globalSetup: path.resolve(__dirname, "e2e/swarm/global-setup.ts"),
});
