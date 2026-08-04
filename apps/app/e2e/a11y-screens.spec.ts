import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

/**
 * Accessibility (a11y) audit using axe-core — extends a11y.spec.ts to cover
 * the ~26 screens re-skinned from cosmos.html that don't yet have a
 * dedicated a11y check.
 *
 * Rules: wcag2a + wcag2aa (WCAG 2.1 Level AA). Excludes known third-party
 * iframes (Liveblocks, etc.). Only fails on critical/serious violations —
 * moderate/minor are reported but not asserted, to keep this a signal for
 * real regressions rather than noise.
 *
 * Run: pnpm test:e2e -- --grep "a11y screens"
 */
const WCAG_TAGS = ["wcag2a", "wcag2aa"];

async function assertNoSeriousViolations(page: Page, label: string) {
  await page.waitForLoadState("networkidle").catch(() => {});

  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .exclude("iframe")
    .analyze();

  const serious = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious"
  );

  expect(
    serious,
    `[${label}] Critical/serious violations: ${JSON.stringify(serious, null, 2)}`
  ).toEqual([]);
}

/**
 * Rotas nativas de `(authenticated)` — cada uma tem `page.tsx` própria.
 *
 * As 11 rotas `/portfolio/*` saíram daqui junto com a árvore que as servia: era
 * a UI anterior ao Cosmos, duplicada 1:1 pelo registry (`/cosmos/kanban`,
 * `/cosmos/wsjf`, `/cosmos/themes`…). A cobertura não caiu — mudou de endereço,
 * e está em COSMOS_SCREENS abaixo.
 */
const APP_ROUTES = [
  "/profile",
  "/settings/audit",
  "/settings/integrations",
  "/settings/members",
  "/settings/reports",
  "/settings/roles",
  "/settings/sso",
  "/settings/workspace",
];

/**
 * Telas do Cosmos. Elas não têm `page.tsx` por tela: a rota é a catch-all
 * `app/(cosmos)/cosmos/[[...seg]]/page.tsx`, que resolve o id contra
 * `components/cosmos/screens/registry.tsx`.
 *
 * Esta lista apontava para `/risks`, `/teams`, `/copilot`, `/workflows`,
 * `/integrations`, `/dependencies`, `/solution-trains` e `/analytics/*` — rotas
 * de `(authenticated)` apagadas em 43afe6d. A suíte ficou vermelha e a falha
 * parecia regressão de a11y, quando era 404. Só ids do registry entram aqui.
 *
 * Ficam de fora as telas de detalhe (`epic`, `feature`, `team`, `okr`, `theme`,
 * `pillar`, `vs`, `horizon`, `gate`): sem o segundo segmento de rota elas
 * renderizam <ComingSoon> por desenho, não por defeito. Auditá-las exige um id
 * semeado — trabalho da trilha que cobrir cada uma.
 */
const COSMOS_SCREENS = [
  "anomalies",
  "arts",
  "board",
  "budgets",
  "capacity",
  "copilot",
  "decisions",
  "dependencies",
  "executive",
  "flow",
  "governance",
  "integrations",
  "kanban",
  "measure",
  "okrs",
  "piplanning",
  "program",
  "risks",
  "roadmap",
  "settings",
  "solution",
  "strategy",
  "tags",
  "teams",
  "themes",
  "value",
  "velocity",
  "webhooks",
  "workflows",
  "wsjf",
];

test.describe("a11y screens — rotas nativas @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  for (const route of APP_ROUTES) {
    test(`${route} has no critical/serious violations`, async ({ page }) => {
      const response = await page.goto(route);
      // 404 aqui é rota apagada, não violação de a11y. Sem esta asserção a
      // suíte passa a auditar a página de erro e o sinal vira ruído.
      expect(response?.status(), `[${route}] esperava 200`).toBeLessThan(400);
      await assertNoSeriousViolations(page, route);
    });
  }
});

test.describe("a11y screens — telas do Cosmos @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  for (const screen of COSMOS_SCREENS) {
    test(`/cosmos/${screen} has no critical/serious violations`, async ({
      page,
    }) => {
      const route = `/cosmos/${screen}`;
      const response = await page.goto(route);
      expect(response?.status(), `[${route}] esperava 200`).toBeLessThan(400);
      // A catch-all responde 200 com <ComingSoon> quando o id não está no
      // registry — checar o status não bastaria para pegar id renomeado.
      await expect(
        page.getByText("Tela ainda não portada", { exact: false })
      ).toHaveCount(0);
      await assertNoSeriousViolations(page, route);
    });
  }
});
