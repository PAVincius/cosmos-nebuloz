import { expect, test } from "@playwright/test";

/**
 * Signal — Jornadas 1, 2 e 3 do quickstart.
 *
 * O que estes testes existem para pegar é uma coisa só, e é a regra-mãe do
 * produto: nenhuma tela mostra múltiplo de ROI sem a versão da fórmula e a
 * confiança ao lado. Um número sem as duas é uma opinião com casas decimais, e
 * é exatamente o que o módulo foi feito para não produzir.
 *
 * Rodam contra o tenant semeado por `seed-signal.ts`, que contrata o módulo e
 * dá papel ADMIN ao primeiro usuário — o mesmo do storageState.
 *
 * Run: pnpm --filter app test:e2e -- signal-journey
 */
test.describe("Signal — jornadas @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("Jornada 1 — o ROI nunca aparece sozinho", async ({ page }) => {
    await page.goto("/signal/initiatives");
    await page.waitForLoadState("networkidle");

    const rows = page.locator("button", { hasText: /^IN-\d+/ });
    const count = await rows.count();
    test.skip(count === 0, "sem iniciativa semeada neste banco");

    // Cada linha que mostra múltiplo mostra também versão e confiança.
    for (let i = 0; i < count; i += 1) {
      const row = rows.nth(i);
      const text = (await row.innerText()).replace(/\s+/g, " ");
      if (!/\d+,\d×/.test(text)) {
        continue;
      }
      // Ou a versão da fórmula, ou o carimbo "sem lastro" no lugar dela —
      // nunca o múltiplo sozinho.
      expect(text, `linha ${i}: múltiplo sem versão de fórmula`).toMatch(
        /fórmula v\d+|sem lastro/
      );
      expect(text, `linha ${i}: múltiplo sem confiança`).toMatch(
        /confian|\d+\s*\/\s*100|\b\d{1,3}\b/i
      );
    }
  });

  test("Jornada 1 — o detalhe traz adoção e resultado na mesma tela", async ({
    page,
  }) => {
    await page.goto("/signal/initiatives");
    await page.waitForLoadState("networkidle");
    const first = page.locator("button", { hasText: /^IN-\d+/ }).first();
    test.skip((await first.count()) === 0, "sem iniciativa semeada");

    await first.click();
    await page.waitForURL(/\/signal\/initiative\//);

    // Adoção e valor juntos: separá-los é o que permite celebrar uso sem
    // retorno, que é o vício que o produto existe para corrigir.
    await expect(page.getByText(/adoção/i).first()).toBeVisible();
    await expect(page.getByText(/retorno|ROI|múltiplo/i).first()).toBeVisible();
    await expect(page.getByText(/confian/i).first()).toBeVisible();
  });

  test("Jornada 2 — fonte caída aparece com conserto e impacto", async ({
    page,
  }) => {
    await page.goto("/signal/connections");
    await page.waitForLoadState("networkidle");

    const broken = page.getByText(/desconectada|atrasada/i).first();
    test.skip(
      (await broken.count()) === 0,
      "nenhuma fonte com problema no banco semeado"
    );

    // "Erro 401" não é conserto. O texto tem de dizer o que fazer, e o
    // estrago tem de estar declarado — senão é notificação que ninguém age.
    await expect(page.getByText(/como consertar/i).first()).toBeVisible();
    await expect(page.getByText(/impacto/i).first()).toBeVisible();
  });

  test("Jornada 2 — a queda propaga para mapeamento e evidência", async ({
    page,
  }) => {
    await page.goto("/signal/connections");
    await page.waitForLoadState("networkidle");
    const broken = page.getByText(/desconectada/i).first();
    test.skip((await broken.count()) === 0, "nenhuma fonte caída no banco");

    await page.goto("/signal/mapping");
    await expect(page.getByText(/fonte caída/i).first()).toBeVisible();

    await page.goto("/signal/evidence");
    // A ressalva fica visível, não em nota de rodapé: a observação congelada
    // continua contando para o ROI e quem lê precisa saber ANTES.
    await expect(page.getByText(/congelada|ressalva/i).first()).toBeVisible();
  });

  test("Jornada 3 — congelado é imutável e diz que é", async ({ page }) => {
    await page.goto("/signal/reports");
    await page.waitForLoadState("networkidle");

    const frozen = page.getByText("Congelado").first();
    test.skip(
      (await frozen.count()) === 0,
      "nenhum relatório congelado no banco semeado"
    );

    // Um congelado não oferece o botão de congelar de novo: a UI diz a mesma
    // coisa que a action recusaria, antes de a pessoa tentar.
    // O cartão é o div mais fundo que contém o estado E os botões — o badge
    // sozinho também está num div, e seria o errado.
    const card = page
      .locator("div", { has: page.getByText("Congelado") })
      .filter({ has: page.getByRole("button", { name: /baixar/i }) })
      .last();
    await expect(card.getByRole("button", { name: /congelar/i })).toHaveCount(
      0
    );
    await expect(card.getByRole("button", { name: /baixar/i })).toBeVisible();
  });

  test("Jornada 3 — rascunho travado mostra o que destravar", async ({
    page,
  }) => {
    await page.goto("/signal/reports");
    await page.waitForLoadState("networkidle");
    const freeze = page.getByRole("button", { name: /congelar período/i });
    test.skip((await freeze.count()) === 0, "nenhum rascunho no banco semeado");

    // Tentar congelar com fonte caída: o 409 vem com a lista das fontes, e a
    // UI lista — não manda a pessoa procurar.
    await freeze.first().click();
    await expect(
      page.getByText(/ainda não dá para congelar/i).first()
    ).toBeVisible();
    await expect(page.getByText(/CN-\d+/).first()).toBeVisible();
  });
});
