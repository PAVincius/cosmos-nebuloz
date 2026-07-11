import { expect, test } from "@playwright/test";

/**
 * E2E — Lean Budget & Anomalies
 *
 * Smoke tests for /portfolio/budgets and /portfolio/budgets/anomalies.
 * Does NOT click "Escalar"/"Ignorar 7d" on anomaly rows — those trigger
 * real server actions that mutate seeded data.
 */
test.describe("Portfolio Budgets @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("budgets dashboard renders header and KPI sections", async ({ page }) => {
    await page.goto("/portfolio/budgets");
    await expect(page.locator("h1")).toContainText(/Lean Budget/i, {
      timeout: 15_000,
    });
  });

  test("anomalies list renders header and rows", async ({ page }) => {
    await page.goto("/portfolio/budgets/anomalies");
    await expect(page.locator("h1")).toContainText(/Anomalias/i, {
      timeout: 15_000,
    });
  });
});
