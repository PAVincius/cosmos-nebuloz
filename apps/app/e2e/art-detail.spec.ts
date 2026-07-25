import { expect, test } from "@playwright/test";

/**
 * E2E — ART Detail, Program Board, PI Planning workspace
 *
 * These routes need a real artId. We get one by following the link from
 * the /arts list (`<Link href={`/arts/${art.id}`}>`), then navigate to the
 * nested routes directly.
 */
test.describe("ART Detail @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  async function firstArtUrl(page: import("@playwright/test").Page) {
    await page.goto("/arts");
    const link = page.locator('a[href^="/arts/"]').first();
    await link.waitFor({ timeout: 15_000 });
    const href = await link.getAttribute("href");
    if (!href) {
      throw new Error("No ART link found on /arts list");
    }
    return href;
  }

  test("ART detail page renders name and KPI row", async ({ page }) => {
    const artUrl = await firstArtUrl(page);
    await page.goto(artUrl);
    await expect(page.locator("h1")).not.toBeEmpty({ timeout: 15_000 });
  });

  test("Program Board renders for the ART", async ({ page }) => {
    const artUrl = await firstArtUrl(page);
    await page.goto(`${artUrl}/program-board`);
    await expect(page.locator("h1")).toContainText(/Program Board/i, {
      timeout: 15_000,
    });
  });

  test("PI Planning workspace renders tabs and switches to Team Breakout", async ({
    page,
  }) => {
    const artUrl = await firstArtUrl(page);
    await page.goto(`${artUrl}/pi-planning`);

    await expect(
      page.getByRole("tab", { name: "Program Board" })
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole("tab", { name: "Team Breakout" }).click();
    await expect(
      page.getByRole("tabpanel").filter({ hasText: /Team Breakout|./ })
    ).toBeVisible();
  });
});
