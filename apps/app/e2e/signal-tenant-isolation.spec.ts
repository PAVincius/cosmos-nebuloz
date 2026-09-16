import { expect, test } from "@playwright/test";

/**
 * Signal — Jornada 4 do quickstart: isolamento e papéis.
 *
 * Os cinco portões, na ordem em que fecham: sessão, módulo, papel, permissão,
 * dono da linha. O que estes testes protegem é a ORDEM — um guard que roda
 * depois do outro certo ainda deixa vazar a existência da coisa que negou.
 *
 * O caso 6 do quickstart é o mais sutil: buscar uma iniciativa de outro tenant
 * responde "não encontrado", nunca "sem permissão". A segunda resposta já
 * confirma que a iniciativa existe, e isso é o vazamento.
 *
 * Run: pnpm --filter app test:e2e -- signal-tenant-isolation
 */
test.describe("Signal — sem sessão", () => {
  test("qualquer rota do módulo manda para o sign-in", async ({ page }) => {
    await page.goto("/signal");
    await page.waitForURL(/\/sign-in/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("uma rota funda redireciona igual, não só a raiz", async ({ page }) => {
    await page.goto("/signal/reports");
    await page.waitForURL(/\/sign-in/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test.describe("Signal — módulo e escopo @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("a página de módulo não contratado explica em vez de errar", async ({
    page,
  }) => {
    // Não é 404 nem tela branca: quem cai aqui precisa saber POR QUE não
    // entra — módulo não contratado ou papel ausente — e a quem pedir. A
    // página escolhe o texto pelo estado real do tenant; o teste aceita os
    // dois porque o que ele protege é a explicação, não qual das duas.
    await page.goto("/signal-indisponivel");
    await expect(page).toHaveTitle(/Signal indisponível/);
    await expect(
      page.getByRole("heading", {
        name: /Signal não está contratado|ainda não tem papel de medição/i,
      })
    ).toBeVisible();
  });

  test("código de iniciativa inexistente responde não encontrado", async ({
    page,
  }) => {
    // "Sem permissão" aqui já confirmaria que a iniciativa existe em algum
    // lugar. A resposta certa não distingue "de outro tenant" de "não existe".
    await page.goto("/signal/initiative/IN-999999");
    await page.waitForLoadState("networkidle");

    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body).toMatch(/não encontrad|not found/);
    expect(body).not.toMatch(/sem permissão|forbidden|403/);
  });

  test("a casca não oferece troca de persona", async ({ page }) => {
    // O protótipo tinha um seletor de persona. Ele não foi portado: mudar a
    // ênfase da leitura sem mudar o dado é UI que promete um recorte que o
    // servidor não aplica — e a primeira suspeita de quem vê é que existe
    // dado escondido atrás da outra persona.
    await page.goto("/signal");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/trocar persona|ver como/i)).toHaveCount(0);
  });
});
