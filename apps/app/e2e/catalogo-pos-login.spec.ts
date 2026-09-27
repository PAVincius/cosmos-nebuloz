import { expect, test } from "@playwright/test";
import { catalogoStorageState } from "./setup/auth.setup";

/**
 * E2E — Catálogo de produtos pós-login (spec 004, US2)
 *
 * Cenário 2 do quickstart (tenant interno → catálogo, Meridian clicável,
 * demais "em breve"). Sessão semeada por `scripts/seed-catalogo-e2e.ts`
 * (tenant dedicado `nebuloz-e2e-interno`, não o workspace real do CEO).
 */
test.describe("Catálogo pós-login — tenant interno", () => {
  test.use({ storageState: catalogoStorageState("interna") });

  test("aterrissa no catálogo, com Meridian clicável e os demais 'em breve'", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/produto/);
    await expect(page.getByText("Meridian")).toBeVisible();
    await expect(page.getByText("Em breve").first()).toBeVisible();

    await page.getByText("Meridian").click();
    await expect(page).toHaveURL(/\/meridian/);
  });
});

/**
 * Cenário 3 do quickstart — SC-003: tenant sem a flag segue com o
 * comportamento de sempre, sem ver o catálogo. Usa a sessão admin padrão do
 * e2e (tenant `cosmos-dev`, sem `isInternalTenant`).
 */
test.describe("Catálogo pós-login — tenant sem a flag (comportamento inalterado)", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("vai direto pro produto contratado, sem ver o catálogo", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/produto$/);
    await expect(page).toHaveURL(/cosmos|dashboard/);
  });
});
