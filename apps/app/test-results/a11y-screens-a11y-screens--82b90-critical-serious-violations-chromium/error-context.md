# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y-screens.spec.ts >> a11y screens — static routes @auth >> /portfolio/strategy-map has no critical/serious violations
- Location: e2e/a11y-screens.spec.ts:67:9

# Error details

```
Error: [/portfolio/strategy-map] Critical/serious violations: [
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
                "html": "<button data-slot=\"button\" class=\"inline-flex items-ce...\" type=\"button\">",
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
        "html": "<button data-slot=\"button\" class=\"inline-flex items-ce...\" type=\"button\">",
        "target": [
          ".bg-primary"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 4.31 (foreground color: #fafafa, background color: #336cfa, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#6366f1",
              "bgColor": "#09090b",
              "contrastRatio": 4.45,
              "fontSize": "10.5pt (14px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div class=\"overflow-hidden rounded-xl border border-border/80 bg-card shadow-[var(--card-shadow)]\">",
                "target": [
                  "#theme-cmr8j4f5u000eicpxws48n077 > .border-border\\/80.bg-card.rounded-xl"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 4.45 (foreground color: #6366f1, background color: #09090b, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"cursor-text font-semibold text-sm\" title=\"Clique para renomear\" style=\"color: rgb(99, 102, 241);\">Acelerar time-to-market enterprise</span>",
        "target": [
          "#theme-cmr8j4f5u000eicpxws48n077 > .border-border\\/80.bg-card.rounded-xl > .hover\\:bg-muted\\/20.cursor-pointer.gap-3 > .flex-1.min-w-0 > .flex-wrap.gap-2.items-center > .cursor-text.font-semibold[title=\"Clique para renomear\"]"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 4.45 (foreground color: #6366f1, background color: #09090b, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1"
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
+                 "html": "<button data-slot=\"button\" class=\"inline-flex items-ce...\" type=\"button\">",
+                 "target": Array [
+                   ".bg-primary",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.31 (foreground color: #fafafa, background color: #336cfa, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<button data-slot=\"button\" class=\"inline-flex items-ce...\" type=\"button\">",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".bg-primary",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#09090b",
+               "contrastRatio": 4.45,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#6366f1",
+               "fontSize": "10.5pt (14px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.45 (foreground color: #6366f1, background color: #09090b, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"overflow-hidden rounded-xl border border-border/80 bg-card shadow-[var(--card-shadow)]\">",
+                 "target": Array [
+                   "#theme-cmr8j4f5u000eicpxws48n077 > .border-border\\/80.bg-card.rounded-xl",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.45 (foreground color: #6366f1, background color: #09090b, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"cursor-text font-semibold text-sm\" title=\"Clique para renomear\" style=\"color: rgb(99, 102, 241);\">Acelerar time-to-market enterprise</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "#theme-cmr8j4f5u000eicpxws48n077 > .border-border\\/80.bg-card.rounded-xl > .hover\\:bg-muted\\/20.cursor-pointer.gap-3 > .flex-1.min-w-0 > .flex-wrap.gap-2.items-center > .cursor-text.font-semibold[title=\"Clique para renomear\"]",
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
              - button "Toggle" [expanded] [ref=e43] [cursor=pointer]:
                - img [ref=e44]
                - generic [ref=e46]: Toggle
              - list [ref=e48]:
                - listitem [ref=e49]:
                  - link "Kanban de Épicos" [ref=e50] [cursor=pointer]:
                    - /url: /portfolio
                    - generic [ref=e51]: Kanban de Épicos
                - listitem [ref=e52]:
                  - link "WSJF Rankings" [ref=e53] [cursor=pointer]:
                    - /url: /portfolio/wsjf
                    - generic [ref=e54]: WSJF Rankings
                - listitem [ref=e55]:
                  - link "Temas Estratégicos" [ref=e56] [cursor=pointer]:
                    - /url: /portfolio/themes
                    - generic [ref=e57]: Temas Estratégicos
                - listitem [ref=e58]:
                  - link "Strategy Map" [ref=e59] [cursor=pointer]:
                    - /url: /portfolio/strategy-map
                    - generic [ref=e60]: Strategy Map
                - listitem [ref=e61]:
                  - link "OKRs" [ref=e62] [cursor=pointer]:
                    - /url: /portfolio/okrs
                    - generic [ref=e63]: OKRs
                - listitem [ref=e64]:
                  - link "Lean Budgets" [ref=e65] [cursor=pointer]:
                    - /url: /portfolio/budgets
                    - generic [ref=e66]: Lean Budgets
                - listitem [ref=e67]:
                  - link "Anomalias" [ref=e68] [cursor=pointer]:
                    - /url: /portfolio/budgets/anomalies
                    - generic [ref=e69]: Anomalias
                - listitem [ref=e70]:
                  - link "Roadmap" [ref=e71] [cursor=pointer]:
                    - /url: /portfolio/roadmap
                    - generic [ref=e72]: Roadmap
                - listitem [ref=e73]:
                  - link "Governance Board" [ref=e74] [cursor=pointer]:
                    - /url: /portfolio/governance
                    - generic [ref=e75]: Governance Board
                - listitem [ref=e76]:
                  - link "Decision Log" [ref=e77] [cursor=pointer]:
                    - /url: /portfolio/governance/decision-log
                    - generic [ref=e78]: Decision Log
            - listitem [ref=e79]:
              - link "ART Board" [ref=e80] [cursor=pointer]:
                - /url: /arts
                - img [ref=e81]
                - generic [ref=e88]: ART Board
              - button "Toggle" [ref=e89] [cursor=pointer]:
                - img [ref=e90]
                - generic [ref=e92]: Toggle
            - listitem [ref=e93]:
              - link "Times" [ref=e94] [cursor=pointer]:
                - /url: /teams
                - img [ref=e95]
                - generic [ref=e100]: Times
              - button "Toggle" [ref=e101] [cursor=pointer]:
                - img [ref=e102]
                - generic [ref=e104]: Toggle
            - listitem [ref=e105]:
              - link "Analytics" [ref=e106] [cursor=pointer]:
                - /url: /analytics
                - img [ref=e107]
                - generic [ref=e109]: Analytics
              - button "Toggle" [ref=e110] [cursor=pointer]:
                - img [ref=e111]
                - generic [ref=e113]: Toggle
            - listitem [ref=e114]:
              - link "Workflows" [ref=e115] [cursor=pointer]:
                - /url: /workflows
                - img [ref=e116]
                - generic [ref=e120]: Workflows
              - button "Toggle" [ref=e121] [cursor=pointer]:
                - img [ref=e122]
                - generic [ref=e124]: Toggle
            - listitem [ref=e125]:
              - link "Large Solution" [ref=e126] [cursor=pointer]:
                - /url: /solution-trains
                - img [ref=e127]
                - generic [ref=e130]: Large Solution
              - button "Toggle" [ref=e131] [cursor=pointer]:
                - img [ref=e132]
                - generic [ref=e134]: Toggle
            - listitem [ref=e135]:
              - link "Integrações" [ref=e136] [cursor=pointer]:
                - /url: /integrations
                - img [ref=e137]
                - generic [ref=e143]: Integrações
              - button "Toggle" [ref=e144] [cursor=pointer]:
                - img [ref=e145]
                - generic [ref=e147]: Toggle
            - listitem [ref=e148]:
              - link "Settings" [ref=e149] [cursor=pointer]:
                - /url: /settings/workspace
                - img [ref=e150]
                - generic [ref=e153]: Settings
              - button "Toggle" [ref=e154] [cursor=pointer]:
                - img [ref=e155]
                - generic [ref=e157]: Toggle
        - list [ref=e160]:
          - listitem [ref=e161]:
            - link "Webhooks" [ref=e162] [cursor=pointer]:
              - /url: /webhooks
              - img [ref=e163]
              - generic [ref=e166]: Webhooks
          - listitem [ref=e167]:
            - link "Notificações" [ref=e168] [cursor=pointer]:
              - /url: /notifications
              - img [ref=e169]
              - generic [ref=e172]: Notificações
          - listitem [ref=e173]:
            - link "Exceções de Acesso" [ref=e174] [cursor=pointer]:
              - /url: /access-exceptions
              - img [ref=e175]
              - generic [ref=e177]: Exceções de Acesso
          - listitem [ref=e178]:
            - link "Perfil" [ref=e179] [cursor=pointer]:
              - /url: /profile
              - img [ref=e180]
              - generic [ref=e185]: Perfil
          - listitem [ref=e186]:
            - link "Suporte" [ref=e187] [cursor=pointer]:
              - /url: https://docs.cosmos.app
              - img [ref=e188]
              - generic [ref=e195]: Suporte
          - listitem [ref=e196]:
            - link "Feedback" [ref=e197] [cursor=pointer]:
              - /url: /feedback
              - img [ref=e198]
              - generic [ref=e201]: Feedback
      - list [ref=e203]:
        - listitem [ref=e204]:
          - button "Copilot ⌘K" [ref=e205] [cursor=pointer]:
            - img
            - text: Copilot ⌘K
          - link "Copilot fullscreen" [ref=e206] [cursor=pointer]:
            - /url: /copilot
            - img
        - listitem [ref=e207]:
          - button "AD Admin E2E admin@cosmos.local" [ref=e208] [cursor=pointer]:
            - generic [ref=e209]: AD
            - generic [ref=e210]:
              - generic [ref=e211]: Admin E2E
              - generic [ref=e212]: admin@cosmos.local
            - img [ref=e213]
          - generic [ref=e216]:
            - button "Toggle theme" [ref=e217] [cursor=pointer]:
              - img
              - img
              - generic [ref=e218]: Toggle theme
            - button "Open notification feed" [ref=e220] [cursor=pointer]:
              - img
    - main [ref=e221]:
      - generic [ref=e222]:
        - heading "Command Palette" [level=2] [ref=e223]
        - paragraph [ref=e224]: Search for a command to run...
      - generic [ref=e225]:
        - generic [ref=e226]:
          - generic [ref=e227]: C
          - generic [ref=e228]: COSMOSSAFe
        - img [ref=e229]
        - navigation "Breadcrumb" [ref=e231]:
          - generic [ref=e232]:
            - generic [ref=e233] [cursor=pointer]: COSMOS Dev
            - img [ref=e234]
          - generic [ref=e236]:
            - generic [ref=e237] [cursor=pointer]: Portfolio
            - img [ref=e238]
          - generic [ref=e241] [cursor=pointer]: Strategy Map
        - generic [ref=e242]:
          - group "Trocar persona" [ref=e243]:
            - button "RTE" [ref=e244] [cursor=pointer]: RTE
            - button "LPM" [pressed] [ref=e246] [cursor=pointer]: LPM
            - button "PO" [ref=e248] [cursor=pointer]: PO
            - button "SM" [ref=e250] [cursor=pointer]: SM
            - button "DEV" [ref=e252] [cursor=pointer]: DEV
          - button "Buscar" [ref=e254] [cursor=pointer]:
            - img [ref=e255]
          - generic "Admin E2E · admin@cosmos.local" [ref=e258]: AE
      - generic [ref=e259]:
        - generic [ref=e260]:
          - navigation "Navegação" [ref=e261]:
            - link "Portfolio" [ref=e263] [cursor=pointer]:
              - /url: /portfolio
            - generic [ref=e264]:
              - img [ref=e265]
              - generic [ref=e267]: Strategy Map
          - generic [ref=e268]:
            - generic [ref=e269]:
              - heading "Strategy Map" [level=1] [ref=e270]
              - paragraph [ref=e271]: Árvore de Strategic Themes → Épicos. Clique no nome do tema para renomear; use o + para adicionar épicos.
            - generic [ref=e272]:
              - link "Gestão Temas Estratégicos" [ref=e273] [cursor=pointer]:
                - /url: /portfolio/themes
                - img [ref=e275]
                - generic [ref=e279]:
                  - generic [ref=e280]: Gestão
                  - text: Temas Estratégicos
              - link "Gestão OKRs" [ref=e281] [cursor=pointer]:
                - /url: /portfolio/okrs
                - img [ref=e283]
                - generic [ref=e287]:
                  - generic [ref=e288]: Gestão
                  - text: OKRs
              - button "Novo Tema" [ref=e289] [cursor=pointer]:
                - img
                - text: Novo Tema
          - generic [ref=e290]:
            - generic [ref=e291]:
              - generic [ref=e292]:
                - img [ref=e293]
                - text: Temas
              - generic [ref=e297]: "3"
            - generic [ref=e298]:
              - generic [ref=e299]:
                - img [ref=e300]
                - text: OKRs
              - generic [ref=e304]: "3"
            - generic [ref=e305]:
              - generic [ref=e306]:
                - img [ref=e307]
                - text: Épicos
              - generic [ref=e309]: "3"
        - generic [ref=e310]:
          - generic [ref=e311]:
            - generic [ref=e312]:
              - generic [ref=e313]:
                - text: P1
                - generic [ref=e314]: Resiliência de Plataforma
              - generic [ref=e315]:
                - generic [ref=e316]: Temas
                - link "Acelerar time-to-market enterprise" [ref=e317] [cursor=pointer]:
                  - /url: "#theme-cmr8j4f5u000eicpxws48n077"
                  - generic [ref=e319]: Acelerar time-to-market enterprise
              - generic [ref=e321]:
                - generic [ref=e322]: 1 épico
                - generic [ref=e323]: 82%
            - generic [ref=e326]:
              - generic [ref=e327]:
                - text: P2
                - generic [ref=e328]: Experiência sem Atrito
              - generic [ref=e329]:
                - generic [ref=e330]: Temas
                - link "Inovação com IA aplicada ao SAFe" [ref=e331] [cursor=pointer]:
                  - /url: "#theme-cmr8j4f5w000ficpxbxlh0e7t"
                  - generic [ref=e333]: Inovação com IA aplicada ao SAFe
              - generic [ref=e335]:
                - generic [ref=e336]: 1 épico
                - generic [ref=e337]: 29%
            - generic [ref=e340]:
              - generic [ref=e341]:
                - text: P3
                - generic [ref=e342]: Crescimento Orgânico
              - generic [ref=e343]:
                - generic [ref=e344]: Temas
                - link "Compliance & Segurança Enterprise" [ref=e345] [cursor=pointer]:
                  - /url: "#theme-cmr8j4f5x000gicpxc0q7ijk3"
                  - generic [ref=e347]: Compliance & Segurança Enterprise
              - generic [ref=e349]:
                - generic [ref=e350]: 1 épico
                - generic [ref=e351]: 37%
            - generic [ref=e354]:
              - generic [ref=e355]:
                - text: P4
                - generic [ref=e356]: IA Confiável
              - generic [ref=e357]:
                - generic [ref=e358]: Temas
                - paragraph [ref=e359]: Nenhum tema neste pilar.
              - generic [ref=e361]:
                - generic [ref=e362]: 0 épicos
                - generic [ref=e363]: 0%
          - generic [ref=e365]:
            - generic [ref=e367]:
              - generic [ref=e368] [cursor=pointer]:
                - img [ref=e370]
                - generic [ref=e374]:
                  - generic [ref=e375]: THEME-001
                  - generic "Clique para renomear" [ref=e376]: Acelerar time-to-market enterprise
                  - generic [ref=e377]: Ativo
                  - generic [ref=e378]: "2026"
                - generic [ref=e379]:
                  - generic [ref=e380]: 1 épico
                  - generic [ref=e384]: 82%
                  - generic [ref=e385]:
                    - button "Mudar cor do tema" [ref=e387]:
                      - img [ref=e388]
                    - button "Épico" [ref=e394]:
                      - img [ref=e395]
                      - text: Épico
                    - button "Excluir tema" [ref=e396]:
                      - img [ref=e397]
              - generic [ref=e400]:
                - generic [ref=e401]:
                  - generic [ref=e402]: OKRs do Tema
                  - generic [ref=e403]:
                    - img [ref=e404]
                    - generic [ref=e408]:
                      - generic [ref=e409]:
                        - generic [ref=e410]: Reduzir lead time de portfolio em 40%
                        - generic [ref=e411]: Tema
                      - paragraph [ref=e412]: "2026"
                      - generic [ref=e416]: 82%
                - generic [ref=e417]:
                  - generic [ref=e418]: Épicos (1)
                  - generic [ref=e420]:
                    - button "Remover do tema" [ref=e421] [cursor=pointer]:
                      - img [ref=e422]
                    - button "cmr8j4f6 IMPLEMENTING Portfolio Kanban & OKR Dashboard" [ref=e425] [cursor=pointer]:
                      - generic [ref=e426]:
                        - generic [ref=e427]: cmr8j4f6
                        - generic [ref=e428]: IMPLEMENTING
                      - generic [ref=e429]: Portfolio Kanban & OKR Dashboard
            - generic [ref=e431]:
              - generic [ref=e432] [cursor=pointer]:
                - img [ref=e434]
                - generic [ref=e438]:
                  - generic [ref=e439]: THEME-002
                  - generic "Clique para renomear" [ref=e440]: Inovação com IA aplicada ao SAFe
                  - generic [ref=e441]: Ativo
                  - generic [ref=e442]: H1 2026
                - generic [ref=e443]:
                  - generic [ref=e444]: 1 épico
                  - generic [ref=e448]: 29%
                  - generic [ref=e449]:
                    - button "Mudar cor do tema" [ref=e451]:
                      - img [ref=e452]
                    - button "Épico" [ref=e458]:
                      - img [ref=e459]
                      - text: Épico
                    - button "Excluir tema" [ref=e460]:
                      - img [ref=e461]
              - generic [ref=e464]:
                - generic [ref=e465]:
                  - generic [ref=e466]: OKRs do Tema
                  - generic [ref=e467]:
                    - img [ref=e468]
                    - generic [ref=e472]:
                      - generic [ref=e473]:
                        - generic [ref=e474]: Lançar 3 features de IA em produção
                        - generic [ref=e475]: Tema
                      - paragraph [ref=e476]: "2026"
                      - generic [ref=e480]: 29%
                - generic [ref=e481]:
                  - generic [ref=e482]: Épicos (1)
                  - generic [ref=e484]:
                    - button "Remover do tema" [ref=e485] [cursor=pointer]:
                      - img [ref=e486]
                    - button "cmr8j4f6 ANALYSIS AI-Powered Risk Copilot" [ref=e489] [cursor=pointer]:
                      - generic [ref=e490]:
                        - generic [ref=e491]: cmr8j4f6
                        - generic [ref=e492]: ANALYSIS
                      - generic [ref=e493]: AI-Powered Risk Copilot
            - generic [ref=e495]:
              - generic [ref=e496] [cursor=pointer]:
                - img [ref=e498]
                - generic [ref=e502]:
                  - generic [ref=e503]: THEME-003
                  - generic "Clique para renomear" [ref=e504]: Compliance & Segurança Enterprise
                  - generic [ref=e505]: Aprovado
                  - generic [ref=e506]: "2026"
                - generic [ref=e507]:
                  - generic [ref=e508]: 1 épico
                  - generic [ref=e512]: 37%
                  - generic [ref=e513]:
                    - button "Mudar cor do tema" [ref=e515]:
                      - img [ref=e516]
                    - button "Épico" [ref=e522]:
                      - img [ref=e523]
                      - text: Épico
                    - button "Excluir tema" [ref=e524]:
                      - img [ref=e525]
              - generic [ref=e528]:
                - generic [ref=e529]:
                  - generic [ref=e530]: OKRs do Tema
                  - generic [ref=e531]:
                    - img [ref=e532]
                    - generic [ref=e536]:
                      - generic [ref=e537]:
                        - generic [ref=e538]: Atingir SOC2 Type II + LGPD compliance pleno
                        - generic [ref=e539]: Tema
                      - paragraph [ref=e540]: "2026"
                      - generic [ref=e544]: 37%
                - generic [ref=e545]:
                  - generic [ref=e546]: Épicos (1)
                  - generic [ref=e548]:
                    - button "Remover do tema" [ref=e549] [cursor=pointer]:
                      - img [ref=e550]
                    - button "cmr8j4f6 BACKLOG SAML SSO & SCIM Provisioning" [ref=e553] [cursor=pointer]:
                      - generic [ref=e554]:
                        - generic [ref=e555]: cmr8j4f6
                        - generic [ref=e556]: BACKLOG
                      - generic [ref=e557]: SAML SSO & SCIM Provisioning
    - button "Abrir Copilot AI" [ref=e560] [cursor=pointer]:
      - img [ref=e561]
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e571] [cursor=pointer]:
    - generic [ref=e574]:
      - text: Compiling
      - generic [ref=e575]:
        - generic [ref=e576]: .
        - generic [ref=e577]: .
        - generic [ref=e578]: .
  - alert [ref=e579]
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
      |     ^ Error: [/portfolio/strategy-map] Critical/serious violations: [
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