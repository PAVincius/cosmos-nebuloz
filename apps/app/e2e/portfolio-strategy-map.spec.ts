import { expect, test } from "@playwright/test";

/**
 * E2E — Strategy Map
 *
 * Smoke test for /portfolio/strategy-map: renders the theme tree and the
 * "Épico" relation-chip button that opens the add-epic-to-theme modal.
 */
test.describe("Strategy Map @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("renders header and theme tree", async ({ page }) => {
    await page.goto("/portfolio/strategy-map");
    await expect(page.locator("h1")).toContainText(/Strategy Map/i, {
      timeout: 15_000,
    });
  });

  test("Épico chip opens the add-epic-to-theme modal", async ({ page }) => {
    await page.goto("/portfolio/strategy-map");

    const addEpicButton = page.getByTitle("Adicionar épico ao tema").first();
    await addEpicButton.waitFor({ timeout: 15_000 });
    await addEpicButton.click();

    await expect(
      page.getByRole("dialog").filter({ hasText: "Adicionar Épicos" })
    ).toBeVisible({ timeout: 10_000 });
  });
});
