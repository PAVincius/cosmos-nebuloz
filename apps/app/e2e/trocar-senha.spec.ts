import { expect, test } from "@playwright/test";
import { SEEDED_ROLE_PASSWORD } from "./setup/auth.setup";

/**
 * E2E — Trocar senha logado (spec 004, US3, FR-007/FR-008, cenário 4 do
 * quickstart).
 *
 * Usa o papel `dev` (sem gate de RBAC nenhum — a role que só existe pra
 * provar que um gate fecha, ver e2e/setup/auth.setup.ts) porque este spec
 * muda a senha de verdade; login/logout via UI em vez de storageState, já
 * que a sessão salva não reflete a senha nova. O teste de sucesso reverte a
 * senha pro valor original no fim, pra ficar idempotente entre corridas.
 */

const EMAIL = "dev@cosmos.local";
const PASSWORD = SEEDED_ROLE_PASSWORD;
const NEW_PASSWORD = `${SEEDED_ROLE_PASSWORD}-nova`;

async function login(
  page: import("@playwright/test").Page,
  email: string,
  password: string
) {
  await page.goto("/sign-in");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/dashboard|portfolio|produto|\/$/, {
    timeout: 30_000,
  });
}

async function trocarSenha(
  page: import("@playwright/test").Page,
  atual: string,
  nova: string
) {
  await page.goto("/settings/security");
  await page.getByLabel(/senha atual/i).fill(atual);
  await page.getByLabel(/^nova senha/i).fill(nova);
  await page.getByRole("button", { name: /salvar/i }).click();
}

test.describe("Trocar senha logado (US3, cenário 4) @auth", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("troca com sucesso e loga de novo com a nova senha", async ({
    page,
  }) => {
    await login(page, EMAIL, PASSWORD);
    await trocarSenha(page, PASSWORD, NEW_PASSWORD);
    await expect(page.getByText(/senha alterada/i)).toBeVisible({
      timeout: 15_000,
    });

    await page.context().clearCookies();
    await login(page, EMAIL, NEW_PASSWORD);
    await expect(page).not.toHaveURL(/sign-in/);

    // Cleanup: reverte pra senha original, senão a próxima corrida quebra.
    await trocarSenha(page, NEW_PASSWORD, PASSWORD);
    await expect(page.getByText(/senha alterada/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("senha atual errada é rejeitada, sem alterar nada", async ({ page }) => {
    await login(page, EMAIL, PASSWORD);
    await trocarSenha(page, "senha-errada-123", NEW_PASSWORD);

    await expect(page.locator("p.text-destructive")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/senha alterada/i)).not.toBeVisible();

    // Confirma que a senha original continua valendo.
    await page.context().clearCookies();
    await login(page, EMAIL, PASSWORD);
    await expect(page).not.toHaveURL(/sign-in/);
  });
});
