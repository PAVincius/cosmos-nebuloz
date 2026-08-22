import { expect, test } from "@playwright/test";

/**
 * E2E — Solution Trains
 *
 * Smoke test for /solution-trains.
 */
test.describe("Solution Trains @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("renders header and solution train list", async ({ page }) => {
    await page.goto("/cosmos/solution");
    // A tela chama-se "Large Solution" no registry (id `solution`); "Solution
    // Trains" era o nome antigo.
    await expect(page.locator("h1")).toContainText(/Large Solution/i, {
      timeout: 15_000,
    });
  });
});
