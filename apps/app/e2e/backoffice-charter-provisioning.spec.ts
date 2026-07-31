import { expect, test } from "@playwright/test";
import { ensureStaffUser } from "../../backoffice/e2e/fixtures/staff";

const BACKOFFICE = process.env.BACKOFFICE_URL ?? "http://localhost:3013";

test.describe("provisionar cliente e preparar o Charter", () => {
  test.beforeAll(async () => {
    // requirePlatformStaff (apps/backoffice/lib/guard.ts) nega quem não é
    // membro do tenant `system` — sem isso toda página do back-office barra
    // antes mesmo do formulário carregar.
    await ensureStaffUser();
  });

  test("do provisionamento até a política existir", async ({ page }) => {
    const suffix = Date.now();
    const clientName = `E2E Cliente ${suffix}`;

    await page.goto(`${BACKOFFICE}/clientes/novo`);

    await page.getByLabel("Nome da organização").fill(clientName);
    await page
      .getByLabel("E-mail do responsável")
      .fill(`dono-${suffix}@e2e.exemplo`);
    await page.getByRole("checkbox", { name: "CHARTER" }).check();
    await page.getByRole("button", { name: "Provisionar cliente" }).click();

    // dono-{suffix}@e2e.exemplo não tem conta prévia, então o formulário não
    // redireciona (form.tsx só navega quando ownerLinked é true) — mostra o
    // aviso de cliente sem dono e é o link dele que leva ao detalhe.
    await expect(page.getByText("Cliente criado sem dono")).toBeVisible();
    await page.getByRole("link", { name: /^Abrir /i }).click();

    await expect(page.getByRole("heading", { name: clientName })).toBeVisible();

    // Módulo contratado aparece como sim.
    await expect(page.getByText("Módulo contratado: sim")).toBeVisible();

    // O bloco de bootstrap aparece porque falta papel e política.
    await expect(page.getByText("Preparar o Charter")).toBeVisible();
  });

  test("a lista não mostra o tenant interno", async ({ page }) => {
    await page.goto(BACKOFFICE);

    await expect(page.getByRole("heading", { name: "Clientes" })).toBeVisible();
    await expect(page.getByText("__system__")).toHaveCount(0);
  });
});
