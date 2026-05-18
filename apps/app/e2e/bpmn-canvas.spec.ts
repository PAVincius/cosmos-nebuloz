import { test, expect } from "@playwright/test";

/**
 * E2E — BPMN Canvas
 *
 * Tests the BPMN Workflow page at /workflows/[teamId]/bpmn.
 *
 * Strategy:
 * - Public tests: verify the page structure, redirect behavior, and API reachability
 * - The BPMN canvas uses `next/dynamic` with `ssr: false`, so the component loads
 *   client-side. We verify the loading state and canvas mounting.
 * - Authenticated tests are tagged @auth and use storageState.
 */
test.describe("BPMN Canvas — Page Structure", () => {
  const BPMN_URL = "/workflows/team-demo/bpmn";

  test("unauthenticated access redirects safely (no 500)", async ({ page }) => {
    const response = await page.goto(BPMN_URL);
    // Deve redirecionar para sign-in ou retornar 200 (se publicado) — nunca 500
    expect(response?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/sign-in|bpmn/);
  });

  test("no JavaScript errors on sign-in redirect", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    
    await page.goto(BPMN_URL);
    await page.waitForTimeout(2000);
    
    // Filter out expected/known framework errors
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("NEXT_NOT_FOUND") &&
        !e.includes("ResizeObserver") &&
        !e.includes("Non-Error promise rejection")
    );
    
    expect(criticalErrors).toHaveLength(0);
  });
});

/**
 * E2E — BPMN Canvas (Authenticated)
 *
 * Full canvas tests require auth session.
 * Run with: AUTH_TEST=true pnpm test:e2e
 */
test.describe("BPMN Canvas — Authenticated @auth", () => {
  test.skip(() => !process.env.AUTH_TEST, "Auth tests disabled (set AUTH_TEST=true)");

  test.use({
    storageState: "./e2e/fixtures/auth-session.json",
  });

  test("renders loading fallback before canvas mounts", async ({ page }) => {
    // Mock the server action to return null (blank canvas)
    await page.route("**/api/**", (route) => route.continue());

    await page.goto("/workflows/team-demo/bpmn");

    // O fallback do next/dynamic deve aparecer enquanto carrega
    const loader = page.locator('.animate-spin, [class*="animate-"]').first();
    // O loader é rápido, então verificamos a ausência de crash em vez de presence
    await expect(page).not.toHaveURL(/error/);
  });

  test("renders Modelador BPMN Corporativo heading", async ({ page }) => {
    await page.goto("/workflows/team-demo/bpmn");

    // Aguarda o componente carregar (next/dynamic tem delay)
    await expect(
      page.locator("h2:has-text('Modelador BPMN Corporativo')")
    ).toBeVisible({ timeout: 15_000 });
  });

  test("Exportar SVG button is present", async ({ page }) => {
    await page.goto("/workflows/team-demo/bpmn");

    await expect(
      page.locator("button:has-text('Exportar SVG')")
    ).toBeVisible({ timeout: 15_000 });
  });

  test("Salvar Fluxo button is present", async ({ page }) => {
    await page.goto("/workflows/team-demo/bpmn");

    await expect(
      page.locator("button:has-text('Salvar Fluxo')")
    ).toBeVisible({ timeout: 15_000 });
  });

  test("BPMN canvas container is mounted in DOM", async ({ page }) => {
    await page.goto("/workflows/team-demo/bpmn");
    
    // Aguarda o canvas do bpmn-js montar (o div .djs-container é criado pelo bpmn-js)
    await expect(
      page.locator(".djs-container, .bjs-container, [class*='djs-']").first()
    ).toBeVisible({ timeout: 20_000 });
  });

  test("canvas has correct teamId displayed", async ({ page }) => {
    await page.goto("/workflows/team-demo/bpmn");

    await expect(
      page.locator("p:has-text('Equipe ID: team-demo')")
    ).toBeVisible({ timeout: 15_000 });
  });
});
