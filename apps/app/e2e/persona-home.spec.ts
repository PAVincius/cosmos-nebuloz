import { expect, test } from "@playwright/test";

/**
 * E2E — a home do Cosmos, em `/cosmos/dashboard`.
 *
 * O nome do arquivo é herança: a tela já se chamou "Persona Home" e tinha um
 * seletor de persona e uma saudação por hora do dia. As duas coisas saíram —
 * um grep por "Trocar persona" e por "Bom dia|Boa tarde|Boa noite" em `apps/`
 * e `packages/` não acha nada. A tela de hoje é "Visão Geral", sob "Portfolio".
 *
 * Três testes daqui afirmavam sobre aquela UI e falhavam por isso. Foram
 * reescritos para o que a tela é, em vez de removidos: o que eles cobrem de
 * fato — a home abre, tem título de aba correto e o cabeçalho do shell
 * aparece — continua valendo a pena.
 */
test.describe("Home do Cosmos — /cosmos/dashboard", () => {
  test.use({ storageState: "e2e/fixtures/auth-session.json" });

  test("home page renders without error", async ({ page }) => {
    await page.goto("/cosmos/dashboard");
    await expect(page.locator("h1")).not.toHaveText("500");
    await expect(page.locator("h1")).not.toHaveText("Error");
    // O h1 da tela é o sinal de que ela renderizou — o antigo `group` chamado
    // "Trocar persona" não existe mais.
    await expect(page.locator("h1")).toHaveText("Visão Geral");
  });

  test("page title is correct", async ({ page }) => {
    await page.goto("/cosmos/dashboard");
    // Guarda uma regressão real: `generateMetadata` do catch-all importava
    // `TITLES` de `components/cosmos/shell`, que é `"use client"`. Através dessa
    // fronteira o objeto chega como referência, `TITLES[id]` saía `undefined`, e
    // TODA aba do Cosmos lia o id cru — aqui, "dashboard | COSMOS · COSMOS".
    // O mapa passou a morar em `components/cosmos/titles`, sem `"use client"`.
    await expect(page).toHaveTitle("Visão Geral | Portfolio · COSMOS");
  });

  test("persona selector dialog not shown on authenticated repeat visit", async ({
    page,
  }) => {
    await page.goto("/cosmos/dashboard");
    const dialog = page.getByRole("dialog");
    await expect(dialog).not.toBeVisible();
  });

  test("bento grid does not overflow horizontally at 1280px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/cosmos/dashboard");
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10);
  });

  test("shell header shows the breadcrumb for the screen", async ({ page }) => {
    await page.goto("/cosmos/dashboard");
    // Substitui a saudação por hora do dia, que não existe mais. O breadcrumb
    // é o que o cabeçalho de fato mostra, e ele lê o mesmo `TITLES` — do lado
    // client desta vez, que é o lado que nunca esteve quebrado. Ter os dois
    // cobertos é o que separa "o mapa sumiu" de "o mapa não atravessa a
    // fronteira de server".
    await expect(page.getByText("Portfolio").first()).toBeVisible();
  });
});
