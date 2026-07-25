# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: persona-home.spec.ts >> Persona Home — /dashboard >> page header greeting is present
- Location: e2e/persona-home.spec.ts:38:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/Bom dia|Boa tarde|Boa noite/i).first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText(/Bom dia|Boa tarde|Boa noite/i).first()

```

```yaml
- list:
  - listitem:
    - button "CO COSMOS Dev admin"
- textbox "Search"
- button "Buscar"
- text: SAFe Workspace
- list:
  - listitem:
    - link "Home":
      - /url: /dashboard
  - listitem:
    - link "Portfolio":
      - /url: /portfolio
    - button "Toggle"
  - listitem:
    - link "ART Board":
      - /url: /arts
    - button "Toggle"
  - listitem:
    - link "Times":
      - /url: /teams
    - button "Toggle"
  - listitem:
    - link "Analytics":
      - /url: /analytics
    - button "Toggle"
  - listitem:
    - link "Workflows":
      - /url: /workflows
    - button "Toggle"
  - listitem:
    - link "Large Solution":
      - /url: /solution-trains
    - button "Toggle"
  - listitem:
    - link "Integrações":
      - /url: /integrations
    - button "Toggle"
  - listitem:
    - link "Settings":
      - /url: /settings/workspace
    - button "Toggle"
- list:
  - listitem:
    - link "Webhooks":
      - /url: /webhooks
  - listitem:
    - link "Notificações":
      - /url: /notifications
  - listitem:
    - link "Exceções de Acesso":
      - /url: /access-exceptions
  - listitem:
    - link "Perfil":
      - /url: /profile
  - listitem:
    - link "Suporte":
      - /url: https://docs.cosmos.app
  - listitem:
    - link "Feedback":
      - /url: /feedback
- list:
  - listitem:
    - button "Copilot ⌘K"
    - link "Copilot fullscreen":
      - /url: /copilot
  - listitem:
    - button "AD Admin E2E admin@cosmos.local"
    - button "Toggle theme":
      - img
      - img
      - text: Toggle theme
    - button "Open notification feed"
- main:
  - heading "Command Palette" [level=2]
  - paragraph: Search for a command to run...
  - text: C COSMOSSAFe
  - navigation "Breadcrumb": COSMOS Dev Dashboard
  - group "Trocar persona":
    - button "RTE"
    - button "LPM" [pressed]
    - button "PO"
    - button "SM"
    - button "DEV"
  - button "Buscar"
  - text: AE
  - link "PI ativo PI 2026-Q2":
    - /url: /pi-planning
  - link "ARTs 1":
    - /url: /arts
  - link "Times 1":
    - /url: /teams
  - heading "Visão Geral do Portfolio" [level=1]
  - paragraph: Saúde do portfólio SAFe em tempo real — fluxo, predictability, custo e governança consolidados por ART.
  - link "Ver Portfolio →":
    - /url: /portfolio
  - text: Épicos ativos no portfólio 3 Em execução PI Predictability 87% PI PI 2026-Q2 Throughput médio — Sem histórico Custo de nuvem · MTD US$ 0 Mês atual Throughput por sprint Story points concluídos · sprints fechadas Nenhuma sprint fechada ainda. Predictability por PI Objetivos entregues no PI em execução 87 PI 2026-Q2 Alocação por Tema Estratégico Custo de nuvem no mês, por tema Sem custo de nuvem registrado neste mês. Épicos em implementação Progresso por épico ativo
  - link "ver todos →":
    - /url: /portfolio
  - link "AI-Powered Risk Copilot Inovação com IA aplicada ao SAFe 0% —":
    - /url: /epics/cmr8j4f6l001dicpx8n08ujxx
  - link "Portfolio Kanban & OKR Dashboard Acelerar time-to-market enterprise 0% —":
    - /url: /epics/cmr8j4f6k001cicpxi2hp5yh3
- button "Abrir Copilot AI"
- region "Notifications alt+T"
- alert
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | test.describe("Persona Home — /dashboard", () => {
  4  |   test.use({ storageState: "e2e/fixtures/auth-session.json" });
  5  | 
  6  |   test("home page renders bento grid without error", async ({ page }) => {
  7  |     await page.goto("/dashboard");
  8  |     await expect(page.locator("h1")).not.toHaveText("500");
  9  |     await expect(page.locator("h1")).not.toHaveText("Error");
  10 |     await expect(
  11 |       page.getByRole("group", { name: "Trocar persona" })
  12 |     ).toBeVisible();
  13 |   });
  14 | 
  15 |   test("page title is correct", async ({ page }) => {
  16 |     await page.goto("/dashboard");
  17 |     await expect(page).toHaveTitle(/Home \| COSMOS/);
  18 |   });
  19 | 
  20 |   test("persona selector dialog not shown on authenticated repeat visit", async ({
  21 |     page,
  22 |   }) => {
  23 |     await page.goto("/dashboard");
  24 |     const dialog = page.getByRole("dialog");
  25 |     await expect(dialog).not.toBeVisible();
  26 |   });
  27 | 
  28 |   test("bento grid does not overflow horizontally at 1280px", async ({
  29 |     page,
  30 |   }) => {
  31 |     await page.setViewportSize({ width: 1280, height: 900 });
  32 |     await page.goto("/dashboard");
  33 |     const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  34 |     const viewportWidth = await page.evaluate(() => window.innerWidth);
  35 |     expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10);
  36 |   });
  37 | 
  38 |   test("page header greeting is present", async ({ page }) => {
  39 |     await page.goto("/dashboard");
  40 |     // greeting varies by time of day
  41 |     await expect(
  42 |       page.getByText(/Bom dia|Boa tarde|Boa noite/i).first()
> 43 |     ).toBeVisible();
     |       ^ Error: expect(locator).toBeVisible() failed
  44 |   });
  45 | });
  46 | 
```