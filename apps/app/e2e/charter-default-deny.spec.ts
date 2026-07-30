import { expect, test } from "@playwright/test";

/**
 * E2E — Charter default deny (FR-1 / DATA-MODEL §2.2).
 *
 * A tenant without a `TenantModule` row for CHARTER has no access at all —
 * default deny, not a toggle. `cosmos-dev` (the seeded Cosmos-only tenant)
 * never had `seed:charter` run against it, so its admin session is exactly
 * the "module not contracted" case the layout guard exists to catch.
 */
test.describe("Charter default deny @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("tenant without the CHARTER module is redirected to /charter-indisponivel", async ({
    page,
  }) => {
    await page.goto("/charter");
    await page.waitForURL(/\/charter-indisponivel/, { timeout: 15_000 });

    await expect(page).toHaveTitle(/Charter indisponível/);
    await expect(
      page.getByRole("heading", { name: "Charter não está contratado" })
    ).toBeVisible();
  });

  test("a deep Charter route redirects the same way, not just the dashboard", async ({
    page,
  }) => {
    await page.goto("/charter/cases");
    await page.waitForURL(/\/charter-indisponivel/, { timeout: 15_000 });

    await expect(
      page.getByRole("heading", { name: "Charter não está contratado" })
    ).toBeVisible();
  });
});
