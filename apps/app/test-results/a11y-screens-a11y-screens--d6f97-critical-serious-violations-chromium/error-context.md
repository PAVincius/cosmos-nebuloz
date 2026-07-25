# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y-screens.spec.ts >> a11y screens — static routes @auth >> /copilot has no critical/serious violations
- Location: e2e/a11y-screens.spec.ts:67:9

# Error details

```
Error: [/copilot] Critical/serious violations: [
  {
    "id": "button-name",
    "impact": "critical",
    "tags": [
      "cat.name-role-value",
      "wcag2a",
      "wcag412",
      "section508",
      "section508.22.a",
      "TTv5",
      "TT6.a",
      "EN-301-549",
      "EN-9.4.1.2",
      "ACT",
      "RGAAv4",
      "RGAA-11.9.1"
    ],
    "description": "Ensure buttons have discernible text",
    "help": "Buttons must have discernible text",
    "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/button-name?application=playwright",
    "nodes": [
      {
        "any": [
          {
            "id": "button-has-visible-text",
            "data": null,
            "relatedNodes": [],
            "impact": "critical",
            "message": "Element does not have inner text that is visible to screen readers"
          },
          {
            "id": "aria-label",
            "data": null,
            "relatedNodes": [],
            "impact": "critical",
            "message": "aria-label attribute does not exist or is empty"
          },
          {
            "id": "aria-labelledby",
            "data": null,
            "relatedNodes": [],
            "impact": "critical",
            "message": "aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty"
          },
          {
            "id": "non-empty-title",
            "data": {
              "messageKey": "noAttr"
            },
            "relatedNodes": [],
            "impact": "critical",
            "message": "Element has no title attribute"
          },
          {
            "id": "implicit-label",
            "data": null,
            "relatedNodes": [],
            "impact": "critical",
            "message": "Element does not have an implicit (wrapped) <label>"
          },
          {
            "id": "explicit-label",
            "data": null,
            "relatedNodes": [],
            "impact": "critical",
            "message": "Element does not have an explicit <label>"
          },
          {
            "id": "presentational-role",
            "data": null,
            "relatedNodes": [],
            "impact": "critical",
            "message": "Element's default semantics were not overridden with role=\"none\" or role=\"presentation\""
          }
        ],
        "all": [],
        "none": [],
        "impact": "critical",
        "html": "<button data-slot=\"button\" class=\"inline-flex items-ce...\" disabled=\"\" type=\"button\">",
        "target": [
          ".text-primary-foreground"
        ],
        "failureSummary": "Fix any of the following:\n  Element does not have inner text that is visible to screen readers\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute\n  Element does not have an implicit (wrapped) <label>\n  Element does not have an explicit <label>\n  Element's default semantics were not overridden with role=\"none\" or role=\"presentation\""
      }
    ]
  }
]

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 95

- Array []
+ Array [
+   Object {
+     "description": "Ensure buttons have discernible text",
+     "help": "Buttons must have discernible text",
+     "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/button-name?application=playwright",
+     "id": "button-name",
+     "impact": "critical",
+     "nodes": Array [
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": null,
+             "id": "button-has-visible-text",
+             "impact": "critical",
+             "message": "Element does not have inner text that is visible to screen readers",
+             "relatedNodes": Array [],
+           },
+           Object {
+             "data": null,
+             "id": "aria-label",
+             "impact": "critical",
+             "message": "aria-label attribute does not exist or is empty",
+             "relatedNodes": Array [],
+           },
+           Object {
+             "data": null,
+             "id": "aria-labelledby",
+             "impact": "critical",
+             "message": "aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty",
+             "relatedNodes": Array [],
+           },
+           Object {
+             "data": Object {
+               "messageKey": "noAttr",
+             },
+             "id": "non-empty-title",
+             "impact": "critical",
+             "message": "Element has no title attribute",
+             "relatedNodes": Array [],
+           },
+           Object {
+             "data": null,
+             "id": "implicit-label",
+             "impact": "critical",
+             "message": "Element does not have an implicit (wrapped) <label>",
+             "relatedNodes": Array [],
+           },
+           Object {
+             "data": null,
+             "id": "explicit-label",
+             "impact": "critical",
+             "message": "Element does not have an explicit <label>",
+             "relatedNodes": Array [],
+           },
+           Object {
+             "data": null,
+             "id": "presentational-role",
+             "impact": "critical",
+             "message": "Element's default semantics were not overridden with role=\"none\" or role=\"presentation\"",
+             "relatedNodes": Array [],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element does not have inner text that is visible to screen readers
+   aria-label attribute does not exist or is empty
+   aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty
+   Element has no title attribute
+   Element does not have an implicit (wrapped) <label>
+   Element does not have an explicit <label>
+   Element's default semantics were not overridden with role=\"none\" or role=\"presentation\"",
+         "html": "<button data-slot=\"button\" class=\"inline-flex items-ce...\" disabled=\"\" type=\"button\">",
+         "impact": "critical",
+         "none": Array [],
+         "target": Array [
+           ".text-primary-foreground",
+         ],
+       },
+     ],
+     "tags": Array [
+       "cat.name-role-value",
+       "wcag2a",
+       "wcag412",
+       "section508",
+       "section508.22.a",
+       "TTv5",
+       "TT6.a",
+       "EN-301-549",
+       "EN-9.4.1.2",
+       "ACT",
+       "RGAAv4",
+       "RGAA-11.9.1",
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
          - generic [ref=e205] [cursor=pointer]: Copilot
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
      - generic [ref=e224]:
        - complementary [ref=e225]:
          - generic [ref=e226]:
            - generic [ref=e227]: Conversas
            - generic [ref=e228]:
              - button "Nova conversa" [ref=e229] [cursor=pointer]:
                - img
              - button "Recolher sidebar" [ref=e230] [cursor=pointer]:
                - img
          - generic [ref=e231]:
            - generic [ref=e232]:
              - paragraph [ref=e233]: Hoje
              - generic [ref=e234]:
                - button "Nova conversa" [ref=e235] [cursor=pointer]:
                  - img [ref=e236]
                  - paragraph [ref=e238]: Nova conversa
                - button "Nova conversa" [ref=e239] [cursor=pointer]:
                  - img [ref=e240]
                  - paragraph [ref=e242]: Nova conversa
                - button "Nova conversa" [ref=e243] [cursor=pointer]:
                  - img [ref=e244]
                  - paragraph [ref=e246]: Nova conversa
                - button "Nova conversa" [ref=e247] [cursor=pointer]:
                  - img [ref=e248]
                  - paragraph [ref=e250]: Nova conversa
                - button "Nova conversa" [ref=e251] [cursor=pointer]:
                  - img [ref=e252]
                  - paragraph [ref=e254]: Nova conversa
                - button "Nova conversa" [ref=e255] [cursor=pointer]:
                  - img [ref=e256]
                  - paragraph [ref=e258]: Nova conversa
            - generic [ref=e259]:
              - paragraph [ref=e260]: Ontem
              - generic [ref=e261]:
                - button "Nova conversa" [ref=e262] [cursor=pointer]:
                  - img [ref=e263]
                  - paragraph [ref=e265]: Nova conversa
                - button "Nova conversa" [ref=e266] [cursor=pointer]:
                  - img [ref=e267]
                  - paragraph [ref=e269]: Nova conversa
                - button "Nova conversa" [ref=e270] [cursor=pointer]:
                  - img [ref=e271]
                  - paragraph [ref=e273]: Nova conversa
                - button "Nova conversa" [ref=e274] [cursor=pointer]:
                  - img [ref=e275]
                  - paragraph [ref=e277]: Nova conversa
        - generic [ref=e279]:
          - generic [ref=e281]:
            - generic [ref=e282]:
              - generic [ref=e283]:
                - generic [ref=e284]:
                  - img [ref=e285]
                  - text: Modelo ORBIT
                - generic [ref=e288]: Conectado aos 16 módulos
                - link "Priorização Portfolio" [ref=e290] [cursor=pointer]:
                  - /url: /portfolio
                  - img [ref=e292]
                  - generic [ref=e295]:
                    - generic [ref=e296]: Priorização
                    - text: Portfolio
                - link "Planejamento PI Planning" [ref=e297] [cursor=pointer]:
                  - /url: /pi-planning
                  - img [ref=e299]
                  - generic [ref=e301]:
                    - generic [ref=e302]: Planejamento
                    - text: PI Planning
                - link "Governança Riscos" [ref=e303] [cursor=pointer]:
                  - /url: /risks
                  - img [ref=e305]
                  - generic [ref=e307]:
                    - generic [ref=e308]: Governança
                    - text: Riscos
              - heading "Copilot" [level=1] [ref=e309]
              - paragraph [ref=e310]: Seu copiloto de portfólio. Pergunte sobre saúde, riscos, custos e priorização — respostas fundamentadas nos dados do COSMOS.
            - generic [ref=e311]:
              - button "Sync KB" [ref=e312] [cursor=pointer]:
                - img
                - text: Sync KB
              - button "Nova conversa" [ref=e313] [cursor=pointer]:
                - img
                - text: Nova conversa
          - generic [ref=e314]:
            - img [ref=e316]
            - generic [ref=e321]:
              - paragraph [ref=e322]: SAFe AI Copilot
              - paragraph [ref=e323]: Faça uma pergunta ou use os atalhos abaixo para começar.
          - generic [ref=e324]:
            - button "Como está a saúde geral do ART?" [ref=e325] [cursor=pointer]
            - button "Quais são as principais prioridades desta semana?" [ref=e326] [cursor=pointer]
            - button "Mostre um resumo do portfólio" [ref=e327] [cursor=pointer]
          - generic [ref=e329]:
            - textbox "Mensagem para o Copilot" [ref=e332]:
              - paragraph [ref=e333]: Pergunte sobre seus dados...
            - generic [ref=e334]:
              - generic [ref=e335]:
                - button "Anexar documento (.txt, .md, .csv, .pdf)" [ref=e336] [cursor=pointer]:
                  - img
                - button "Global" [ref=e338] [cursor=pointer]
                - button "RTE" [ref=e339] [cursor=pointer]
                - button "LPM" [ref=e340] [cursor=pointer]
                - button "PM/PO" [ref=e341] [cursor=pointer]
                - button "Time" [ref=e342] [cursor=pointer]
                - button "SPC" [ref=e343] [cursor=pointer]
              - button [disabled]:
                - img
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e349] [cursor=pointer]:
    - img [ref=e350]
  - alert [ref=e353]
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
      |     ^ Error: [/copilot] Critical/serious violations: [
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