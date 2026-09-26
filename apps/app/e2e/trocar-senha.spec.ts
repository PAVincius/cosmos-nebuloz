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

  // Achado do Vigia (revisão de segurança da spec 004, ALTO): sem
  // `revokeOtherSessions: true`, uma sessão roubada sobrevive à troca de
  // senha — quem trocou pensa que se protegeu, mas o invasor continua
  // logado. Prova as duas pontas: a outra sessão cai, a atual sobrevive
  // (o better-auth recria só a atual com token novo e seta o cookie na
  // resposta — ver update-user.mjs do pacote instalado).
  test("troca de senha revoga outras sessões e mantém a atual", async ({
    browser,
  }) => {
    // A espera do cookieCache (até 60s) não cabe no timeout padrão de 30s.
    test.setTimeout(120_000);

    const sessaoAtual = await browser.newContext();
    const outraSessao = await browser.newContext();
    try {
      const paginaAtual = await sessaoAtual.newPage();
      const paginaOutra = await outraSessao.newPage();

      await login(paginaAtual, EMAIL, PASSWORD);
      await login(paginaOutra, EMAIL, PASSWORD);

      await trocarSenha(paginaAtual, PASSWORD, NEW_PASSWORD);
      await expect(paginaAtual.getByText(/senha alterada/i)).toBeVisible({
        timeout: 15_000,
      });

      // Outra sessão: derrubada — mas não instantâneo. `cookieCache` (server.ts)
      // serve a sessão do cookie assinado por até 60s sem reler o banco (o
      // mesmo orçamento de atraso de revogação do AC-002) — a linha de
      // Session já morreu, o cookie da outra aba é que ainda não expirou.
      // Sem esperar essa janela, o teste provaria só o cache, não a revogação.
      await expect(async () => {
        await paginaOutra.goto("/settings/security");
        await expect(paginaOutra).toHaveURL(/sign-in/);
      }).toPass({ timeout: 75_000, intervals: [2000] });

      // Sessão atual: sobrevive, sem precisar logar de novo.
      await paginaAtual.goto("/settings/security");
      await expect(paginaAtual).not.toHaveURL(/sign-in/);

      // Cleanup: reverte pra senha original pela sessão que sobreviveu.
      await trocarSenha(paginaAtual, NEW_PASSWORD, PASSWORD);
      await expect(paginaAtual.getByText(/senha alterada/i)).toBeVisible({
        timeout: 15_000,
      });
    } finally {
      await sessaoAtual.close();
      await outraSessao.close();
    }
  });
});
