# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y-screens.spec.ts >> a11y screens — static routes @auth >> /teams has no critical/serious violations
- Location: e2e/a11y-screens.spec.ts:67:9

# Error details

```
Error: [/teams] Critical/serious violations: [
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
              "fgColor": "#fafafa",
              "bgColor": "#336cfa",
              "contrastRatio": 4.31,
              "fontSize": "10.5pt (14px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<button class=\"relative inline-flex...\" type=\"button\">",
                "target": [
                  ".bg-primary"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 4.31 (foreground color: #fafafa, background color: #336cfa, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<button class=\"relative inline-flex...\" type=\"button\">",
        "target": [
          ".bg-primary"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 4.31 (foreground color: #fafafa, background color: #336cfa, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1"
      }
    ]
  }
]

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 58

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
+               "bgColor": "#336cfa",
+               "contrastRatio": 4.31,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#fafafa",
+               "fontSize": "10.5pt (14px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.31 (foreground color: #fafafa, background color: #336cfa, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<button class=\"relative inline-flex...\" type=\"button\">",
+                 "target": Array [
+                   ".bg-primary",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.31 (foreground color: #fafafa, background color: #336cfa, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<button class=\"relative inline-flex...\" type=\"button\">",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".bg-primary",
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
              - button "Toggle" [expanded] [ref=e69] [cursor=pointer]:
                - img [ref=e70]
                - generic [ref=e72]: Toggle
              - list [ref=e74]:
                - listitem [ref=e75]:
                  - link "Todos os Times" [ref=e76] [cursor=pointer]:
                    - /url: /teams
                    - generic [ref=e77]: Todos os Times
                - listitem [ref=e78]:
                  - list [ref=e79]:
                    - listitem [ref=e80]:
                      - link "Team Nebula" [ref=e81] [cursor=pointer]:
                        - /url: /teams/cmr8j4f5g0003icpx370whw3s
                        - generic [ref=e82]: Team Nebula
            - listitem [ref=e83]:
              - link "Analytics" [ref=e84] [cursor=pointer]:
                - /url: /analytics
                - img [ref=e85]
                - generic [ref=e87]: Analytics
              - button "Toggle" [ref=e88] [cursor=pointer]:
                - img [ref=e89]
                - generic [ref=e91]: Toggle
            - listitem [ref=e92]:
              - link "Workflows" [ref=e93] [cursor=pointer]:
                - /url: /workflows
                - img [ref=e94]
                - generic [ref=e98]: Workflows
              - button "Toggle" [ref=e99] [cursor=pointer]:
                - img [ref=e100]
                - generic [ref=e102]: Toggle
            - listitem [ref=e103]:
              - link "Large Solution" [ref=e104] [cursor=pointer]:
                - /url: /solution-trains
                - img [ref=e105]
                - generic [ref=e108]: Large Solution
              - button "Toggle" [ref=e109] [cursor=pointer]:
                - img [ref=e110]
                - generic [ref=e112]: Toggle
            - listitem [ref=e113]:
              - link "Integrações" [ref=e114] [cursor=pointer]:
                - /url: /integrations
                - img [ref=e115]
                - generic [ref=e121]: Integrações
              - button "Toggle" [ref=e122] [cursor=pointer]:
                - img [ref=e123]
                - generic [ref=e125]: Toggle
            - listitem [ref=e126]:
              - link "Settings" [ref=e127] [cursor=pointer]:
                - /url: /settings/workspace
                - img [ref=e128]
                - generic [ref=e131]: Settings
              - button "Toggle" [ref=e132] [cursor=pointer]:
                - img [ref=e133]
                - generic [ref=e135]: Toggle
        - list [ref=e138]:
          - listitem [ref=e139]:
            - link "Webhooks" [ref=e140] [cursor=pointer]:
              - /url: /webhooks
              - img [ref=e141]
              - generic [ref=e144]: Webhooks
          - listitem [ref=e145]:
            - link "Notificações" [ref=e146] [cursor=pointer]:
              - /url: /notifications
              - img [ref=e147]
              - generic [ref=e150]: Notificações
          - listitem [ref=e151]:
            - link "Exceções de Acesso" [ref=e152] [cursor=pointer]:
              - /url: /access-exceptions
              - img [ref=e153]
              - generic [ref=e155]: Exceções de Acesso
          - listitem [ref=e156]:
            - link "Perfil" [ref=e157] [cursor=pointer]:
              - /url: /profile
              - img [ref=e158]
              - generic [ref=e163]: Perfil
          - listitem [ref=e164]:
            - link "Suporte" [ref=e165] [cursor=pointer]:
              - /url: https://docs.cosmos.app
              - img [ref=e166]
              - generic [ref=e173]: Suporte
          - listitem [ref=e174]:
            - link "Feedback" [ref=e175] [cursor=pointer]:
              - /url: /feedback
              - img [ref=e176]
              - generic [ref=e179]: Feedback
      - list [ref=e181]:
        - listitem [ref=e182]:
          - button "Copilot ⌘K" [ref=e183] [cursor=pointer]:
            - img
            - text: Copilot ⌘K
          - link "Copilot fullscreen" [ref=e184] [cursor=pointer]:
            - /url: /copilot
            - img
        - listitem [ref=e185]:
          - button "AD Admin E2E admin@cosmos.local" [ref=e186] [cursor=pointer]:
            - generic [ref=e187]: AD
            - generic [ref=e188]:
              - generic [ref=e189]: Admin E2E
              - generic [ref=e190]: admin@cosmos.local
            - img [ref=e191]
          - generic [ref=e194]:
            - button "Toggle theme" [ref=e195] [cursor=pointer]:
              - img
              - img
              - generic [ref=e196]: Toggle theme
            - button "Open notification feed" [ref=e198] [cursor=pointer]:
              - img
    - main [ref=e199]:
      - generic [ref=e200]:
        - heading "Command Palette" [level=2] [ref=e201]
        - paragraph [ref=e202]: Search for a command to run...
      - generic [ref=e203]:
        - generic [ref=e204]:
          - generic [ref=e205]: C
          - generic [ref=e206]: COSMOSSAFe
        - img [ref=e207]
        - navigation "Breadcrumb" [ref=e209]:
          - generic [ref=e210]:
            - generic [ref=e211] [cursor=pointer]: COSMOS Dev
            - img [ref=e212]
          - generic [ref=e215] [cursor=pointer]: Teams
        - generic [ref=e216]:
          - group "Trocar persona" [ref=e217]:
            - button "RTE" [ref=e218] [cursor=pointer]: RTE
            - button "LPM" [pressed] [ref=e220] [cursor=pointer]: LPM
            - button "PO" [ref=e222] [cursor=pointer]: PO
            - button "SM" [ref=e224] [cursor=pointer]: SM
            - button "DEV" [ref=e226] [cursor=pointer]: DEV
          - button "Buscar" [ref=e228] [cursor=pointer]:
            - img [ref=e229]
          - generic "Admin E2E · admin@cosmos.local" [ref=e232]: AE
      - generic [ref=e233]:
        - generic [ref=e234]:
          - generic [ref=e235]:
            - generic [ref=e236]:
              - heading "Times" [level=1] [ref=e237]
              - paragraph [ref=e238]: Todos os times do workspace, agrupados por ART. Clique em um time para abrir o standup diário.
            - button "Novo Time" [ref=e240] [cursor=pointer]:
              - img [ref=e241]
              - text: Novo Time
          - generic [ref=e242]:
            - generic [ref=e243]:
              - generic [ref=e244]:
                - img [ref=e245]
                - text: Squads
              - generic [ref=e250]: "1"
            - generic [ref=e251]:
              - generic [ref=e252]: ARTs
              - generic [ref=e253]: "1"
            - generic [ref=e254]:
              - generic [ref=e255]: Impedimentos abertos
              - generic [ref=e256]: "2"
        - generic [ref=e258]:
          - generic [ref=e259]:
            - generic [ref=e260]:
              - img
              - img
              - img
              - generic [ref=e261]:
                - generic [ref=e262]: Times ativos
                - img [ref=e264]
              - generic [ref=e266]: "1"
              - generic [ref=e267]: — 1 ART
            - generic [ref=e268]:
              - img
              - img
              - img
              - generic [ref=e269]:
                - generic [ref=e270]: Membros
                - img [ref=e272]
              - generic [ref=e274]: "5"
              - generic [ref=e275]: — No workspace
            - generic [ref=e276]:
              - img
              - img
              - img
              - generic [ref=e277]:
                - generic [ref=e278]: Velocity média
                - img [ref=e280]
              - generic [ref=e282]: 40SP
              - generic [ref=e283]: — Por sprint
            - generic [ref=e284]:
              - img
              - img
              - img
              - generic [ref=e285]:
                - generic [ref=e286]: Impedimentos
                - img [ref=e288]
              - generic [ref=e290]: "2"
              - generic [ref=e291]: — Requer atenção
          - 'link "Team Nebula Plataforma COSMOS 2 bloqueios 40 Velocity 0 WIP 51% Flow eff Sprint goal: Entregar temas estratégicos, épicos e OKRs funcionais" [ref=e294] [cursor=pointer]':
            - /url: /teams/cmr8j4f5g0003icpx370whw3s/standup
            - generic [ref=e295]:
              - img [ref=e297]
              - generic [ref=e302]:
                - generic [ref=e303]: Team Nebula
                - generic [ref=e305]: Plataforma COSMOS
              - generic [ref=e306]: 2 bloqueios
            - generic [ref=e308]:
              - generic [ref=e309]:
                - generic [ref=e310]:
                  - generic [ref=e311]: "40"
                  - generic [ref=e312]: Velocity
                - generic [ref=e313]:
                  - generic [ref=e314]: "0"
                  - generic [ref=e315]: WIP
                - generic [ref=e316]:
                  - generic [ref=e317]: 51%
                  - generic [ref=e318]: Flow eff
              - generic [ref=e319]:
                - img [ref=e320]
                - generic [ref=e324]: "Sprint goal: Entregar temas estratégicos, épicos e OKRs funcionais"
    - button "Abrir Copilot AI" [ref=e327] [cursor=pointer]:
      - img [ref=e328]
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e338] [cursor=pointer]:
    - img [ref=e339]
  - alert [ref=e342]
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
      |     ^ Error: [/teams] Critical/serious violations: [
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