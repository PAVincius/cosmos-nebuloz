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
  await page.waitForLoadState("networkidle").catch(() => undefined);

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).exclude("iframe").analyze();

  const serious = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious"
  );

  expect(
    serious,
    `[${label}] Critical/serious violations: ${JSON.stringify(serious, null, 2)}`
  ).toEqual([]);
}

const STATIC_ROUTES = [
  "/portfolio/wsjf",
  "/portfolio/themes",
  "/portfolio/strategy-map",
  "/portfolio/okrs",
  "/portfolio/budgets",
  "/portfolio/budgets/anomalies",
  "/portfolio/tags",
  "/portfolio/roadmap",
  "/portfolio/governance",
  "/portfolio/governance/decision-log",
  "/solution-trains",
  "/dependencies",
  "/risks",
  "/analytics/flow",
  "/analytics/velocity",
  "/analytics/measure-grow",
  "/teams",
  "/copilot",
  "/workflows",
  "/integrations",
  "/settings/audit",
  "/settings/integrations",
  "/settings/members",
  "/settings/reports",
  "/settings/roles",
  "/settings/sso",
  "/settings/workspace",
];

test.describe("a11y screens — static routes @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  for (const route of STATIC_ROUTES) {
    test(`${route} has no critical/serious violations`, async ({ page }) => {
      await page.goto(route);
      await assertNoSeriousViolations(page, route);
    });
  }
});

test.describe("a11y screens — dynamic ART/Team routes @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("ART detail, Program Board and PI Planning have no critical/serious violations", async ({
    page,
  }) => {
    await page.goto("/arts");
    const artLink = page.locator('a[href^="/arts/"]').first();
    await artLink.waitFor({ timeout: 15_000 });
    const artUrl = await artLink.getAttribute("href");
    if (!artUrl) {
      throw new Error("No ART link found on /arts list");
    }

    await page.goto(artUrl);
    await assertNoSeriousViolations(page, "/arts/[artId]");

    await page.goto(`${artUrl}/program-board`);
    await assertNoSeriousViolations(page, "/arts/[artId]/program-board");

    await page.goto(`${artUrl}/pi-planning`);
    await assertNoSeriousViolations(page, "/arts/[artId]/pi-planning");
  });

  test("Team standup has no critical/serious violations", async ({ page }) => {
    await page.goto("/teams");
    const standupLink = page.locator('a[href*="/standup"]').first();
    await standupLink.waitFor({ timeout: 15_000 });
    await standupLink.click();

    await assertNoSeriousViolations(page, "/teams/[teamId]/standup");
  });
});
