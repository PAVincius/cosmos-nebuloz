import { expect, test } from "@playwright/test";

test.describe("Persona Home — /dashboard", () => {
  test.use({ storageState: "e2e/fixtures/auth-session.json" });

  test("home page renders bento grid without error", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("h1")).not.toHaveText("500");
    await expect(page.locator("h1")).not.toHaveText("Error");
    await expect(
      page.getByRole("link", { name: "Trocar persona" })
    ).toBeVisible();
  });

  test("page title is correct", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveTitle(/Home \| COSMOS/);
  });

  test("persona selector dialog not shown on authenticated repeat visit", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    const dialog = page.getByRole("dialog");
    await expect(dialog).not.toBeVisible();
  });

  test("bento grid does not overflow horizontally at 1280px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard");
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10);
  });

  test("page header greeting is present", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Bom dia")).toBeVisible();
  });
});
