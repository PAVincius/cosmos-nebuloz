import { expect, test } from "@playwright/test";
import { ensureStaffUser } from "./fixtures/staff";

/**
 * PARADO: falta o fixture de sessão de staff.
 *
 * Estes dois testes vieram de `apps/app/e2e/backoffice-charter-provisioning.spec.ts`,
 * onde moravam por falta de config própria aqui. Ao trazê-los ficou claro que
 * nunca puderam passar: rodam em contexto limpo, sem cookie, e
 * `requirePlatformStaff` exige três coisas — sessão, membership no tenant
 * interno e `twoFactorVerified` na sessão em curso. `ensureStaffUser()` entrega
 * só a segunda: cria a linha no banco e nunca estabelece sessão no navegador.
 * O resultado é o redirect para `/sign-in` e o `getByLabel` falhando com
 * "não encontrado" — que parece bug de seletor e não é.
 *
 * `skip` e não deleção: as asserções descrevem o fluxo de provisionamento que a
 * FR pede, e reescrevê-las depois custa mais que mantê-las. Teste que falha por
 * motivo conhecido e fica vermelho ensina o time a ignorar vermelho.
 *
 * Para destravar é preciso um `e2e/setup/staff.setup.ts` que produza sessão com
 * segundo fator cumprido. Não dá para forjar por INSERT: `twoFactorVerified`
 * não é coluna de `Session` — quem o guarda é o plugin `twoFactor` do
 * better-auth (`packages/auth/server.ts`). Os caminhos são cadastrar um TOTP
 * conhecido e resolver o desafio pela UI, ou expor um bypass restrito a
 * ambiente de teste. O segundo é mais barato e mexe em código de auth, então é
 * decisão de quem cuida de auth, não do E2E.
 */

const BACKOFFICE = process.env.BACKOFFICE_URL ?? "http://localhost:3013";

test.describe("provisionar cliente e preparar o Charter", () => {
  // `test.skip(condição, motivo)` e não `describe.skip`: o motivo aparece no
  // relatório do Playwright, então quem rodar a suíte lê por que estes dois não
  // rodaram sem precisar abrir o arquivo.
  // biome-ignore lint/suspicious/noSkippedTests: falta o fixture de sessão de staff — ver o bloco acima e e2e/README.md
  test.skip(
    true,
    "Falta e2e/setup/staff.setup.ts: requirePlatformStaff exige sessão com twoFactorVerified, e ensureStaffUser só cria a linha no banco."
  );

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
