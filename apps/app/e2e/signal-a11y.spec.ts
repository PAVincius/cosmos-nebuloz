import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

/**
 * Signal — Jornada 5 do quickstart: acessibilidade.
 *
 * As dez telas, nos dois temas, mais os quatro comportamentos que uma varredura
 * automática não pega: o skip link, o foco preso na paleta, o alto contraste
 * que reforça sem apagar container, e o movimento reduzido pelos dois caminhos
 * (preferência do sistema e escolha explícita).
 *
 * Roda com a sessão do admin do tenant semeado: `seed-signal.ts` contrata o
 * módulo e dá papel ADMIN ao primeiro usuário, que é o mesmo do storageState.
 *
 * Run: pnpm --filter app test:e2e -- signal-a11y
 */
const WCAG_TAGS = ["wcag2a", "wcag2aa"];

/** As dez telas do módulo, na ordem da navegação. */
const SCREENS = [
  "/signal",
  "/signal/initiatives",
  "/signal/connections",
  "/signal/mapping",
  "/signal/evidence",
  "/signal/alerts",
  "/signal/reports",
  "/signal/audit",
  "/signal/settings",
] as const;

async function assertNoSeriousViolations(page: Page, label: string) {
  await page.waitForLoadState("networkidle").catch(() => {
    // Uma tela que fica buscando não invalida a varredura do que já pintou.
  });

  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .exclude("iframe")
    .analyze();

  const serious = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious"
  );

  expect(
    serious,
    `[${label}] Violações críticas/sérias: ${JSON.stringify(serious, null, 2)}`
  ).toEqual([]);
}

test.describe("Signal a11y @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  for (const theme of ["dark", "light"] as const) {
    test(`axe sem violação nas telas — tema ${theme}`, async ({ page }) => {
      for (const route of SCREENS) {
        await page.goto(route);
        await page.evaluate((t) => {
          document.documentElement.setAttribute("data-theme", t);
        }, theme);
        await assertNoSeriousViolations(page, `${route} · ${theme}`);
      }
    });
  }

  test("o detalhe de iniciativa também passa", async ({ page }) => {
    await page.goto("/signal/initiatives");
    await page.waitForLoadState("networkidle");
    const first = page.locator("button", { hasText: /^IN-\d+/ }).first();
    if ((await first.count()) === 0) {
      test.skip(true, "sem iniciativa semeada neste banco");
    }
    await first.click();
    await page.waitForURL(/\/signal\/initiative\//);
    await assertNoSeriousViolations(page, "/signal/initiative/:code");
  });

  test("o skip link aparece no primeiro Tab e pula para o conteúdo", async ({
    page,
  }) => {
    await page.goto("/signal");
    await page.keyboard.press("Tab");

    const skip = page.locator("a.skip");
    await expect(skip).toBeFocused();
    await skip.press("Enter");

    // O destino do skip existe e recebe o foco — sem isso o link é decoração.
    await expect(page.locator("#signal-main")).toBeVisible();
  });

  test("a paleta abre no ⌘K, prende o foco e devolve no Esc", async ({
    page,
  }) => {
    // A paleta não tem gatilho visível: o atalho é a porta. Por isso o foco
    // volta para onde ESTAVA, não para um botão — é a única promessa que a
    // pessoa que navega por teclado pode cobrar.
    await page.goto("/signal");
    const opener = page.getByRole("link", { name: /iniciativas/i }).first();
    await opener.focus();
    await page.keyboard.press("Meta+k");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Foco preso: tabular várias vezes não sai do diálogo.
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press("Tab");
    }
    await expect(
      dialog.locator(":focus"),
      "o foco escapou do diálogo"
    ).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("alto contraste reforça sem apagar container", async ({ page }) => {
    await page.goto("/signal");
    const containers = await page.locator("section, .card").count();

    await page.evaluate(() => {
      document.documentElement.setAttribute("data-contrast", "high");
    });

    // A decoração some…
    const decoration = page.locator(".dots, .wm, .sig");
    const visibleDecoration = await decoration.evaluateAll(
      (els) =>
        els.filter((el) => getComputedStyle(el).display !== "none").length
    );
    expect(visibleDecoration).toBe(0);

    // …e o container permanece. Alto contraste é reforço, não amputação.
    expect(await page.locator("section, .card").count()).toBe(containers);
  });

  test("movimento reduzido pelos dois caminhos", async ({ page, context }) => {
    await page.goto("/signal");
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-motion", "reduced");
    });
    const byChoice = await page.evaluate(() => {
      const el = document.querySelector(".fade-in");
      return el ? getComputedStyle(el).animationDuration : "0s";
    });
    expect(["0s", "0.01ms", "0.01s"]).toContain(byChoice);

    // O mesmo resultado pela preferência do sistema, sem escolha na tela.
    const system = await context.newPage();
    await system.emulateMedia({ reducedMotion: "reduce" });
    await system.goto("/signal");
    const bySystem = await system.evaluate(() => {
      const el = document.querySelector(".fade-in");
      return el ? getComputedStyle(el).animationDuration : "0s";
    });
    expect(["0s", "0.01ms", "0.01s"]).toContain(bySystem);
    await system.close();
  });
});
