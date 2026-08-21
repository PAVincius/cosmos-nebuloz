import { defineConfig, devices } from "@playwright/test";

/**
 * E2E do back-office.
 *
 * Existe porque até aqui o único spec que exercitava este app morava em
 * `apps/app/e2e/` e alcançava a porta 3013 por cima da fronteira, importando o
 * fixture por `../../backoffice/e2e/fixtures/staff`. O efeito era o sinal
 * chegar no time errado: mudança no back-office quebrava a suíte do produto.
 *
 * Sem `globalSetup`. O de `apps/app` semeia papéis SAFe e personas do Charter e
 * grava storageState assinando em 3012 — nada disso produz a sessão que
 * `requirePlatformStaff` exige aqui, que além de sessão e membership no tenant
 * interno pede `twoFactorVerified` na sessão em curso. Ver o README de `e2e/`.
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3013";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    // Mesmo teto de `apps/app`: primeira visita a cada rota paga a compilação a
    // frio do Next em dev, e 30s estoura nas telas do bpmn.
    navigationTimeout: 60_000,
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /\.setup\.ts$/,
    },
  ],
  ...(process.env.PLAYWRIGHT_BASE_URL
    ? {}
    : {
        webServer: {
          command: "pnpm dev",
          url: BASE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: { NODE_ENV: "development" },
        },
      }),
  outputDir: "test-results",
});
