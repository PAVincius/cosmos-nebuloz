import { expect, test } from "@playwright/test";

/**
 * E2E — Risks (ROAM board)
 *
 * Smoke test for /risks: renders the 5 ROAM columns and the
 * "Registrar risco" creation modal (not submitted — would persist a risk).
 */
test.describe("Risks @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  const ROAM_COLUMNS = ["Identificado", "Atribuído", "Aceito", "Mitigado", "Resolvido"];

  test("renders header and all 5 ROAM columns", async ({ page }) => {
    await page.goto("/risks");
    await expect(page.locator("h1")).toContainText(/Riscos/i, { timeout: 15_000 });

    for (const col of ROAM_COLUMNS) {
      await expect(page.getByText(col, { exact: false }).first()).toBeVisible();
    }
  });

  test("Registrar risco button opens the create-risk dialog", async ({ page }) => {
    await page.goto("/risks");
    await page.getByRole("button", { name: "Registrar risco" }).click();

    await expect(
      page.getByRole("dialog").filter({ hasText: "Registrar Risco" })
    ).toBeVisible({ timeout: 10_000 });
  });
});
