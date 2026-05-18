import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

/**
 * Cosmos Enterprise — Playwright E2E Configuration
 *
 * Runs against the Next.js dev server (localhost:3000).
 * For Docker/CI: set PLAYWRIGHT_BASE_URL env var.
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: path.resolve(__dirname, "e2e/setup/auth.setup.ts"),
  /* Run tests in parallel within a file */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Workers: 1 in CI to avoid flakiness */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter */
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  /* Global test settings */
  use: {
    baseURL: BASE_URL,
    /* Collect traces on failure for debugging */
    trace: "on-first-retry",
    /* Screenshots on failure */
    screenshot: "only-on-failure",
    /* Video on retry */
    video: "on-first-retry",
    /* Reasonable navigation timeout */
    navigationTimeout: 30_000,
    actionTimeout: 10_000,
  },
  /* Test projects — Chromium only for speed */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /\.setup\.ts$/,
    },
  ],
  /* Start Next.js dev server locally (skip if PLAYWRIGHT_BASE_URL is set externally) */
  ...(process.env.PLAYWRIGHT_BASE_URL
    ? {}
    : {
        webServer: {
          command: "pnpm dev",
          url: BASE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: {
            NODE_ENV: "development",
          },
        },
      }),
  /* Output directories */
  outputDir: "test-results",
});
