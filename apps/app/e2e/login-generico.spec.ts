import { expect, test } from "@playwright/test";

/**
 * E2E — Login genérico (spec 004, US1, FR-001)
 *
 * A tela de login em app.nebuloz.ai não pode exibir wordmark, headline ou
 * ilustração de nenhum produto específico da suíte (hoje sempre era Cosmos) —
 * só identidade Nebuloz, para qualquer tenant.
 */
test.describe("Login genérico — sem marca de produto específico", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sign-in");
  });

  test("não exibe o wordmark 'Cosmos'", async ({ page }) => {
    await expect(page.getByText("Cosmos", { exact: true })).toHaveCount(0);
  });

  test("não exibe a headline de cadência de PI do Cosmos", async ({ page }) => {
    await expect(page.getByText(/Cinco iterações/i)).toHaveCount(0);
    await expect(page.getByText(/Nenhuma decisão perdida/i)).toHaveCount(0);
  });

  test("exibe identidade Nebuloz", async ({ page }) => {
    await expect(
      page.getByText("Nebuloz", { exact: true }).first()
    ).toBeVisible();
  });
});
