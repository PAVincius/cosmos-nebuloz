import { expect, test } from "@playwright/test";

/**
 * E2E — ActiveAccountBadge (FR-001/spec 009)
 *
 * Mesmo padrão de workspace-switcher.spec.ts: os testes visuais (que exigem
 * sessão autenticada real) rodam só com AUTH_TEST=true e uma storageState de
 * fixture. Sem isso, cobrimos que as 5 rotas não quebram (nunca 5xx) para
 * quem não está autenticado — não mais que isso, já que sem sessão a pessoa
 * nem chega no shell onde o badge vive.
 */
test.describe("ActiveAccountBadge — rotas não quebram sem sessão", () => {
  for (const path of [
    "/meridian",
    "/scaffold",
    "/cosmos/dashboard",
    "/signal",
    "/charter",
  ]) {
    test(`${path} nunca responde 5xx`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBeLessThan(500);
    });
  }
});

test.describe("ActiveAccountBadge — Visual @auth", () => {
  test.skip(
    () => !process.env.AUTH_TEST,
    "Auth tests disabled (set AUTH_TEST=true)"
  );

  test.use({
    storageState: "./e2e/fixtures/auth-session.json",
  });

  for (const [path, testId] of [
    ["/meridian", "meridian"],
    ["/scaffold", "scaffold"],
    ["/cosmos/dashboard", "cosmos"],
    ["/signal", "signal"],
    ["/charter", "charter"],
  ] as const) {
    test(`${testId}: nome da conta aparece como texto, sem hover`, async ({
      page,
    }) => {
      await page.goto(path);
      const badge = page.locator('[data-testid="active-account-badge"]');
      await expect(badge).toBeVisible({ timeout: 10_000 });
      await expect(badge).not.toHaveText("");
    });
  }
});
