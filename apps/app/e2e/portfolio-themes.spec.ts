import { expect, test } from "@playwright/test";

/**
 * E2E — Portfolio Themes
 *
 * Smoke test for /portfolio/themes: renders the themes board and the
 * "Novo tema" creation modal.
 */
test.describe("Portfolio Themes @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("renders header and themes board", async ({ page }) => {
    await page.goto("/cosmos/themes");
    await expect(page.locator("h1")).toContainText(/Temas/i, {
      timeout: 15_000,
    });
  });

  test("Novo tema button opens the create-theme dialog", async ({ page }) => {
    await page.goto("/cosmos/themes");
    await page.getByRole("button", { name: "Novo tema" }).click();

    await expect(
      page.getByRole("dialog").filter({ hasText: "Novo tema estratégico" })
    ).toBeVisible({ timeout: 10_000 });
  });
});
