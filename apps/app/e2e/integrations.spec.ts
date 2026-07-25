import { expect, test } from "@playwright/test";

/**
 * E2E — Integrations Hub
 *
 * Smoke test for /integrations.
 */
test.describe("Integrations @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("renders header and integration cards", async ({ page }) => {
    await page.goto("/integrations");
    await expect(page.locator("h1")).toContainText(/Integra/i, { timeout: 15_000 });
  });
});
