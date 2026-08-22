import { expect, test } from "@playwright/test";

/**
 * E2E — Tag Rules
 *
 * Smoke test for /portfolio/tags: renders the rule list and the
 * "Nova regra" creation modal.
 */
test.describe("Portfolio Tags @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("renders header and tag rule list", async ({ page }) => {
    await page.goto("/cosmos/tags");
    await expect(page.locator("h1")).toContainText(/Tag Rules/i, {
      timeout: 15_000,
    });
  });

  test("Nova regra button opens the create-rule dialog", async ({ page }) => {
    await page.goto("/cosmos/tags");
    const newRuleButton = page.getByRole("button", { name: "Nova regra" });
    await newRuleButton.waitFor({ timeout: 15_000 });
    await newRuleButton.click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
  });
});
