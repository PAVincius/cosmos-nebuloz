import { expect, test } from "@playwright/test";

/**
 * E2E — Copilot
 *
 * Smoke test for /copilot.
 */
test.describe("Copilot @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("renders the Copilot chat surface", async ({ page }) => {
    await page.goto("/cosmos/copilot");
    await expect(page.locator("h1")).toContainText(/Copilot/i, {
      timeout: 15_000,
    });
  });
});
