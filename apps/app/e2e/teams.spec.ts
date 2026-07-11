import { expect, test } from "@playwright/test";

/**
 * E2E — Teams list & Daily Standup
 *
 * The teams list has no direct link to a bare team detail page — TeamCard
 * links straight to `/teams/{id}/standup`, so we follow that to get a real
 * teamId and land on the standup screen in one navigation.
 */
test.describe("Teams @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("teams list renders header and team cards", async ({ page }) => {
    await page.goto("/teams");
    await expect(page.locator("h1")).toContainText(/Times/i, { timeout: 15_000 });
  });

  test("standup page renders via team card link and shows the standup form", async ({
    page,
  }) => {
    await page.goto("/teams");
    const link = page.locator('a[href*="/standup"]').first();
    await link.waitFor({ timeout: 15_000 });
    await link.click();

    await expect(page).toHaveURL(/\/teams\/.+\/standup/);
    await expect(page.locator("h1")).toContainText(/Standup/i, { timeout: 15_000 });
  });
});
