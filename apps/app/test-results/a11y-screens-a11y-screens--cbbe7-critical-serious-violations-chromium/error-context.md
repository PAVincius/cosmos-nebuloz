# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y-screens.spec.ts >> a11y screens — static routes @auth >> /analytics/measure-grow has no critical/serious violations
- Location: e2e/a11y-screens.spec.ts:67:9

# Error details

```
Error: [/analytics/measure-grow] Critical/serious violations: [
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
              "fgColor": "#696a73",
              "bgColor": "#0e1330",
              "contrastRatio": 3.38,
              "fontSize": "9.0pt (12px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div class=\"rounded-xl border border-hairline bg-surface shadow-[var(--card-shadow)] p-4\">",
                "target": [
                  ".rounded-xl.border-hairline.bg-surface:nth-child(1)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.38 (foreground color: #696a73, background color: #0e1330, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<p class=\"mt-2 line-clamp-2 text-muted-foreground/80 text-xs\">Liderança engajada com SAFe. OKRs visíveis mas não suficientemente conectados às métricas de time.</p>",
        "target": [
          ".rounded-xl.border-hairline.bg-surface:nth-child(1) > .line-clamp-2.text-muted-foreground\\/80.mt-2"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.38 (foreground color: #696a73, background color: #0e1330, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#696a73",
              "bgColor": "#0e1330",
              "contrastRatio": 3.38,
              "fontSize": "9.0pt (12px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div class=\"rounded-xl border border-hairline bg-surface shadow-[var(--card-shadow)] p-4\">",
                "target": [
                  ".rounded-xl.border-hairline.bg-surface:nth-child(2)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.38 (foreground color: #696a73, background color: #0e1330, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<p class=\"mt-2 line-clamp-2 text-muted-foreground/80 text-xs\">Time demonstra boas práticas de CI/CD e TDD, mas pair programming ainda é ad-hoc. Testes E2E ausentes da DoD.</p>",
        "target": [
          ".rounded-xl.border-hairline.bg-surface:nth-child(2) > .line-clamp-2.text-muted-foreground\\/80.mt-2"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.38 (foreground color: #696a73, background color: #0e1330, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1"
      }
    ]
  }
]

expect(received).toEqual(expected) // deep equality

- Expected  -   1
+ Received  + 128

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
+               "bgColor": "#0e1330",
+               "contrastRatio": 3.38,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#696a73",
+               "fontSize": "9.0pt (12px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.38 (foreground color: #696a73, background color: #0e1330, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"rounded-xl border border-hairline bg-surface shadow-[var(--card-shadow)] p-4\">",
+                 "target": Array [
+                   ".rounded-xl.border-hairline.bg-surface:nth-child(1)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.38 (foreground color: #696a73, background color: #0e1330, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<p class=\"mt-2 line-clamp-2 text-muted-foreground/80 text-xs\">Liderança engajada com SAFe. OKRs visíveis mas não suficientemente conectados às métricas de time.</p>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".rounded-xl.border-hairline.bg-surface:nth-child(1) > .line-clamp-2.text-muted-foreground\\/80.mt-2",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#0e1330",
+               "contrastRatio": 3.38,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#696a73",
+               "fontSize": "9.0pt (12px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.38 (foreground color: #696a73, background color: #0e1330, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"rounded-xl border border-hairline bg-surface shadow-[var(--card-shadow)] p-4\">",
+                 "target": Array [
+                   ".rounded-xl.border-hairline.bg-surface:nth-child(2)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.38 (foreground color: #696a73, background color: #0e1330, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<p class=\"mt-2 line-clamp-2 text-muted-foreground/80 text-xs\">Time demonstra boas práticas de CI/CD e TDD, mas pair programming ainda é ad-hoc. Testes E2E ausentes da DoD.</p>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".rounded-xl.border-hairline.bg-surface:nth-child(2) > .line-clamp-2.text-muted-foreground\\/80.mt-2",
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
              - button "Toggle" [expanded] [ref=e78] [cursor=pointer]:
                - img [ref=e79]
                - generic [ref=e81]: Toggle
              - list [ref=e83]:
                - listitem [ref=e84]:
                  - link "Métricas SAFe" [ref=e85] [cursor=pointer]:
                    - /url: /analytics
                    - generic [ref=e86]: Métricas SAFe
                - listitem [ref=e87]:
                  - link "Flow Metrics" [ref=e88] [cursor=pointer]:
                    - /url: /analytics/flow
                    - generic [ref=e89]: Flow Metrics
                - listitem [ref=e90]:
                  - link "Velocity" [ref=e91] [cursor=pointer]:
                    - /url: /analytics/velocity
                    - generic [ref=e92]: Velocity
                - listitem [ref=e93]:
                  - link "Measure & Grow" [ref=e94] [cursor=pointer]:
                    - /url: /analytics/measure-grow
                    - generic [ref=e95]: Measure & Grow
                - listitem [ref=e96]:
                  - link "Riscos ROAM" [ref=e97] [cursor=pointer]:
                    - /url: /risks
                    - generic [ref=e98]: Riscos ROAM
            - listitem [ref=e99]:
              - link "Workflows" [ref=e100] [cursor=pointer]:
                - /url: /workflows
                - img [ref=e101]
                - generic [ref=e105]: Workflows
              - button "Toggle" [ref=e106] [cursor=pointer]:
                - img [ref=e107]
                - generic [ref=e109]: Toggle
            - listitem [ref=e110]:
              - link "Large Solution" [ref=e111] [cursor=pointer]:
                - /url: /solution-trains
                - img [ref=e112]
                - generic [ref=e115]: Large Solution
              - button "Toggle" [ref=e116] [cursor=pointer]:
                - img [ref=e117]
                - generic [ref=e119]: Toggle
            - listitem [ref=e120]:
              - link "Integrações" [ref=e121] [cursor=pointer]:
                - /url: /integrations
                - img [ref=e122]
                - generic [ref=e128]: Integrações
              - button "Toggle" [ref=e129] [cursor=pointer]:
                - img [ref=e130]
                - generic [ref=e132]: Toggle
            - listitem [ref=e133]:
              - link "Settings" [ref=e134] [cursor=pointer]:
                - /url: /settings/workspace
                - img [ref=e135]
                - generic [ref=e138]: Settings
              - button "Toggle" [ref=e139] [cursor=pointer]:
                - img [ref=e140]
                - generic [ref=e142]: Toggle
        - list [ref=e145]:
          - listitem [ref=e146]:
            - link "Webhooks" [ref=e147] [cursor=pointer]:
              - /url: /webhooks
              - img [ref=e148]
              - generic [ref=e151]: Webhooks
          - listitem [ref=e152]:
            - link "Notificações" [ref=e153] [cursor=pointer]:
              - /url: /notifications
              - img [ref=e154]
              - generic [ref=e157]: Notificações
          - listitem [ref=e158]:
            - link "Exceções de Acesso" [ref=e159] [cursor=pointer]:
              - /url: /access-exceptions
              - img [ref=e160]
              - generic [ref=e162]: Exceções de Acesso
          - listitem [ref=e163]:
            - link "Perfil" [ref=e164] [cursor=pointer]:
              - /url: /profile
              - img [ref=e165]
              - generic [ref=e170]: Perfil
          - listitem [ref=e171]:
            - link "Suporte" [ref=e172] [cursor=pointer]:
              - /url: https://docs.cosmos.app
              - img [ref=e173]
              - generic [ref=e180]: Suporte
          - listitem [ref=e181]:
            - link "Feedback" [ref=e182] [cursor=pointer]:
              - /url: /feedback
              - img [ref=e183]
              - generic [ref=e186]: Feedback
      - list [ref=e188]:
        - listitem [ref=e189]:
          - button "Copilot ⌘K" [ref=e190] [cursor=pointer]:
            - img
            - text: Copilot ⌘K
          - link "Copilot fullscreen" [ref=e191] [cursor=pointer]:
            - /url: /copilot
            - img
        - listitem [ref=e192]:
          - button "AD Admin E2E admin@cosmos.local" [ref=e193] [cursor=pointer]:
            - generic [ref=e194]: AD
            - generic [ref=e195]:
              - generic [ref=e196]: Admin E2E
              - generic [ref=e197]: admin@cosmos.local
            - img [ref=e198]
          - generic [ref=e201]:
            - button "Toggle theme" [ref=e202] [cursor=pointer]:
              - img
              - img
              - generic [ref=e203]: Toggle theme
            - button "Open notification feed" [ref=e205] [cursor=pointer]:
              - img
    - main [ref=e206]:
      - generic [ref=e207]:
        - heading "Command Palette" [level=2] [ref=e208]
        - paragraph [ref=e209]: Search for a command to run...
      - generic [ref=e210]:
        - generic [ref=e211]:
          - generic [ref=e212]: C
          - generic [ref=e213]: COSMOSSAFe
        - img [ref=e214]
        - navigation "Breadcrumb" [ref=e216]:
          - generic [ref=e217]:
            - generic [ref=e218] [cursor=pointer]: COSMOS Dev
            - img [ref=e219]
          - generic [ref=e221]:
            - generic [ref=e222] [cursor=pointer]: Analytics
            - img [ref=e223]
          - generic [ref=e226] [cursor=pointer]: Measure Grow
        - generic [ref=e227]:
          - group "Trocar persona" [ref=e228]:
            - button "RTE" [ref=e229] [cursor=pointer]: RTE
            - button "LPM" [pressed] [ref=e231] [cursor=pointer]: LPM
            - button "PO" [ref=e233] [cursor=pointer]: PO
            - button "SM" [ref=e235] [cursor=pointer]: SM
            - button "DEV" [ref=e237] [cursor=pointer]: DEV
          - button "Buscar" [ref=e239] [cursor=pointer]:
            - img [ref=e240]
          - generic "Admin E2E · admin@cosmos.local" [ref=e243]: AE
      - generic [ref=e244]:
        - generic [ref=e245]:
          - navigation "Navegação" [ref=e246]:
            - link "Voltar" [ref=e247] [cursor=pointer]:
              - /url: /analytics
              - img [ref=e248]
            - link "Analytics" [ref=e251] [cursor=pointer]:
              - /url: /analytics
          - generic [ref=e252]:
            - generic [ref=e253]:
              - generic [ref=e254]:
                - generic [ref=e255]: 7 competências
                - generic [ref=e256]: 0 em evolução
                - generic [ref=e257]: Escala 1–5
              - heading "Measure & Grow" [level=1] [ref=e258]
              - paragraph [ref=e259]: Avalie as competências SAFe da organização e registre ações de melhoria ligadas às Flow Metrics.
            - button "Nova avaliação" [ref=e261] [cursor=pointer]:
              - img
              - text: Nova avaliação
          - generic [ref=e262]:
            - generic [ref=e263]:
              - generic [ref=e264]:
                - img [ref=e265]
                - text: Assessments
              - generic [ref=e267]: "2"
            - generic [ref=e268]:
              - generic [ref=e269]:
                - img [ref=e270]
                - text: Score Médio
              - generic [ref=e273]: 3.5/5
            - generic [ref=e274]:
              - generic [ref=e275]:
                - img [ref=e276]
                - text: Ações Abertas
              - generic [ref=e279]: "2"
        - generic [ref=e281]:
          - generic [ref=e282]:
            - generic [ref=e283]:
              - generic [ref=e284]:
                - img
                - img
                - img
                - generic [ref=e285]:
                  - generic [ref=e286]: Maturidade média
                  - img [ref=e288]
                - generic [ref=e290]: 3.5/5
                - generic [ref=e291]: — vs. ciclo anterior
              - generic [ref=e292]:
                - img
                - img
                - img
                - generic [ref=e293]:
                  - generic [ref=e294]: Competências evoluindo
                  - img [ref=e296]
                - generic [ref=e298]: 0/7
                - generic [ref=e299]: — desde o ciclo anterior
              - generic [ref=e300]:
                - img
                - img
                - img
                - generic [ref=e301]:
                  - generic [ref=e302]: Mais forte
                  - img [ref=e304]
                - generic [ref=e306]: 3.8/5
                - generic [ref=e307]: — Lean-Agile Leadership
              - generic [ref=e308]:
                - img
                - img
                - img
                - generic [ref=e309]:
                  - generic [ref=e310]: Maior oportunidade
                  - img [ref=e312]
                - generic [ref=e314]: 3.2/5
                - generic [ref=e315]: — Team & Technical Agility
            - generic [ref=e316]:
              - generic [ref=e317]:
                - generic [ref=e319]:
                  - generic [ref=e320]: Radar de competências
                  - generic [ref=e321]: Ciclo atual (sólido) vs. anterior (tracejado)
                - img [ref=e325]:
                  - generic [ref=e342]:
                    - generic [ref=e344]: TTA
                    - generic [ref=e347]: APD
                    - generic [ref=e350]: ESD
                    - generic [ref=e353]: LPM
                    - generic [ref=e356]: OA
                    - generic [ref=e359]: CLC
                    - generic [ref=e362]: LAL
                  - generic [ref=e364]:
                    - generic [ref=e366]: "0"
                    - generic [ref=e368]: "1"
                    - generic [ref=e370]: "2"
                    - generic [ref=e372]: "3"
                    - generic [ref=e374]: "4"
                    - generic [ref=e376]: "5"
              - generic [ref=e391]:
                - generic [ref=e393]:
                  - generic [ref=e394]: Detalhe por competência
                  - generic [ref=e395]: Nota e variação desde o ciclo anterior
                - generic [ref=e397]:
                  - generic [ref=e398]:
                    - generic [ref=e400]: Team & Technical Agility
                    - generic [ref=e403]: "3.2"
                    - generic [ref=e404]: —
                  - generic [ref=e405]:
                    - generic [ref=e407]: Agile Product Delivery
                    - generic [ref=e409]: "0.0"
                    - generic [ref=e410]: —
                  - generic [ref=e411]:
                    - generic [ref=e413]: Enterprise Solution Delivery
                    - generic [ref=e415]: "0.0"
                    - generic [ref=e416]: —
                  - generic [ref=e417]:
                    - generic [ref=e419]: Lean Portfolio Management
                    - generic [ref=e421]: "0.0"
                    - generic [ref=e422]: —
                  - generic [ref=e423]:
                    - generic [ref=e425]: Organizational Agility
                    - generic [ref=e427]: "0.0"
                    - generic [ref=e428]: —
                  - generic [ref=e429]:
                    - generic [ref=e431]: Continuous Learning Culture
                    - generic [ref=e433]: "0.0"
                    - generic [ref=e434]: —
                  - generic [ref=e435]:
                    - generic [ref=e437]: Lean-Agile Leadership
                    - generic [ref=e440]: "3.8"
                    - generic [ref=e441]: —
          - generic [ref=e442]:
            - tablist [ref=e443]:
              - tab "Assessments (2)" [selected] [ref=e444] [cursor=pointer]
              - tab "Ações de Melhoria (2)" [ref=e445] [cursor=pointer]
              - tab "Impacto Operacional" [ref=e446] [cursor=pointer]
            - tabpanel "Assessments (2)" [ref=e447]:
              - generic [ref=e448]:
                - paragraph [ref=e449]: Avalie as 7 competências SAFe para cada ART, time ou portfólio.
                - generic [ref=e450]:
                  - generic [ref=e451]:
                    - generic [ref=e452]:
                      - generic [ref=e453]: Lean-Agile Leadership
                      - generic [ref=e454]: 3.8/5
                    - paragraph [ref=e455]: ART — Plataforma COSMOS
                    - paragraph [ref=e456]: Acelerando
                    - paragraph [ref=e457]: Liderança engajada com SAFe. OKRs visíveis mas não suficientemente conectados às métricas de time.
                  - generic [ref=e458]:
                    - generic [ref=e459]:
                      - generic [ref=e460]: Team & Technical Agility
                      - generic [ref=e461]: 3.2/5
                    - paragraph [ref=e462]: Time — Team Nebula
                    - paragraph [ref=e463]: Prosperando
                    - paragraph [ref=e464]: Time demonstra boas práticas de CI/CD e TDD, mas pair programming ainda é ad-hoc. Testes E2E ausentes da DoD.
                    - generic [ref=e465]:
                      - generic [ref=e466]: Institucionalizar pair programming — mínimo 2h/semana por dev
                      - generic [ref=e467]: Adicionar testes E2E Playwright à Definition of Done
    - button "Abrir Copilot AI" [ref=e470] [cursor=pointer]:
      - img [ref=e471]
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e481] [cursor=pointer]:
    - img [ref=e482]
  - alert [ref=e485]
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
      |     ^ Error: [/analytics/measure-grow] Critical/serious violations: [
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