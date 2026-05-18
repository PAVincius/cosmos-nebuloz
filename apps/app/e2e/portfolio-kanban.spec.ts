import { test, expect } from "@playwright/test";

/**
 * E2E — Portfolio Kanban
 *
 * Tests the Portfolio Kanban board at /portfolio.
 *
 * The board has 5 SAFe columns: Backlog, Review, Analysis, Implementing, Done.
 * It uses Liveblocks for real-time collaboration (which will fail in E2E without
 * a valid LIVEBLOCKS_SECRET — the Room component renders a fallback).
 *
 * Strategy:
 * - Public tests: verify redirect behavior, no JS crashes
 * - Authenticated tests: verify columns render, headers present @auth
 */
test.describe("Portfolio Kanban — Page Structure", () => {
  test("unauthenticated access redirects safely", async ({ page }) => {
    const response = await page.goto("/portfolio");
    expect(response?.status()).toBeLessThan(500);
    // Must redirect to sign-in or stay on portfolio (if auth is permissive in dev)
    await expect(page).toHaveURL(/sign-in|portfolio/);
  });

  test("no critical JavaScript errors on unauthenticated access", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/portfolio");
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("NEXT_NOT_FOUND") &&
        !e.includes("ResizeObserver") &&
        !e.includes("Liveblocks") &&
        !e.includes("Non-Error promise rejection")
    );

    expect(criticalErrors).toHaveLength(0);
  });
});

/**
 * E2E — Portfolio Kanban (Authenticated)
 *
 * Run with: AUTH_TEST=true pnpm test:e2e
 */
test.describe("Portfolio Kanban — Authenticated @auth", () => {
  test.skip(() => !process.env.AUTH_TEST, "Auth tests disabled (set AUTH_TEST=true)");

  test.use({
    storageState: "./e2e/fixtures/auth-session.json",
  });

  const SAFE_COLUMNS = ["Backlog", "Review", "Analysis", "Implementing", "Done"];

  test("renders the Portfolio Kanban title", async ({ page }) => {
    await page.goto("/portfolio");
    await expect(
      page.locator("h1:has-text('Portfolio Kanban')")
    ).toBeVisible({ timeout: 15_000 });
  });

  test("renders all 5 SAFe columns", async ({ page }) => {
    await page.goto("/portfolio");

    // Aguarda o board carregar
    await expect(
      page.locator("h3:has-text('Backlog')").first()
    ).toBeVisible({ timeout: 15_000 });

    // Verifica todas as colunas
    for (const col of SAFE_COLUMNS) {
      await expect(
        page.locator(`h3:has-text('${col}')`).first()
      ).toBeVisible();
    }
  });

  test("each column has a card counter badge", async ({ page }) => {
    await page.goto("/portfolio");

    await page.locator("h3:has-text('Backlog')").first().waitFor({ timeout: 15_000 });

    // Cada coluna deve ter um badge de contador
    const badges = page.locator("span.rounded-full");
    const count = await badges.count();
    expect(count).toBeGreaterThanOrEqual(SAFE_COLUMNS.length);
  });

  test("page has correct SEO title", async ({ page }) => {
    await page.goto("/portfolio");
    await page.waitForLoadState("domcontentloaded");
    await expect(page).toHaveTitle(/Portfolio Kanban.*COSMOS/i);
  });

  test("shows collaborative loading fallback for Liveblocks Room", async ({
    page,
  }) => {
    // Mock: aborta a conexão do Liveblocks para simular sem credenciais
    await page.route("**/api/collaboration/auth", (route) => route.abort());

    await page.goto("/portfolio");

    // O Room fallback deve aparecer quando Liveblocks não conecta
    const fallbackOrBoard = page.locator(
      '[class*="animate-pulse"], h3:has-text("Backlog")'
    ).first();
    
    await expect(fallbackOrBoard).toBeVisible({ timeout: 10_000 });
  });
});
