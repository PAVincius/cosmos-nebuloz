import { expect, test } from "@playwright/test";

/**
 * E2E — Teams list & Daily Standup
 *
 * A lista de times não tem link para um detalhe de time puro — o TeamCard
 * aponta direto para o standup, então seguimos esse link para obter um teamId
 * real e cair na tela de standup numa navegação só.
 *
 * As rotas moram sob `/cosmos/`. O app serve tudo por um catch-all
 * `app/(authenticated)/cosmos/[[...seg]]/page.tsx`, e `/teams` na raiz não
 * existe: responde 404 para quem tem sessão, e o 404 renderiza a tela de
 * entrar. Este spec navegava para `/teams` e afirmava sobre um `h1` que dizia
 * "Entrar" — falha que parece sessão perdida e não é.
 *
 * O erro sobreviveu porque nada aqui rodava: o `test.skip` abaixo pula sem
 * `AUTH_TEST`, e com `AUTH_TEST` o `globalSetup` morria antes, no teto de
 * requisição do sign-in. Um defeito escondia o outro.
 */
test.describe("Teams @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("teams list renders header and team cards", async ({ page }) => {
    await page.goto("/cosmos/teams");
    await expect(page.locator("h1")).toContainText(/Times/i, {
      timeout: 15_000,
    });
  });

  // Este não é caso de trocar o caminho: a tela não existe.
  //
  // O catch-all resolve `SCREENS[id]` de `components/cosmos/screens/registry.tsx`
  // e cai em `<ComingSoon>` para id não registrado. O registry tem `teams` e
  // `team`, e NÃO tem `standup`. O recurso existe do lado do servidor
  // (`app/actions/standup/`) e nunca ganhou tela.
  //
  // O `TeamsScreen` também não tem link nenhum de standup — os cards abrem
  // modal, não navegam. O `a[href*="/standup"]` que este teste procura nunca
  // esteve lá.
  //
  // `skip` com motivo em vez de deleção: a asserção descreve o comportamento
  // esperado quando a tela existir, e o motivo aparece no relatório do
  // Playwright para quem for construí-la.
  // biome-ignore lint/suspicious/noSkippedTests: a tela de standup não existe — ver o bloco acima
  test.skip("standup page renders via team card link and shows the standup form", async ({
    page,
  }) => {
    await page.goto("/cosmos/teams");
    const link = page.locator('a[href*="/standup"]').first();
    await link.waitFor({ timeout: 15_000 });
    await link.click();

    await expect(page).toHaveURL(/\/cosmos\/teams\/.+\/standup/);
    await expect(page.locator("h1")).toContainText(/Standup/i, {
      timeout: 15_000,
    });
  });
});
