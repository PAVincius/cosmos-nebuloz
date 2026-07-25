# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y-screens.spec.ts >> a11y screens — static routes @auth >> /settings/sso has no critical/serious violations
- Location: e2e/a11y-screens.spec.ts:67:9

# Error details

```
Error: [/settings/sso] Critical/serious violations: [
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
              - button "Toggle" [expanded] [ref=e122] [cursor=pointer]:
                - img [ref=e123]
                - generic [ref=e125]: Toggle
              - list [ref=e127]:
                - listitem [ref=e128]:
                  - link "Workspace" [ref=e129] [cursor=pointer]:
                    - /url: /settings/workspace
                    - generic [ref=e130]: Workspace
                - listitem [ref=e131]:
                  - link "Membros" [ref=e132] [cursor=pointer]:
                    - /url: /settings/members
                    - generic [ref=e133]: Membros
                - listitem [ref=e134]:
                  - link "Integrações" [ref=e135] [cursor=pointer]:
                    - /url: /settings/integrations
                    - generic [ref=e136]: Integrações
                - listitem [ref=e137]:
                  - link "Audit Log" [ref=e138] [cursor=pointer]:
                    - /url: /settings/audit
                    - generic [ref=e139]: Audit Log
        - list [ref=e142]:
          - listitem [ref=e143]:
            - link "Webhooks" [ref=e144] [cursor=pointer]:
              - /url: /webhooks
              - img [ref=e145]
              - generic [ref=e148]: Webhooks
          - listitem [ref=e149]:
            - link "Notificações" [ref=e150] [cursor=pointer]:
              - /url: /notifications
              - img [ref=e151]
              - generic [ref=e154]: Notificações
          - listitem [ref=e155]:
            - link "Exceções de Acesso" [ref=e156] [cursor=pointer]:
              - /url: /access-exceptions
              - img [ref=e157]
              - generic [ref=e159]: Exceções de Acesso
          - listitem [ref=e160]:
            - link "Perfil" [ref=e161] [cursor=pointer]:
              - /url: /profile
              - img [ref=e162]
              - generic [ref=e167]: Perfil
          - listitem [ref=e168]:
            - link "Suporte" [ref=e169] [cursor=pointer]:
              - /url: https://docs.cosmos.app
              - img [ref=e170]
              - generic [ref=e177]: Suporte
          - listitem [ref=e178]:
            - link "Feedback" [ref=e179] [cursor=pointer]:
              - /url: /feedback
              - img [ref=e180]
              - generic [ref=e183]: Feedback
      - list [ref=e185]:
        - listitem [ref=e186]:
          - button "Copilot ⌘K" [ref=e187] [cursor=pointer]:
            - img
            - text: Copilot ⌘K
          - link "Copilot fullscreen" [ref=e188] [cursor=pointer]:
            - /url: /copilot
            - img
        - listitem [ref=e189]:
          - button "AD Admin E2E admin@cosmos.local" [ref=e190] [cursor=pointer]:
            - generic [ref=e191]: AD
            - generic [ref=e192]:
              - generic [ref=e193]: Admin E2E
              - generic [ref=e194]: admin@cosmos.local
            - img [ref=e195]
          - generic [ref=e198]:
            - button "Toggle theme" [ref=e199] [cursor=pointer]:
              - img
              - img
              - generic [ref=e200]: Toggle theme
            - button "Open notification feed" [ref=e202] [cursor=pointer]:
              - img
    - main [ref=e203]:
      - generic [ref=e204]:
        - heading "Command Palette" [level=2] [ref=e205]
        - paragraph [ref=e206]: Search for a command to run...
      - generic [ref=e207]:
        - generic [ref=e208]:
          - generic [ref=e209]: C
          - generic [ref=e210]: COSMOSSAFe
        - img [ref=e211]
        - navigation "Breadcrumb" [ref=e213]:
          - generic [ref=e214]:
            - generic [ref=e215] [cursor=pointer]: COSMOS Dev
            - img [ref=e216]
          - generic [ref=e218]:
            - generic [ref=e219] [cursor=pointer]: Settings
            - img [ref=e220]
          - generic [ref=e223] [cursor=pointer]: Sso
        - generic [ref=e224]:
          - group "Trocar persona" [ref=e225]:
            - button "RTE" [ref=e226] [cursor=pointer]: RTE
            - button "LPM" [pressed] [ref=e228] [cursor=pointer]: LPM
            - button "PO" [ref=e230] [cursor=pointer]: PO
            - button "SM" [ref=e232] [cursor=pointer]: SM
            - button "DEV" [ref=e234] [cursor=pointer]: DEV
          - button "Buscar" [ref=e236] [cursor=pointer]:
            - img [ref=e237]
          - generic "Admin E2E · admin@cosmos.local" [ref=e240]: AE
      - generic [ref=e241]:
        - generic [ref=e242]:
          - navigation "Navegação" [ref=e243]:
            - link "Settings" [ref=e245] [cursor=pointer]:
              - /url: /settings/workspace
            - generic [ref=e246]:
              - img [ref=e247]
              - generic [ref=e249]: SSO / SAML
          - generic [ref=e251]:
            - heading "SSO / SAML" [level=1] [ref=e252]
            - paragraph [ref=e253]: Configure Single Sign-On via SAML 2.0 para autenticação corporativa
          - generic [ref=e255]:
            - generic [ref=e256]:
              - img [ref=e257]
              - text: SSO
            - generic [ref=e259]: Desativado
        - generic [ref=e261]:
          - generic [ref=e262]:
            - generic [ref=e263]: SSO/SAML
            - combobox "SSO/SAML" [ref=e264] [cursor=pointer]:
              - generic: Desativado
              - img
          - generic [ref=e265]:
            - generic [ref=e266]: URL de Metadados do IdP
            - textbox "URL de Metadados do IdP" [ref=e267]:
              - /placeholder: https://idp.example.com/saml/metadata
          - generic [ref=e268]:
            - generic [ref=e269]: Entity ID do IdP
            - textbox "Entity ID do IdP" [ref=e270]:
              - /placeholder: https://idp.example.com
          - generic [ref=e271]:
            - generic [ref=e272]: Entity ID do SP (COSMOS)
            - textbox "Entity ID do SP (COSMOS)" [ref=e273]:
              - /placeholder: https://app.cosmos.example.com
          - generic [ref=e274]:
            - generic [ref=e275]: Certificado X.509 do IdP
            - textbox "Certificado X.509 do IdP" [ref=e276]:
              - /placeholder: "-----BEGIN CERTIFICATE----- ... -----END CERTIFICATE-----"
          - button "Salvar configuração" [ref=e277] [cursor=pointer]
    - button "Abrir Copilot AI" [ref=e280] [cursor=pointer]:
      - img [ref=e281]
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e291] [cursor=pointer]:
    - img [ref=e292]
  - alert [ref=e295]
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
      |     ^ Error: [/settings/sso] Critical/serious violations: [
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