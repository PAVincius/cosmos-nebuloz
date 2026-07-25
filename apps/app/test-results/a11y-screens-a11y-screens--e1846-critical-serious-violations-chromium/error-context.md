# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y-screens.spec.ts >> a11y screens — static routes @auth >> /portfolio/roadmap has no critical/serious violations
- Location: e2e/a11y-screens.spec.ts:67:9

# Error details

```
Error: [/portfolio/roadmap] Critical/serious violations: [
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
        "html": "<button type=\"button\" role=\"combobox\" aria-expanded=\"false\" aria-autocomplete=\"none\" dir=\"ltr\" data-state=\"closed\" data-slot=\"select-trigger\" data-size=\"default\" class=\"border-input data-[p...\">",
        "target": [
          ".data-\\[placeholder\\]\\:text-muted-foreground.\\[\\&_svg\\:not\\(\\[class\\*\\=\\'text-\\'\\]\\)\\]\\:text-muted-foreground.dark\\:hover\\:bg-input\\/50:nth-child(1)"
        ],
        "failureSummary": "Fix any of the following:\n  Element does not have inner text that is visible to screen readers\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute\n  Element does not have an implicit (wrapped) <label>\n  Element does not have an explicit <label>\n  Element's default semantics were not overridden with role=\"none\" or role=\"presentation\""
      },
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
        "html": "<button type=\"button\" role=\"combobox\" aria-expanded=\"false\" aria-autocomplete=\"none\" dir=\"ltr\" data-state=\"closed\" data-slot=\"select-trigger\" data-size=\"default\" class=\"border-input data-[p...\">",
        "target": [
          ".data-\\[placeholder\\]\\:text-muted-foreground.\\[\\&_svg\\:not\\(\\[class\\*\\=\\'text-\\'\\]\\)\\]\\:text-muted-foreground.dark\\:hover\\:bg-input\\/50:nth-child(2)"
        ],
        "failureSummary": "Fix any of the following:\n  Element does not have inner text that is visible to screen readers\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute\n  Element does not have an implicit (wrapped) <label>\n  Element does not have an explicit <label>\n  Element's default semantics were not overridden with role=\"none\" or role=\"presentation\""
      }
    ]
  },
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
              "fontWeight": "bold",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div style=\"background: var(--surface); border: 1px solid var(--hairline); border-radius: var(--cosmos-r-lg); overflow: hidden;\">",
                "target": [
                  ".overflow-y-auto > div:nth-child(3)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<div style=\"border-bottom: 1px solid var(--hairline); border-right: 1px solid var(--hairline); color: var(--ink-subtle); font-size: 11px; font-weight: 700; letter-spacing: 0.04em; padding: 10px 14px; text-transform: uppercase;\">ART</div>",
        "target": [
          ".overflow-y-auto > div:nth-child(3) > div:nth-child(1) > div:nth-child(1)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1"
      }
    ]
  }
]

expect(received).toEqual(expected) // deep equality

- Expected  -   1
+ Received  + 256

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
+         "html": "<button type=\"button\" role=\"combobox\" aria-expanded=\"false\" aria-autocomplete=\"none\" dir=\"ltr\" data-state=\"closed\" data-slot=\"select-trigger\" data-size=\"default\" class=\"border-input data-[p...\">",
+         "impact": "critical",
+         "none": Array [],
+         "target": Array [
+           ".data-\\[placeholder\\]\\:text-muted-foreground.\\[\\&_svg\\:not\\(\\[class\\*\\=\\'text-\\'\\]\\)\\]\\:text-muted-foreground.dark\\:hover\\:bg-input\\/50:nth-child(1)",
+         ],
+       },
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
+         "html": "<button type=\"button\" role=\"combobox\" aria-expanded=\"false\" aria-autocomplete=\"none\" dir=\"ltr\" data-state=\"closed\" data-slot=\"select-trigger\" data-size=\"default\" class=\"border-input data-[p...\">",
+         "impact": "critical",
+         "none": Array [],
+         "target": Array [
+           ".data-\\[placeholder\\]\\:text-muted-foreground.\\[\\&_svg\\:not\\(\\[class\\*\\=\\'text-\\'\\]\\)\\]\\:text-muted-foreground.dark\\:hover\\:bg-input\\/50:nth-child(2)",
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
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div style=\"background: var(--surface); border: 1px solid var(--hairline); border-radius: var(--cosmos-r-lg); overflow: hidden;\">",
+                 "target": Array [
+                   ".overflow-y-auto > div:nth-child(3)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<div style=\"border-bottom: 1px solid var(--hairline); border-right: 1px solid var(--hairline); color: var(--ink-subtle); font-size: 11px; font-weight: 700; letter-spacing: 0.04em; padding: 10px 14px; text-transform: uppercase;\">ART</div>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".overflow-y-auto > div:nth-child(3) > div:nth-child(1) > div:nth-child(1)",
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
          - generic [ref=e241] [cursor=pointer]: Roadmap
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
              - generic [ref=e267]: Roadmap
          - generic [ref=e268]:
            - generic [ref=e269]:
              - heading "Roadmap Multi-PI" [level=1] [ref=e270]
              - paragraph [ref=e271]: Entregas por ART ao longo de 4 Program Increments. Cada barra é um épico posicionado pelo PI de início e duração.
            - generic [ref=e273]:
              - combobox [ref=e274] [cursor=pointer]:
                - generic: Todas as ARTs
                - img
              - combobox [ref=e275] [cursor=pointer]:
                - generic: Todos os status
                - img
              - button "Novo Item" [ref=e276] [cursor=pointer]:
                - img
                - text: Novo Item
          - generic [ref=e277]:
            - generic [ref=e278]:
              - generic [ref=e279]: Itens no horizonte
              - generic [ref=e280]: "4"
            - generic [ref=e281]:
              - generic [ref=e282]:
                - img [ref=e283]
                - text: Marcos
              - generic [ref=e285]: "1"
            - generic [ref=e286]:
              - generic [ref=e287]: PI atual
              - generic [ref=e288]: 2026-Q3
        - generic [ref=e289]:
          - generic [ref=e290]:
            - link "Estrutura ARTs" [ref=e291] [cursor=pointer]:
              - /url: /arts
              - img [ref=e293]
              - generic [ref=e297]:
                - generic [ref=e298]: Estrutura
                - text: ARTs
            - link "Backlog Épicos" [ref=e299] [cursor=pointer]:
              - /url: /epics
              - img [ref=e301]
              - generic [ref=e305]:
                - generic [ref=e306]: Backlog
                - text: Épicos
            - link "Execução PI Planning" [ref=e307] [cursor=pointer]:
              - /url: /pi-planning
              - img [ref=e309]
              - generic [ref=e313]:
                - generic [ref=e314]: Execução
                - text: PI Planning
          - generic [ref=e315]:
            - generic [ref=e318]: Entregue
            - generic [ref=e321]: Em execução
            - generic [ref=e324]: Planejado
            - generic [ref=e327]: Cancelado
            - generic [ref=e328]:
              - img [ref=e329]
              - generic [ref=e331]: Marco
          - generic [ref=e332]:
            - generic [ref=e333]:
              - generic [ref=e334]: ART
              - generic [ref=e335]: 2026-Q2
              - generic [ref=e336]:
                - text: 2026-Q3
                - generic [ref=e337]: PI atual
              - generic [ref=e338]: 2026-Q4
              - generic [ref=e339]: 2027-Q1
            - generic [ref=e340]:
              - generic [ref=e343]: Plataforma COSMOS
              - generic [ref=e344]:
                - generic [ref=e351]:
                  - link "Portfolio Kanban & OKR Dashboard — undefined" [ref=e352] [cursor=pointer]:
                    - /url: /epics/cmr8j4f6k001cicpxi2hp5yh3
                    - generic [ref=e354]: Portfolio Kanban & OKR Dashboard
                  - button "Excluir Portfolio Kanban & OKR Dashboard" [ref=e355] [cursor=pointer]:
                    - img [ref=e356]
                - generic [ref=e360]:
                  - link "AI-Powered Risk Copilot — undefined" [ref=e361] [cursor=pointer]:
                    - /url: /epics/cmr8j4f6l001dicpx8n08ujxx
                    - generic [ref=e363]: AI-Powered Risk Copilot
                  - button "Excluir AI-Powered Risk Copilot" [ref=e364] [cursor=pointer]:
                    - img [ref=e365]
                - generic [ref=e369]:
                  - generic [ref=e370]:
                    - img [ref=e371]
                    - generic [ref=e373]: GA Release 2026-Q3
                  - button "Excluir GA Release 2026-Q3" [ref=e374] [cursor=pointer]:
                    - img [ref=e375]
                - generic [ref=e379]:
                  - link "SAML SSO & SCIM Provisioning — undefined" [ref=e380] [cursor=pointer]:
                    - /url: /epics/cmr8j4f6m001eicpxlkj5zxe4
                    - generic [ref=e382]: SAML SSO & SCIM Provisioning
                  - button "Excluir SAML SSO & SCIM Provisioning" [ref=e383] [cursor=pointer]:
                    - img [ref=e384]
    - button "Abrir Copilot AI" [ref=e389] [cursor=pointer]:
      - img [ref=e390]
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e400] [cursor=pointer]:
    - img [ref=e401]
  - alert [ref=e404]
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
      |     ^ Error: [/portfolio/roadmap] Critical/serious violations: [
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