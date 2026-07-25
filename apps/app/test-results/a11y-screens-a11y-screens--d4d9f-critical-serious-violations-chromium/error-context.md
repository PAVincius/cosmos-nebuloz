# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y-screens.spec.ts >> a11y screens — static routes @auth >> /dependencies has no critical/serious violations
- Location: e2e/a11y-screens.spec.ts:67:9

# Error details

```
Error: [/dependencies] Critical/serious violations: [
  {
    "id": "color-contrast",
    "impact": "serious",
    "tags": [
      "cat.color",
      "wcag2aa",
      "wcag143",
      "TTv5",
      "TT13.c",
      "EN-301-549",
      "EN-9.1.4.3",
      "ACT",
      "RGAAv4",
      "RGAA-3.2.1"
    ],
    "description": "Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds",
    "help": "Elements must meet minimum color contrast ratio thresholds",
    "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/color-contrast?application=playwright",
    "nodes": [
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#65748b",
              "bgColor": "#0e1330",
              "contrastRatio": 3.83,
              "fontSize": "8.3pt (11px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div style=\"background: var(--su...\">",
                "target": [
                  ".gap-6 > div:nth-child(2) > div:nth-child(2) > div:nth-child(2) > div:nth-child(1)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"font-mono\" style=\"color: var(--ink-subtle); font-size: 11px; font-weight: 600;\">CMR8J4F6</span>",
        "target": [
          "div:nth-child(1) > div:nth-child(1) > .font-mono"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#65748b",
              "bgColor": "#0e1330",
              "contrastRatio": 3.83,
              "fontSize": "8.3pt (11px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div style=\"background: var(--su...\">",
                "target": [
                  ".gap-6 > div:nth-child(2) > div:nth-child(2) > div:nth-child(2) > div:nth-child(2)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"font-mono\" style=\"color: var(--ink-subtle); font-size: 11px; font-weight: 600;\">CMR8J4F6</span>",
        "target": [
          "div:nth-child(2) > div:nth-child(1) > .font-mono"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
      }
    ]
  }
]

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 93

- Array []
+ Array [
+   Object {
+     "description": "Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds",
+     "help": "Elements must meet minimum color contrast ratio thresholds",
+     "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/color-contrast?application=playwright",
+     "id": "color-contrast",
+     "impact": "serious",
+     "nodes": Array [
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#0e1330",
+               "contrastRatio": 3.83,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#65748b",
+               "fontSize": "8.3pt (11px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div style=\"background: var(--su...\">",
+                 "target": Array [
+                   ".gap-6 > div:nth-child(2) > div:nth-child(2) > div:nth-child(2) > div:nth-child(1)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"font-mono\" style=\"color: var(--ink-subtle); font-size: 11px; font-weight: 600;\">CMR8J4F6</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(1) > div:nth-child(1) > .font-mono",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#0e1330",
+               "contrastRatio": 3.83,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#65748b",
+               "fontSize": "8.3pt (11px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div style=\"background: var(--su...\">",
+                 "target": Array [
+                   ".gap-6 > div:nth-child(2) > div:nth-child(2) > div:nth-child(2) > div:nth-child(2)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"font-mono\" style=\"color: var(--ink-subtle); font-size: 11px; font-weight: 600;\">CMR8J4F6</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(2) > div:nth-child(1) > .font-mono",
+         ],
+       },
+     ],
+     "tags": Array [
+       "cat.color",
+       "wcag2aa",
+       "wcag143",
+       "TTv5",
+       "TT13.c",
+       "EN-301-549",
+       "EN-9.1.4.3",
+       "ACT",
+       "RGAAv4",
+       "RGAA-3.2.1",
+     ],
+   },
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e5]:
      - list [ref=e7]:
        - listitem [ref=e8]:
          - button "CO COSMOS Dev admin" [ref=e9] [cursor=pointer]:
            - generic [ref=e10]: CO
            - generic [ref=e11]:
              - generic [ref=e12]: COSMOS Dev
              - generic [ref=e13]: admin
            - img [ref=e14]
      - generic [ref=e18]:
        - img [ref=e20]
        - textbox "Search" [ref=e23]
        - button "Buscar" [ref=e24] [cursor=pointer]:
          - img
      - generic [ref=e25]:
        - generic [ref=e26]:
          - generic [ref=e27]: SAFe Workspace
          - list [ref=e28]:
            - listitem [ref=e29]:
              - link "Home" [ref=e30] [cursor=pointer]:
                - /url: /dashboard
                - img [ref=e31]
                - generic [ref=e34]: Home
            - listitem [ref=e35]:
              - link "Portfolio" [ref=e36] [cursor=pointer]:
                - /url: /portfolio
                - img [ref=e37]
                - generic [ref=e42]: Portfolio
              - button "Toggle" [ref=e43] [cursor=pointer]:
                - img [ref=e44]
                - generic [ref=e46]: Toggle
            - listitem [ref=e47]:
              - link "ART Board" [ref=e48] [cursor=pointer]:
                - /url: /arts
                - img [ref=e49]
                - generic [ref=e56]: ART Board
              - button "Toggle" [ref=e57] [cursor=pointer]:
                - img [ref=e58]
                - generic [ref=e60]: Toggle
            - listitem [ref=e61]:
              - link "Times" [ref=e62] [cursor=pointer]:
                - /url: /teams
                - img [ref=e63]
                - generic [ref=e68]: Times
              - button "Toggle" [ref=e69] [cursor=pointer]:
                - img [ref=e70]
                - generic [ref=e72]: Toggle
            - listitem [ref=e73]:
              - link "Analytics" [ref=e74] [cursor=pointer]:
                - /url: /analytics
                - img [ref=e75]
                - generic [ref=e77]: Analytics
              - button "Toggle" [ref=e78] [cursor=pointer]:
                - img [ref=e79]
                - generic [ref=e81]: Toggle
            - listitem [ref=e82]:
              - link "Workflows" [ref=e83] [cursor=pointer]:
                - /url: /workflows
                - img [ref=e84]
                - generic [ref=e88]: Workflows
              - button "Toggle" [ref=e89] [cursor=pointer]:
                - img [ref=e90]
                - generic [ref=e92]: Toggle
            - listitem [ref=e93]:
              - link "Large Solution" [ref=e94] [cursor=pointer]:
                - /url: /solution-trains
                - img [ref=e95]
                - generic [ref=e98]: Large Solution
              - button "Toggle" [ref=e99] [cursor=pointer]:
                - img [ref=e100]
                - generic [ref=e102]: Toggle
            - listitem [ref=e103]:
              - link "Integrações" [ref=e104] [cursor=pointer]:
                - /url: /integrations
                - img [ref=e105]
                - generic [ref=e111]: Integrações
              - button "Toggle" [ref=e112] [cursor=pointer]:
                - img [ref=e113]
                - generic [ref=e115]: Toggle
            - listitem [ref=e116]:
              - link "Settings" [ref=e117] [cursor=pointer]:
                - /url: /settings/workspace
                - img [ref=e118]
                - generic [ref=e121]: Settings
              - button "Toggle" [ref=e122] [cursor=pointer]:
                - img [ref=e123]
                - generic [ref=e125]: Toggle
        - list [ref=e128]:
          - listitem [ref=e129]:
            - link "Webhooks" [ref=e130] [cursor=pointer]:
              - /url: /webhooks
              - img [ref=e131]
              - generic [ref=e134]: Webhooks
          - listitem [ref=e135]:
            - link "Notificações" [ref=e136] [cursor=pointer]:
              - /url: /notifications
              - img [ref=e137]
              - generic [ref=e140]: Notificações
          - listitem [ref=e141]:
            - link "Exceções de Acesso" [ref=e142] [cursor=pointer]:
              - /url: /access-exceptions
              - img [ref=e143]
              - generic [ref=e145]: Exceções de Acesso
          - listitem [ref=e146]:
            - link "Perfil" [ref=e147] [cursor=pointer]:
              - /url: /profile
              - img [ref=e148]
              - generic [ref=e153]: Perfil
          - listitem [ref=e154]:
            - link "Suporte" [ref=e155] [cursor=pointer]:
              - /url: https://docs.cosmos.app
              - img [ref=e156]
              - generic [ref=e163]: Suporte
          - listitem [ref=e164]:
            - link "Feedback" [ref=e165] [cursor=pointer]:
              - /url: /feedback
              - img [ref=e166]
              - generic [ref=e169]: Feedback
      - list [ref=e171]:
        - listitem [ref=e172]:
          - button "Copilot ⌘K" [ref=e173] [cursor=pointer]:
            - img
            - text: Copilot ⌘K
          - link "Copilot fullscreen" [ref=e174] [cursor=pointer]:
            - /url: /copilot
            - img
        - listitem [ref=e175]:
          - button "AD Admin E2E admin@cosmos.local" [ref=e176] [cursor=pointer]:
            - generic [ref=e177]: AD
            - generic [ref=e178]:
              - generic [ref=e179]: Admin E2E
              - generic [ref=e180]: admin@cosmos.local
            - img [ref=e181]
          - generic [ref=e184]:
            - button "Toggle theme" [ref=e185] [cursor=pointer]:
              - img
              - img
              - generic [ref=e186]: Toggle theme
            - button "Open notification feed" [ref=e188] [cursor=pointer]:
              - img
    - main [ref=e189]:
      - generic [ref=e190]:
        - heading "Command Palette" [level=2] [ref=e191]
        - paragraph [ref=e192]: Search for a command to run...
      - generic [ref=e193]:
        - generic [ref=e194]:
          - generic [ref=e195]: C
          - generic [ref=e196]: COSMOSSAFe
        - img [ref=e197]
        - navigation "Breadcrumb" [ref=e199]:
          - generic [ref=e200]:
            - generic [ref=e201] [cursor=pointer]: COSMOS Dev
            - img [ref=e202]
          - generic [ref=e205] [cursor=pointer]: Dependencies
        - generic [ref=e206]:
          - group "Trocar persona" [ref=e207]:
            - button "RTE" [ref=e208] [cursor=pointer]: RTE
            - button "LPM" [pressed] [ref=e210] [cursor=pointer]: LPM
            - button "PO" [ref=e212] [cursor=pointer]: PO
            - button "SM" [ref=e214] [cursor=pointer]: SM
            - button "DEV" [ref=e216] [cursor=pointer]: DEV
          - button "Buscar" [ref=e218] [cursor=pointer]:
            - img [ref=e219]
          - generic "Admin E2E · admin@cosmos.local" [ref=e222]: AE
      - generic [ref=e223]:
        - generic [ref=e226]:
          - heading "Mapa de Dependências" [level=1] [ref=e227]
          - paragraph [ref=e228]: Bloqueios cruzados entre épicos. Linhas vermelhas indicam dependências não resolvidas que travam features downstream.
        - generic [ref=e230]:
          - generic [ref=e231]:
            - generic [ref=e232]:
              - img
              - img
              - img
              - generic [ref=e233]:
                - generic [ref=e234]: Dependências mapeadas
                - img [ref=e236]
              - generic [ref=e238]: "2"
              - generic [ref=e239]: — 4 features mapeadas
            - generic [ref=e240]:
              - img
              - img
              - img
              - generic [ref=e241]:
                - generic [ref=e242]: Em risco de bloqueio
                - img [ref=e244]
              - generic [ref=e246]: "0"
              - generic [ref=e247]: — travam entregas downstream
            - generic [ref=e248]:
              - img
              - img
              - img
              - generic [ref=e249]:
                - generic [ref=e250]: Sob controle
                - img [ref=e252]
              - generic [ref=e254]: "2"
              - generic [ref=e255]: — sem bloqueio ativo
            - generic [ref=e256]:
              - img
              - img
              - img
              - generic [ref=e257]:
                - generic [ref=e258]: Épicos envolvidos
                - img [ref=e260]
              - generic [ref=e262]: "2"
              - generic [ref=e263]: — entre 3 épicos
          - generic [ref=e264]:
            - generic [ref=e265]:
              - img [ref=e267]
              - generic [ref=e270]:
                - generic [ref=e271]: Dependências
                - generic [ref=e272]: Feature → Feature · 3 épicos
              - button "Mapear dependência" [ref=e274] [cursor=pointer]:
                - img [ref=e275]
                - text: Mapear dependência
            - generic [ref=e278]:
              - generic [ref=e279]:
                - generic [ref=e280]: Não iniciada
                - generic [ref=e282]: No prazo
                - generic [ref=e284]: Em risco
                - generic [ref=e286]: Bloqueada
                - generic [ref=e288]: Concluída
              - generic [ref=e290]:
                - generic [ref=e291]:
                  - generic [ref=e292]:
                    - generic [ref=e293]: CMR8J4F6
                    - generic [ref=e294]: Concluída
                    - generic [ref=e296]:
                      - img [ref=e297]
                      - text: Sem prazo definido
                  - generic [ref=e299]: Portfolio Kanban Board (5 colunas SAFe) bloqueia OKR Dashboard com Key Results
                  - generic [ref=e300]: OKR Dashboard requer Kanban Board concluído para exibir épicos vinculados a OKRs.
                  - generic [ref=e301]:
                    - link "Portfolio Kanban & OKR Dashboard Portfolio Kanban Board (5 colunas SAFe)" [ref=e302] [cursor=pointer]:
                      - /url: /features/cmr8j4f6n001ficpxxoeqpt7y
                      - img [ref=e304]
                      - generic [ref=e307]:
                        - generic [ref=e308]: Portfolio Kanban & OKR Dashboard
                        - text: Portfolio Kanban Board (5 colunas SAFe)
                    - img [ref=e309]
                    - link "Portfolio Kanban & OKR Dashboard OKR Dashboard com Key Results" [ref=e311] [cursor=pointer]:
                      - /url: /features/cmr8j4f6p001gicpxymfo8cop
                      - img [ref=e313]
                      - generic [ref=e316]:
                        - generic [ref=e317]: Portfolio Kanban & OKR Dashboard
                        - text: OKR Dashboard com Key Results
                  - generic [ref=e318]:
                    - generic [ref=e319]: technical
                    - generic [ref=e320]: high
                - generic [ref=e321]:
                  - generic [ref=e322]:
                    - generic [ref=e323]: CMR8J4F6
                    - generic [ref=e324]: No prazo
                    - generic [ref=e326]:
                      - img [ref=e327]
                      - text: 02 de ago.
                  - generic [ref=e329]: OKR Dashboard com Key Results bloqueia Risk Score Engine baseado em histórico de entregas
                  - generic [ref=e330]: Risk Score Engine depende dos dados de OKRs para calcular impacto de risco.
                  - generic [ref=e331]:
                    - link "Portfolio Kanban & OKR Dashboard OKR Dashboard com Key Results" [ref=e332] [cursor=pointer]:
                      - /url: /features/cmr8j4f6p001gicpxymfo8cop
                      - img [ref=e334]
                      - generic [ref=e337]:
                        - generic [ref=e338]: Portfolio Kanban & OKR Dashboard
                        - text: OKR Dashboard com Key Results
                    - img [ref=e339]
                    - link "AI-Powered Risk Copilot Risk Score Engine baseado em histórico de entregas" [ref=e341] [cursor=pointer]:
                      - /url: /features/cmr8j4f6r001hicpxhjdp2yn3
                      - img [ref=e343]
                      - generic [ref=e346]:
                        - generic [ref=e347]: AI-Powered Risk Copilot
                        - text: Risk Score Engine baseado em histórico de entregas
                  - generic [ref=e348]:
                    - generic [ref=e349]: business
                    - generic [ref=e350]: medium
    - button "Abrir Copilot AI" [ref=e353] [cursor=pointer]:
      - img [ref=e354]
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e364] [cursor=pointer]:
    - img [ref=e365]
  - alert [ref=e368]
```

# Test source

```ts
  1   | import AxeBuilder from "@axe-core/playwright";
  2   | import { expect, type Page, test } from "@playwright/test";
  3   | 
  4   | /**
  5   |  * Accessibility (a11y) audit using axe-core — extends a11y.spec.ts to cover
  6   |  * the ~26 screens re-skinned from cosmos.html that don't yet have a
  7   |  * dedicated a11y check.
  8   |  *
  9   |  * Rules: wcag2a + wcag2aa (WCAG 2.1 Level AA). Excludes known third-party
  10  |  * iframes (Liveblocks, etc.). Only fails on critical/serious violations —
  11  |  * moderate/minor are reported but not asserted, to keep this a signal for
  12  |  * real regressions rather than noise.
  13  |  *
  14  |  * Run: pnpm test:e2e -- --grep "a11y screens"
  15  |  */
  16  | const WCAG_TAGS = ["wcag2a", "wcag2aa"];
  17  | 
  18  | async function assertNoSeriousViolations(page: Page, label: string) {
  19  |   await page.waitForLoadState("networkidle").catch(() => undefined);
  20  | 
  21  |   const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).exclude("iframe").analyze();
  22  | 
  23  |   const serious = results.violations.filter(
  24  |     (v) => v.impact === "critical" || v.impact === "serious"
  25  |   );
  26  | 
  27  |   expect(
  28  |     serious,
  29  |     `[${label}] Critical/serious violations: ${JSON.stringify(serious, null, 2)}`
> 30  |   ).toEqual([]);
      |     ^ Error: [/dependencies] Critical/serious violations: [
  31  | }
  32  | 
  33  | const STATIC_ROUTES = [
  34  |   "/portfolio/wsjf",
  35  |   "/portfolio/themes",
  36  |   "/portfolio/strategy-map",
  37  |   "/portfolio/okrs",
  38  |   "/portfolio/budgets",
  39  |   "/portfolio/budgets/anomalies",
  40  |   "/portfolio/tags",
  41  |   "/portfolio/roadmap",
  42  |   "/portfolio/governance",
  43  |   "/portfolio/governance/decision-log",
  44  |   "/solution-trains",
  45  |   "/dependencies",
  46  |   "/risks",
  47  |   "/analytics/flow",
  48  |   "/analytics/velocity",
  49  |   "/analytics/measure-grow",
  50  |   "/teams",
  51  |   "/copilot",
  52  |   "/workflows",
  53  |   "/integrations",
  54  |   "/settings/audit",
  55  |   "/settings/integrations",
  56  |   "/settings/members",
  57  |   "/settings/reports",
  58  |   "/settings/roles",
  59  |   "/settings/sso",
  60  |   "/settings/workspace",
  61  | ];
  62  | 
  63  | test.describe("a11y screens — static routes @auth", () => {
  64  |   test.use({ storageState: "./e2e/fixtures/auth-session.json" });
  65  | 
  66  |   for (const route of STATIC_ROUTES) {
  67  |     test(`${route} has no critical/serious violations`, async ({ page }) => {
  68  |       await page.goto(route);
  69  |       await assertNoSeriousViolations(page, route);
  70  |     });
  71  |   }
  72  | });
  73  | 
  74  | test.describe("a11y screens — dynamic ART/Team routes @auth", () => {
  75  |   test.use({ storageState: "./e2e/fixtures/auth-session.json" });
  76  | 
  77  |   test("ART detail, Program Board and PI Planning have no critical/serious violations", async ({
  78  |     page,
  79  |   }) => {
  80  |     await page.goto("/arts");
  81  |     const artLink = page.locator('a[href^="/arts/"]').first();
  82  |     await artLink.waitFor({ timeout: 15_000 });
  83  |     const artUrl = await artLink.getAttribute("href");
  84  |     if (!artUrl) {
  85  |       throw new Error("No ART link found on /arts list");
  86  |     }
  87  | 
  88  |     await page.goto(artUrl);
  89  |     await assertNoSeriousViolations(page, "/arts/[artId]");
  90  | 
  91  |     await page.goto(`${artUrl}/program-board`);
  92  |     await assertNoSeriousViolations(page, "/arts/[artId]/program-board");
  93  | 
  94  |     await page.goto(`${artUrl}/pi-planning`);
  95  |     await assertNoSeriousViolations(page, "/arts/[artId]/pi-planning");
  96  |   });
  97  | 
  98  |   test("Team standup has no critical/serious violations", async ({ page }) => {
  99  |     await page.goto("/teams");
  100 |     const standupLink = page.locator('a[href*="/standup"]').first();
  101 |     await standupLink.waitFor({ timeout: 15_000 });
  102 |     await standupLink.click();
  103 | 
  104 |     await assertNoSeriousViolations(page, "/teams/[teamId]/standup");
  105 |   });
  106 | });
  107 | 
```