# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y-screens.spec.ts >> a11y screens — static routes @auth >> /settings/workspace has no critical/serious violations
- Location: e2e/a11y-screens.spec.ts:67:9

# Error details

```
Error: [/settings/workspace] Critical/serious violations: [
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
              "fontSize": "9.4pt (12.5px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div style=\"border: 1px solid var(--hairline); border-radius: 14px; background: var(--surface); overflow: hidden; box-shadow: rgba(255, 255, 255, 0.03) 0px 1px 0px inset, rgba(0, 0, 0, 0.9) 0px 12px 28px -22px;\">",
                "target": [
                  ".overflow-y-auto > div:nth-child(2) > div:nth-child(1)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<div style=\"font-size: 12.5px; color: var(--ink-subtle); margin-top: 2px;\">cosmos-dev · 1 membros</div>",
        "target": [
          ".overflow-y-auto > div:nth-child(2) > div:nth-child(1) > div:nth-child(2) > div:nth-child(1) > div > div:nth-child(2)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#7f8083",
              "bgColor": "#141a3d",
              "contrastRatio": 4.27,
              "fontSize": "8.6pt (11.5px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div class=\"rounded-md border border-hairline bg-surface-2\" style=\"display: flex; align-items: center; gap: 12px; padding: 10px 12px;\">",
                "target": [
                  ".overflow-y-auto > div:nth-child(2) > div:nth-child(2) > div:nth-child(1) > div:nth-child(2) > div > .bg-surface-2.border-hairline.border"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 4.27 (foreground color: #7f8083, background color: #141a3d, font size: 8.6pt (11.5px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<div class=\"truncate text-[11.5px] text-ink-subtle\">admin@cosmos.local</div>",
        "target": [
          ".text-ink-subtle.truncate.text-\\[11\\.5px\\]"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 4.27 (foreground color: #7f8083, background color: #141a3d, font size: 8.6pt (11.5px), font weight: normal). Expected contrast ratio of 4.5:1"
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
+               "fontSize": "9.4pt (12.5px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div style=\"border: 1px solid var(--hairline); border-radius: 14px; background: var(--surface); overflow: hidden; box-shadow: rgba(255, 255, 255, 0.03) 0px 1px 0px inset, rgba(0, 0, 0, 0.9) 0px 12px 28px -22px;\">",
+                 "target": Array [
+                   ".overflow-y-auto > div:nth-child(2) > div:nth-child(1)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<div style=\"font-size: 12.5px; color: var(--ink-subtle); margin-top: 2px;\">cosmos-dev · 1 membros</div>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".overflow-y-auto > div:nth-child(2) > div:nth-child(1) > div:nth-child(2) > div:nth-child(1) > div > div:nth-child(2)",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#141a3d",
+               "contrastRatio": 4.27,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#7f8083",
+               "fontSize": "8.6pt (11.5px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.27 (foreground color: #7f8083, background color: #141a3d, font size: 8.6pt (11.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"rounded-md border border-hairline bg-surface-2\" style=\"display: flex; align-items: center; gap: 12px; padding: 10px 12px;\">",
+                 "target": Array [
+                   ".overflow-y-auto > div:nth-child(2) > div:nth-child(2) > div:nth-child(1) > div:nth-child(2) > div > .bg-surface-2.border-hairline.border",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.27 (foreground color: #7f8083, background color: #141a3d, font size: 8.6pt (11.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<div class=\"truncate text-[11.5px] text-ink-subtle\">admin@cosmos.local</div>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".text-ink-subtle.truncate.text-\\[11\\.5px\\]",
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
          - generic [ref=e223] [cursor=pointer]: Workspace
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
        - generic [ref=e244]:
          - generic [ref=e245]:
            - generic [ref=e246]: COSMOS Dev
            - generic [ref=e247]: Plano Universe
            - link "Papéis Membros" [ref=e248] [cursor=pointer]:
              - /url: /settings/members
              - img [ref=e250]
              - generic [ref=e255]:
                - generic [ref=e256]: Papéis
                - text: Membros
            - link "Acesso Segurança & SSO" [ref=e257] [cursor=pointer]:
              - /url: /settings/sso
              - img [ref=e259]
              - generic [ref=e262]:
                - generic [ref=e263]: Acesso
                - text: Segurança & SSO
          - heading "Settings" [level=1] [ref=e264]
          - paragraph [ref=e265]: Configurações do workspace COSMOS Dev — membros, plano, segurança e a parametrização do framework SAFe.
        - generic [ref=e266]:
          - generic [ref=e267]:
            - link "Workspace" [ref=e268] [cursor=pointer]:
              - /url: /settings/workspace
              - img [ref=e269]
              - text: Workspace
            - link "Membros & papéis" [ref=e273] [cursor=pointer]:
              - /url: /settings/members
              - img [ref=e274]
              - text: Membros & papéis
            - link "Papéis & permissões" [ref=e279] [cursor=pointer]:
              - /url: /settings/roles
              - img [ref=e280]
              - text: Papéis & permissões
            - link "Segurança & SSO" [ref=e283] [cursor=pointer]:
              - /url: /settings/sso
              - img [ref=e284]
              - text: Segurança & SSO
            - link "Integrações" [ref=e287] [cursor=pointer]:
              - /url: /settings/integrations
              - img [ref=e288]
              - text: Integrações
            - link "Auditoria" [ref=e290] [cursor=pointer]:
              - /url: /settings/audit
              - img [ref=e291]
              - text: Auditoria
            - link "Plano & faturamento" [ref=e294] [cursor=pointer]:
              - /url: "#plano"
              - img [ref=e295]
              - text: Plano & faturamento
            - link "Notificações" [ref=e298] [cursor=pointer]:
              - /url: "#notificacoes"
              - img [ref=e299]
              - text: Notificações
          - generic [ref=e302]:
            - generic [ref=e303]:
              - generic [ref=e304]:
                - img [ref=e306]
                - generic [ref=e310]:
                  - generic [ref=e311]: Identidade do workspace
                  - generic [ref=e312]: Nome, plano e domínio
              - generic [ref=e313]:
                - generic [ref=e314]:
                  - generic [ref=e315]: CD
                  - generic [ref=e316]:
                    - generic [ref=e317]: COSMOS Dev
                    - generic [ref=e318]: cosmos-dev · 1 membros
                  - button "Trocar logo" [ref=e319] [cursor=pointer]:
                    - img [ref=e320]
                    - text: Trocar logo
                - generic [ref=e324]:
                  - generic [ref=e325]:
                    - generic [ref=e326]: Nome do workspace
                    - generic [ref=e327]: COSMOS Dev
                  - generic [ref=e328]:
                    - generic [ref=e329]: Domínio
                    - generic [ref=e330]: cosmos-dev
                  - generic [ref=e331]:
                    - generic [ref=e332]: Plano
                    - generic [ref=e333]: Universe
                  - generic [ref=e334]:
                    - generic [ref=e335]: Criado em
                    - generic [ref=e336]: jul. de 2026
            - generic [ref=e337]:
              - generic [ref=e338]:
                - generic [ref=e339]:
                  - img [ref=e341]
                  - generic [ref=e346]:
                    - generic [ref=e347]: Membros & papéis
                    - generic [ref=e348]: 1 de 1 mostrados
                  - button "Convidar" [ref=e350] [cursor=pointer]:
                    - img [ref=e351]
                    - text: Convidar
                - generic [ref=e354]:
                  - generic [ref=e355]: AE
                  - generic [ref=e356]:
                    - generic [ref=e357]: Admin E2E
                    - generic [ref=e358]: admin@cosmos.local
                  - generic [ref=e359]: Admin
              - generic [ref=e361]:
                - generic [ref=e362]:
                  - img [ref=e364]
                  - generic [ref=e367]:
                    - generic [ref=e368]: Notificações
                    - generic [ref=e369]: Como o COSMOS te avisa
                  - generic [ref=e371]: Em breve
                - generic [ref=e372]:
                  - generic [ref=e373]:
                    - generic [ref=e374]:
                      - generic [ref=e375]: Resumos semanais do portfólio por e-mail
                      - switch "Em breve" [checked] [disabled] [ref=e376]
                    - generic [ref=e377]:
                      - generic [ref=e378]: Alertas de risco crítico no Slack
                      - switch "Em breve" [checked] [disabled] [ref=e379]
                    - generic [ref=e380]:
                      - generic [ref=e381]: Notificar quando um gate aguarda minha decisão
                      - switch "Em breve" [checked] [disabled] [ref=e382]
                    - generic [ref=e383]:
                      - generic [ref=e384]: Digest diário de anomalias de custo
                      - switch "Em breve" [disabled] [ref=e385]
                  - paragraph [ref=e386]: Preferências de notificação chegam em breve — hoje o COSMOS usa os padrões acima.
            - generic [ref=e388]:
              - generic [ref=e389]:
                - img [ref=e391]
                - generic [ref=e394]:
                  - generic [ref=e395]: Plano & faturamento
                  - generic [ref=e396]: Seu plano atual e limites do workspace
              - generic [ref=e397]:
                - generic [ref=e398]:
                  - generic [ref=e399]:
                    - img [ref=e400]
                    - generic [ref=e402]: Plano Universe
                  - generic [ref=e403]: UNIVERSE
                - paragraph [ref=e404]: Plano enterprise — ilimitado, SLA dedicado
                - paragraph [ref=e405]: "Membros atuais: 1"
    - button "Abrir Copilot AI" [ref=e408] [cursor=pointer]:
      - img [ref=e409]
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e419] [cursor=pointer]:
    - img [ref=e420]
  - alert [ref=e423]
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
      |     ^ Error: [/settings/workspace] Critical/serious violations: [
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