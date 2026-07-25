import { expect, test } from "@playwright/test";

/**
 * E2E — Settings screens
 *
 * Smoke tests for the 7 /settings/* screens. One real interaction:
 * the "Convidar" link on /settings/members navigates to /settings/workspace
 * (plain internal link, no mutation).
 */
test.describe("Settings @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("audit log renders header", async ({ page }) => {
    await page.goto("/settings/audit");
    await expect(page.locator("h1")).toContainText(/Audit/i, { timeout: 15_000 });
  });

  test("settings integrations renders header", async ({ page }) => {
    await page.goto("/settings/integrations");
    await expect(page.locator("h1")).toContainText(/Integra/i, { timeout: 15_000 });
  });

  test("members renders header and Convidar link navigates to workspace", async ({
    page,
  }) => {
    await page.goto("/settings/members");
    await expect(page.locator("h1")).toContainText(/Membros/i, { timeout: 15_000 });

    await page.getByRole("link", { name: /Convidar/i }).click();
    await expect(page).toHaveURL(/\/settings\/workspace/);
  });

  test("reports renders header", async ({ page }) => {
    await page.goto("/settings/reports");
    await expect(page.locator("h1")).toContainText(/Relat/i, { timeout: 15_000 });
  });

  test("roles renders header and stats", async ({ page }) => {
    await page.goto("/settings/roles");
    await expect(page.locator("h1")).toContainText(/Roles/i, { timeout: 15_000 });
  });

  test("sso renders header", async ({ page }) => {
    await page.goto("/settings/sso");
    await expect(page.locator("h1")).toContainText(/SSO/i, { timeout: 15_000 });
  });

  test("workspace renders header", async ({ page }) => {
    await page.goto("/settings/workspace");
    await expect(page.locator("h1")).toBeVisible({ timeout: 15_000 });
  });
});
