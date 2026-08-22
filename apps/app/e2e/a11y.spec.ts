import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Accessibility (a11y) audit using axe-core.
 *
 * Covers the four critical kanban/portfolio routes that received design
 * changes in the design-excellence sprint. Runs without auth to catch
 * structural violations on public redirect pages, and with auth (@auth)
 * for authenticated views.
 *
 * Rules:
 * - wcag2a + wcag2aa (WCAG 2.1 Level AA)
 * - Excludes known third-party iframes (Liveblocks, etc.)
 *
 * Run: pnpm test:e2e -- --grep a11y
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa"];

test.describe("a11y — Public pages", () => {
  test("sign-in page has no critical violations", async ({ page }) => {
    await page.goto("/sign-in");

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .exclude("iframe")
      .analyze();

    const serious = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(
      serious,
      `Critical/serious violations: ${JSON.stringify(serious, null, 2)}`
    ).toEqual([]);
  });
});

test.describe("a11y — Authenticated pages @auth", () => {
  test.use({ storageState: "e2e/fixtures/auth-session.json" });

  test("dashboard has no critical violations", async ({ page }) => {
    await page.goto("/cosmos/dashboard");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .exclude("iframe")
      .analyze();

    const serious = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(
      serious,
      `Critical/serious violations: ${JSON.stringify(serious, null, 2)}`
    ).toEqual([]);
  });

  test("portfolio kanban has no critical violations", async ({ page }) => {
    await page.goto("/cosmos/kanban");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .exclude("iframe")
      .analyze();

    const serious = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(
      serious,
      `Critical/serious violations: ${JSON.stringify(serious, null, 2)}`
    ).toEqual([]);
  });

  test("PI planning kanban has no critical violations", async ({ page }) => {
    await page.goto("/cosmos/piplanning");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .exclude("iframe")
      .analyze();

    const serious = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(
      serious,
      `Critical/serious violations: ${JSON.stringify(serious, null, 2)}`
    ).toEqual([]);
  });
});
