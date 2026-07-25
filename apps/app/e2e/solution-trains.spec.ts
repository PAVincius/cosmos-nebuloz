import { expect, test } from "@playwright/test";

/**
 * E2E — Solution Trains
 *
 * Smoke test for /solution-trains.
 */
test.describe("Solution Trains @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("renders header and solution train list", async ({ page }) => {
    await page.goto("/solution-trains");
    await expect(page.locator("h1")).toContainText(/Solution Trains/i, {
      timeout: 15_000,
    });
  });
});
