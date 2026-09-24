import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

/**
 * E2E — Meridian sob carga (M10 do roteiro,
 * docs/qualidade/dogfood/meridian/roteiro.md · SC-010).
 *
 * Só local, de propósito — `scripts/seed-meridian-load.ts` recusa rodar
 * fora de `localhost`/`127.0.0.1`/`::1` (mesmo guard de
 * `scripts/seed-meridian.ts`). 200 assessments / 2.000 gaps no tenant
 * dedicado `techcorp-sa`, sem tocar o tenant do dogfood funcional
 * (`cosmos-dev`) nem os assessments que `meridian-dogfood.spec.ts` cria.
 *
 * Mede o tempo de resposta da carteira (`/meridian`) e do registro de gaps
 * (`/meridian/registry`) sob essa carga — SC-010 pede < 2s pras duas.
 */

const PERSONA_EMAIL = "carga.performance@nebuloz.exemplo";
const PERSONA_PASSWORD = process.env.MERIDIAN_SEED_PASSWORD ?? "meridian123";
const BUDGET_MS = 2000;

test.describe("Meridian · carga (M10, só local) @meridian-load", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(() => {
    // Idempotente — apaga e recria só os assessments/gaps de carga
    // (prefixo LOAD-) do tenant dedicado a cada corrida. cwd default
    // (apps/app) — mesmo padrão de e2e/setup/auth.setup.ts.
    execSync("pnpm seed:meridian:load techcorp-sa", { stdio: "inherit" });
  });

  test("carteira e registro de gaps respondem em menos de 2s com 200 assessments / 2.000 gaps (SC-010)", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await page.locator('input[type="email"]').fill(PERSONA_EMAIL);
    await page.locator('input[type="password"]').fill(PERSONA_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/dashboard|portfolio|\/$/, { timeout: 30_000 });
    // Primeira ida em /meridian fixa o activeTenantId da sessão
    // (requireTenantSession, mesmo mecanismo de auth.setup.ts) — não conta
    // pra medição, é setup.
    await page.goto("/meridian");
    await expect(
      page.getByRole("heading", { name: "Assessments" })
    ).toBeVisible({ timeout: 30_000 });

    const carteiraStart = Date.now();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Assessments" })
    ).toBeVisible();
    await expect(page.getByText("LOAD-0001").first()).toBeVisible();
    const carteiraMs = Date.now() - carteiraStart;
    console.log(`[M10] /meridian: ${carteiraMs}ms (200 assessments)`);
    expect(carteiraMs).toBeLessThan(BUDGET_MS);

    const registryStart = Date.now();
    await page.goto("/meridian/registry");
    await expect(page.getByText(/gap/i).first()).toBeVisible();
    const registryMs = Date.now() - registryStart;
    console.log(`[M10] /meridian/registry: ${registryMs}ms (2.000 gaps)`);
    expect(registryMs).toBeLessThan(BUDGET_MS);

    // console.log some vezes some por trás de wrappers de shell no CI local
    // desta sessão — grava também num arquivo pra evidência confiável.
    writeFileSync(
      "test-results/m10-timings.json",
      JSON.stringify({ carteiraMs, registryMs, budgetMs: BUDGET_MS }, null, 2)
    );
  });
});
