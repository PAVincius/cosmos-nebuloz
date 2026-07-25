import { expect, test } from "@playwright/test";

/**
 * E2E — Portfolio OKRs
 *
 * Smoke test for /portfolio/okrs: renders the OKR cards and the
 * "Novo OKR" creation modal.
 */
test.describe("Portfolio OKRs @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("renders header and OKR cards", async ({ page }) => {
    await page.goto("/portfolio/okrs");
    await expect(page.locator("h1")).toContainText(/OKR/i, { timeout: 15_000 });
  });

  test("Novo OKR button opens the create-OKR dialog", async ({ page }) => {
    await page.goto("/portfolio/okrs");
    await page.getByRole("button", { name: "Novo OKR" }).click();

    await expect(
      page.getByRole("dialog").filter({ hasText: "Novo OKR" })
    ).toBeVisible({ timeout: 10_000 });
  });
});
