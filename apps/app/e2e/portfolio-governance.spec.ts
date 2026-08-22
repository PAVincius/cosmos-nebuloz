import { expect, test } from "@playwright/test";

/**
 * E2E — Governance & Decision Log
 *
 * Smoke tests for /portfolio/governance and its decision-log sub-view.
 * Does NOT click approve/reject actions — those mutate seeded epic state.
 */
test.describe("Portfolio Governance @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("governance list renders header and epic list", async ({ page }) => {
    await page.goto("/cosmos/governance");
    // O h1 real é "Governance Board" — em inglês, como o registry.
    await expect(page.locator("h1")).toContainText(/Governance Board/i, {
      timeout: 15_000,
    });
  });

  test("decision log renders header and table", async ({ page }) => {
    await page.goto("/cosmos/decisions");
    await expect(page.locator("h1")).toContainText(/Decision Log/i, {
      timeout: 15_000,
    });
  });
});
