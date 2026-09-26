import { expect, test } from "@playwright/test";

/**
 * E2E — Login genérico (spec 004, US1, FR-001, SC-002)
 *
 * "100% das telas de login em app.nebuloz.ai, para qualquer tenant, não
 * exibem identidade visual de nenhum produto específico da suíte" — cobre as
 * quatro telas dentro de `(unauthenticated)`: sign-in, sign-up,
 * forgot-password e invite (link inválido/expirado, que é o que qualquer
 * acesso anônimo à rota realmente vê sem seed de convite pendente).
 */

const semMarcaDeProduto = (path: string) => {
  test.beforeEach(async ({ page }) => {
    await page.goto(path);
  });

  test("não exibe a palavra 'Cosmos' em nenhuma frase da tela", async ({
    page,
  }) => {
    // Sem `exact: true` — "Cosmos" embutido numa frase (ex.: "Comece sua
    // jornada no Cosmos gratuitamente.") também viola SC-002; `exact` só
    // pegaria o wordmark isolado do painel de marca do sign-in.
    await expect(page.getByText(/Cosmos/)).toHaveCount(0);
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
};

test.describe("Login genérico — sign-in — sem marca de produto específico", () => {
  semMarcaDeProduto("/sign-in");
});

test.describe("Login genérico — sign-up — sem marca de produto específico", () => {
  semMarcaDeProduto("/sign-up");
});

test.describe("Login genérico — forgot-password — sem marca de produto específico", () => {
  semMarcaDeProduto("/forgot-password");
});

test.describe("Login genérico — invite (token inválido) — sem marca de produto específico", () => {
  semMarcaDeProduto("/invite/e2e-token-inexistente-nao-usar-em-producao");
});
