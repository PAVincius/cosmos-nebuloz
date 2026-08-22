import { expect, test } from "@playwright/test";

/**
 * E2E — Analytics dashboards (Flow, Velocity, Measure & Grow)
 *
 * These are read-only chart dashboards — smoke test is render-only.
 */
test.describe("Analytics Dashboards @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("Flow Metrics renders header", async ({ page }) => {
    await page.goto("/cosmos/flow");
    await expect(page.locator("h1")).toContainText(/Flow Metrics/i, {
      timeout: 15_000,
    });
  });

  test("Velocity renders header", async ({ page }) => {
    await page.goto("/cosmos/velocity");
    await expect(page.locator("h1")).toContainText(/Velocity/i, {
      timeout: 15_000,
    });
  });

  test("Measure & Grow renders header", async ({ page }) => {
    await page.goto("/cosmos/measure");
    await expect(page.locator("h1")).toContainText(/Measure/i, {
      timeout: 15_000,
    });
  });
});
