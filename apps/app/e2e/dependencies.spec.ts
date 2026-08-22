import { expect, test } from "@playwright/test";

/**
 * E2E — Dependencies
 *
 * Smoke test for /dependencies (dependency map/graph).
 */
test.describe("Dependencies @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("renders header and dependency map", async ({ page }) => {
    await page.goto("/cosmos/dependencies");
    await expect(page.locator("h1")).toContainText(/Depend/i, {
      timeout: 15_000,
    });
  });
});
