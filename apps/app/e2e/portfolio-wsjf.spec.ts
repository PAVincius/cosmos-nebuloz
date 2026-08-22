import { expect, test } from "@playwright/test";

/**
 * E2E — Portfolio WSJF
 *
 * Smoke test for /portfolio/wsjf: renders the priority table and the
 * Rebalance dialog (client-side only, never persists — safe to open).
 */
test.describe("Portfolio WSJF @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("renders header and priority table", async ({ page }) => {
    await page.goto("/cosmos/wsjf");
    await expect(page.locator("h1")).toContainText(/WSJF/i, {
      timeout: 15_000,
    });
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("Rebalance button opens the weights dialog", async ({ page }) => {
    await page.goto("/cosmos/wsjf");
    await page.getByRole("button", { name: "Rebalance", exact: true }).click();

    await expect(
      page.getByRole("dialog").filter({ hasText: "Rebalancear WSJF" })
    ).toBeVisible({ timeout: 10_000 });
  });
});
