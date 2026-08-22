import { expect, test } from "@playwright/test";

/**
 * E2E — Roadmap
 *
 * Smoke test for /portfolio/roadmap. This page has no <h1> (no PageHeader
 * usage), so the render check uses the document title instead.
 */
test.describe("Portfolio Roadmap @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("renders the roadmap timeline", async ({ page }) => {
    await page.goto("/cosmos/roadmap");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveTitle(/Roadmap/i);
  });
});
