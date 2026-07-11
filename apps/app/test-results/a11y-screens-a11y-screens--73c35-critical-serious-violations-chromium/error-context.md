# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y-screens.spec.ts >> a11y screens — static routes @auth >> /solution-trains has no critical/serious violations
- Location: e2e/a11y-screens.spec.ts:67:9

# Error details

```
Error: [/solution-trains] Critical/serious violations: [
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
                "html": "<button data-slot=\"button\" class=\"inline-flex items-ce...\">",
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
        "html": "<button data-slot=\"button\" class=\"inline-flex items-ce...\">",
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
+                 "html": "<button data-slot=\"button\" class=\"inline-flex items-ce...\">",
+                 "target": Array [
+                   ".bg-primary",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.31 (foreground color: #fafafa, background color: #336cfa, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<button data-slot=\"button\" class=\"inline-flex items-ce...\">",
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
              - button "Toggle" [expanded] [ref=e99] [cursor=pointer]:
                - img [ref=e100]
                - generic [ref=e102]: Toggle
              - list [ref=e104]:
                - listitem [ref=e105]:
                  - link "Solution Trains" [ref=e106] [cursor=pointer]:
                    - /url: /solution-trains
                    - generic [ref=e107]: Solution Trains
                - listitem [ref=e108]:
                  - link "LACE" [ref=e109] [cursor=pointer]:
                    - /url: /lace
                    - generic [ref=e110]: LACE
                - listitem [ref=e111]:
                  - link "Fornecedores" [ref=e112] [cursor=pointer]:
                    - /url: /suppliers
                    - generic [ref=e113]: Fornecedores
            - listitem [ref=e114]:
              - link "Integrações" [ref=e115] [cursor=pointer]:
                - /url: /integrations
                - img [ref=e116]
                - generic [ref=e122]: Integrações
              - button "Toggle" [ref=e123] [cursor=pointer]:
                - img [ref=e124]
                - generic [ref=e126]: Toggle
            - listitem [ref=e127]:
              - link "Settings" [ref=e128] [cursor=pointer]:
                - /url: /settings/workspace
                - img [ref=e129]
                - generic [ref=e132]: Settings
              - button "Toggle" [ref=e133] [cursor=pointer]:
                - img [ref=e134]
                - generic [ref=e136]: Toggle
        - list [ref=e139]:
          - listitem [ref=e140]:
            - link "Webhooks" [ref=e141] [cursor=pointer]:
              - /url: /webhooks
              - img [ref=e142]
              - generic [ref=e145]: Webhooks
          - listitem [ref=e146]:
            - link "Notificações" [ref=e147] [cursor=pointer]:
              - /url: /notifications
              - img [ref=e148]
              - generic [ref=e151]: Notificações
          - listitem [ref=e152]:
            - link "Exceções de Acesso" [ref=e153] [cursor=pointer]:
              - /url: /access-exceptions
              - img [ref=e154]
              - generic [ref=e156]: Exceções de Acesso
          - listitem [ref=e157]:
            - link "Perfil" [ref=e158] [cursor=pointer]:
              - /url: /profile
              - img [ref=e159]
              - generic [ref=e164]: Perfil
          - listitem [ref=e165]:
            - link "Suporte" [ref=e166] [cursor=pointer]:
              - /url: https://docs.cosmos.app
              - img [ref=e167]
              - generic [ref=e174]: Suporte
          - listitem [ref=e175]:
            - link "Feedback" [ref=e176] [cursor=pointer]:
              - /url: /feedback
              - img [ref=e177]
              - generic [ref=e180]: Feedback
      - list [ref=e182]:
        - listitem [ref=e183]:
          - button "Copilot ⌘K" [ref=e184] [cursor=pointer]:
            - img
            - text: Copilot ⌘K
          - link "Copilot fullscreen" [ref=e185] [cursor=pointer]:
            - /url: /copilot
            - img
        - listitem [ref=e186]:
          - button "AD Admin E2E admin@cosmos.local" [ref=e187] [cursor=pointer]:
            - generic [ref=e188]: AD
            - generic [ref=e189]:
              - generic [ref=e190]: Admin E2E
              - generic [ref=e191]: admin@cosmos.local
            - img [ref=e192]
          - generic [ref=e195]:
            - button "Toggle theme" [ref=e196] [cursor=pointer]:
              - img
              - img
              - generic [ref=e197]: Toggle theme
            - button "Open notification feed" [ref=e199] [cursor=pointer]:
              - img
    - main [ref=e200]:
      - generic [ref=e201]:
        - heading "Command Palette" [level=2] [ref=e202]
        - paragraph [ref=e203]: Search for a command to run...
      - generic [ref=e204]:
        - generic [ref=e205]:
          - generic [ref=e206]: C
          - generic [ref=e207]: COSMOSSAFe
        - img [ref=e208]
        - navigation "Breadcrumb" [ref=e210]:
          - generic [ref=e211]:
            - generic [ref=e212] [cursor=pointer]: COSMOS Dev
            - img [ref=e213]
          - generic [ref=e216] [cursor=pointer]: Solution Trains
        - generic [ref=e217]:
          - group "Trocar persona" [ref=e218]:
            - button "RTE" [ref=e219] [cursor=pointer]: RTE
            - button "LPM" [pressed] [ref=e221] [cursor=pointer]: LPM
            - button "PO" [ref=e223] [cursor=pointer]: PO
            - button "SM" [ref=e225] [cursor=pointer]: SM
            - button "DEV" [ref=e227] [cursor=pointer]: DEV
          - button "Buscar" [ref=e229] [cursor=pointer]:
            - img [ref=e230]
          - generic "Admin E2E · admin@cosmos.local" [ref=e233]: AE
      - generic [ref=e234]:
        - generic [ref=e235]:
          - navigation "Navegação" [ref=e236]:
            - link "Voltar" [ref=e237] [cursor=pointer]:
              - /url: /portfolio
              - img [ref=e238]
            - link "Portfolio" [ref=e241] [cursor=pointer]:
              - /url: /portfolio
          - generic [ref=e242]:
            - generic [ref=e243]:
              - generic [ref=e245]: Large Solution · SAFe
              - heading "Solution Trains" [level=1] [ref=e246]
              - paragraph [ref=e247]: Agregação de múltiplos ARTs entregando uma solução conjunta. Composição e milestones.
            - generic [ref=e248]:
              - link "Ecossistema ARTs" [ref=e249] [cursor=pointer]:
                - /url: /arts
                - img [ref=e251]
                - generic [ref=e254]:
                  - generic [ref=e255]: Ecossistema
                  - text: ARTs
              - button "Novo Solution Train" [ref=e256] [cursor=pointer]:
                - img
                - text: Novo Solution Train
          - generic [ref=e257]:
            - generic [ref=e258]:
              - generic [ref=e259]:
                - img [ref=e260]
                - text: Solution Trains
              - generic [ref=e263]: "0"
            - generic [ref=e264]:
              - generic [ref=e265]:
                - img [ref=e266]
                - text: ARTs coordenados
              - generic [ref=e270]: "0"
            - generic [ref=e271]:
              - generic [ref=e272]:
                - img [ref=e273]
                - text: Capabilities
              - generic [ref=e275]: "0"
        - generic [ref=e276]:
          - generic [ref=e277]:
            - generic [ref=e278]:
              - img
              - img
              - img
              - generic [ref=e279]:
                - generic [ref=e280]: Solution Trains
                - img [ref=e282]
              - generic [ref=e284]: "0"
              - generic [ref=e285]: — No portfólio
            - generic [ref=e286]:
              - img
              - img
              - img
              - generic [ref=e287]:
                - generic [ref=e288]: Capabilities
                - img [ref=e290]
              - generic [ref=e292]: "0"
              - generic [ref=e293]: — Em entrega
            - generic [ref=e294]:
              - img
              - img
              - img
              - generic [ref=e295]:
                - generic [ref=e296]: Solution Epics
                - img [ref=e298]
              - generic [ref=e300]: "0"
              - generic [ref=e301]: — Em andamento
          - generic [ref=e302]:
            - img [ref=e303]
            - paragraph [ref=e306]: Nenhum Solution Train configurado ainda.
            - paragraph [ref=e307]: Crie um Solution Train para coordenar múltiplos ARTs em soluções de grande escala.
    - button "Abrir Copilot AI" [ref=e310] [cursor=pointer]:
      - img [ref=e311]
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e321] [cursor=pointer]:
    - img [ref=e322]
  - alert [ref=e325]
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
      |     ^ Error: [/solution-trains] Critical/serious violations: [
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