# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y-screens.spec.ts >> a11y screens — static routes @auth >> /portfolio/budgets has no critical/serious violations
- Location: e2e/a11y-screens.spec.ts:67:9

# Error details

```
Error: [/portfolio/budgets] Critical/serious violations: [
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
              "fgColor": "#ffffff",
              "bgColor": "#94a3b8",
              "contrastRatio": 2.56,
              "fontSize": "7.1pt (9.5px)",
              "fontWeight": "bold",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div class=\"flex items-center justify-center overflow-hidden whitespace-nowrap px-1.5 font-mono text-[9.5px] font-bold text-white\" title=\"Sem Tema: R$&nbsp;500.000\" style=\"width: 100%; background: rgb(148, 163, 184);\">Sem Tema</div>",
                "target": [
                  "div[title=\"Sem Tema: R$ 500.000\"]"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 2.56 (foreground color: #ffffff, background color: #94a3b8, font size: 7.1pt (9.5px), font weight: bold). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<div class=\"flex items-center justify-center overflow-hidden whitespace-nowrap px-1.5 font-mono text-[9.5px] font-bold text-white\" title=\"Sem Tema: R$&nbsp;500.000\" style=\"width: 100%; background: rgb(148, 163, 184);\">Sem Tema</div>",
        "target": [
          "div[title=\"Sem Tema: R$ 500.000\"]"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 2.56 (foreground color: #ffffff, background color: #94a3b8, font size: 7.1pt (9.5px), font weight: bold). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#46566d",
              "bgColor": "#141a3d",
              "contrastRatio": 2.25,
              "fontSize": "7.5pt (10px)",
              "fontWeight": "bold",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: left; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Value Stream</th>",
                "target": [
                  "div:nth-child(5) > table > thead > tr > th:nth-child(1)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: left; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Value Stream</th>",
        "target": [
          "div:nth-child(5) > table > thead > tr > th:nth-child(1)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#46566d",
              "bgColor": "#141a3d",
              "contrastRatio": 2.25,
              "fontSize": "7.5pt (10px)",
              "fontWeight": "bold",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: left; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Período</th>",
                "target": [
                  "div:nth-child(5) > table > thead > tr > th:nth-child(2)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: left; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Período</th>",
        "target": [
          "div:nth-child(5) > table > thead > tr > th:nth-child(2)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#46566d",
              "bgColor": "#141a3d",
              "contrastRatio": 2.25,
              "fontSize": "7.5pt (10px)",
              "fontWeight": "bold",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: left; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Consumido vs. guardrail</th>",
                "target": [
                  "div:nth-child(5) > table > thead > tr > th:nth-child(3)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: left; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Consumido vs. guardrail</th>",
        "target": [
          "div:nth-child(5) > table > thead > tr > th:nth-child(3)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#46566d",
              "bgColor": "#141a3d",
              "contrastRatio": 2.25,
              "fontSize": "7.5pt (10px)",
              "fontWeight": "bold",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: left; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Guardrail</th>",
                "target": [
                  "div:nth-child(5) > table > thead > tr > th:nth-child(4)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: left; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Guardrail</th>",
        "target": [
          "div:nth-child(5) > table > thead > tr > th:nth-child(4)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#65748b",
              "bgColor": "#141a3d",
              "contrastRatio": 3.55,
              "fontSize": "8.3pt (11px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div class=\"rounded-cosmos-md border border-hairline bg-surface-2 p-4\">",
                "target": [
                  ".sm\\:grid-cols-2 > .p-4.bg-surface-2.border-hairline"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.55 (foreground color: #65748b, background color: #141a3d, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span style=\"font-size: 11px; color: var(--ink-subtle); text-align: center;\">0%</span>",
        "target": [
          "div > span:nth-child(3)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.55 (foreground color: #65748b, background color: #141a3d, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#46566d",
              "bgColor": "#141a3d",
              "contrastRatio": 2.25,
              "fontSize": "7.5pt (10px)",
              "fontWeight": "bold",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: left; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Período</th>",
                "target": [
                  "div:nth-child(7) > table > thead > tr > th:nth-child(1)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: left; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Período</th>",
        "target": [
          "div:nth-child(7) > table > thead > tr > th:nth-child(1)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#46566d",
              "bgColor": "#141a3d",
              "contrastRatio": 2.25,
              "fontSize": "7.5pt (10px)",
              "fontWeight": "bold",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: right; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Total Alocado</th>",
                "target": [
                  "div:nth-child(7) > table > thead > tr > th:nth-child(2)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: right; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Total Alocado</th>",
        "target": [
          "div:nth-child(7) > table > thead > tr > th:nth-child(2)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#46566d",
              "bgColor": "#141a3d",
              "contrastRatio": 2.25,
              "fontSize": "7.5pt (10px)",
              "fontWeight": "bold",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: right; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Total Gasto</th>",
                "target": [
                  "div:nth-child(7) > table > thead > tr > th:nth-child(3)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: right; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Total Gasto</th>",
        "target": [
          "div:nth-child(7) > table > thead > tr > th:nth-child(3)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#46566d",
              "bgColor": "#141a3d",
              "contrastRatio": 2.25,
              "fontSize": "7.5pt (10px)",
              "fontWeight": "bold",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: right; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Utilização</th>",
                "target": [
                  "div:nth-child(7) > table > thead > tr > th:nth-child(4)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: right; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Utilização</th>",
        "target": [
          "div:nth-child(7) > table > thead > tr > th:nth-child(4)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1"
      }
    ]
  }
]

expect(received).toEqual(expected) // deep equality

- Expected  -   1
+ Received  + 373

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
+               "bgColor": "#94a3b8",
+               "contrastRatio": 2.56,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#ffffff",
+               "fontSize": "7.1pt (9.5px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.56 (foreground color: #ffffff, background color: #94a3b8, font size: 7.1pt (9.5px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"flex items-center justify-center overflow-hidden whitespace-nowrap px-1.5 font-mono text-[9.5px] font-bold text-white\" title=\"Sem Tema: R$&nbsp;500.000\" style=\"width: 100%; background: rgb(148, 163, 184);\">Sem Tema</div>",
+                 "target": Array [
+                   "div[title=\"Sem Tema: R$ 500.000\"]",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.56 (foreground color: #ffffff, background color: #94a3b8, font size: 7.1pt (9.5px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<div class=\"flex items-center justify-center overflow-hidden whitespace-nowrap px-1.5 font-mono text-[9.5px] font-bold text-white\" title=\"Sem Tema: R$&nbsp;500.000\" style=\"width: 100%; background: rgb(148, 163, 184);\">Sem Tema</div>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div[title=\"Sem Tema: R$ 500.000\"]",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#141a3d",
+               "contrastRatio": 2.25,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#46566d",
+               "fontSize": "7.5pt (10px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: left; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Value Stream</th>",
+                 "target": Array [
+                   "div:nth-child(5) > table > thead > tr > th:nth-child(1)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: left; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Value Stream</th>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(5) > table > thead > tr > th:nth-child(1)",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#141a3d",
+               "contrastRatio": 2.25,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#46566d",
+               "fontSize": "7.5pt (10px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: left; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Período</th>",
+                 "target": Array [
+                   "div:nth-child(5) > table > thead > tr > th:nth-child(2)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: left; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Período</th>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(5) > table > thead > tr > th:nth-child(2)",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#141a3d",
+               "contrastRatio": 2.25,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#46566d",
+               "fontSize": "7.5pt (10px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: left; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Consumido vs. guardrail</th>",
+                 "target": Array [
+                   "div:nth-child(5) > table > thead > tr > th:nth-child(3)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: left; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Consumido vs. guardrail</th>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(5) > table > thead > tr > th:nth-child(3)",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#141a3d",
+               "contrastRatio": 2.25,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#46566d",
+               "fontSize": "7.5pt (10px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: left; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Guardrail</th>",
+                 "target": Array [
+                   "div:nth-child(5) > table > thead > tr > th:nth-child(4)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: left; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Guardrail</th>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(5) > table > thead > tr > th:nth-child(4)",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#141a3d",
+               "contrastRatio": 3.55,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#65748b",
+               "fontSize": "8.3pt (11px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.55 (foreground color: #65748b, background color: #141a3d, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"rounded-cosmos-md border border-hairline bg-surface-2 p-4\">",
+                 "target": Array [
+                   ".sm\\:grid-cols-2 > .p-4.bg-surface-2.border-hairline",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.55 (foreground color: #65748b, background color: #141a3d, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span style=\"font-size: 11px; color: var(--ink-subtle); text-align: center;\">0%</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div > span:nth-child(3)",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#141a3d",
+               "contrastRatio": 2.25,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#46566d",
+               "fontSize": "7.5pt (10px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: left; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Período</th>",
+                 "target": Array [
+                   "div:nth-child(7) > table > thead > tr > th:nth-child(1)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: left; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Período</th>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(7) > table > thead > tr > th:nth-child(1)",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#141a3d",
+               "contrastRatio": 2.25,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#46566d",
+               "fontSize": "7.5pt (10px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: right; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Total Alocado</th>",
+                 "target": Array [
+                   "div:nth-child(7) > table > thead > tr > th:nth-child(2)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: right; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Total Alocado</th>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(7) > table > thead > tr > th:nth-child(2)",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#141a3d",
+               "contrastRatio": 2.25,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#46566d",
+               "fontSize": "7.5pt (10px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: right; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Total Gasto</th>",
+                 "target": Array [
+                   "div:nth-child(7) > table > thead > tr > th:nth-child(3)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: right; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Total Gasto</th>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(7) > table > thead > tr > th:nth-child(3)",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#141a3d",
+               "contrastRatio": 2.25,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#46566d",
+               "fontSize": "7.5pt (10px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: right; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Utilização</th>",
+                 "target": Array [
+                   "div:nth-child(7) > table > thead > tr > th:nth-child(4)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<th class=\"whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]\" style=\"text-align: right; color: var(--ink-faint); border-color: var(--hairline); background: var(--surface-2);\">Utilização</th>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(7) > table > thead > tr > th:nth-child(4)",
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
          - generic [ref=e241] [cursor=pointer]: Budgets
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
              - generic [ref=e267]: Lean Budget
          - generic [ref=e268]:
            - generic [ref=e269]:
              - heading "Lean Budget" [level=1] [ref=e270]
              - paragraph [ref=e271]: Custo real de nuvem mapeado para Temas SAFe.
            - generic [ref=e273]:
              - link "Guardrails Anomalias" [ref=e274] [cursor=pointer]:
                - /url: /portfolio/budgets/anomalies
                - img [ref=e276]
                - generic [ref=e278]:
                  - generic [ref=e279]: Guardrails
                  - text: Anomalias
              - link "FinOps Custo de Nuvem" [ref=e280] [cursor=pointer]:
                - /url: /portfolio/finops
                - img [ref=e282]
                - generic [ref=e285]:
                  - generic [ref=e286]: FinOps
                  - text: Custo de Nuvem
        - generic [ref=e288]:
          - generic [ref=e289]:
            - paragraph [ref=e290]: Conecte um provedor de billing para ver custos reais
            - generic [ref=e291]:
              - link "Conectar AWS" [ref=e292] [cursor=pointer]:
                - /url: /settings/integrations?provider=billing_aws
              - link "Conectar GCP" [ref=e293] [cursor=pointer]:
                - /url: /settings/integrations?provider=billing_gcp
              - link "Conectar Azure" [ref=e294] [cursor=pointer]:
                - /url: /settings/integrations?provider=billing_azure
          - generic [ref=e295]:
            - generic [ref=e296]:
              - img
              - img
              - img
              - generic [ref=e297]:
                - generic [ref=e298]: Planejado MTD
                - img [ref=e300]
              - generic [ref=e302]: US$ 0,00
              - generic [ref=e303]: — custo planejado do mês
            - generic [ref=e304]:
              - img
              - img
              - img
              - generic [ref=e305]:
                - generic [ref=e306]: Real MTD
                - img [ref=e308]
              - generic [ref=e310]: US$ 0,00
              - generic [ref=e311]: — custo real de nuvem
            - generic [ref=e312]:
              - img
              - img
              - img
              - generic [ref=e313]:
                - generic [ref=e314]: "% Utilizado"
                - img [ref=e316]
              - generic [ref=e318]: 0%
              - generic [ref=e319]: — dentro do plano
            - generic [ref=e320]:
              - img
              - img
              - img
              - generic [ref=e321]:
                - generic [ref=e322]: Não mapeado
                - img [ref=e324]
              - generic [ref=e326]: US$ 0,00
              - generic [ref=e327]: — sob controle
          - generic [ref=e328]:
            - generic [ref=e329]:
              - img
              - img
              - img
              - generic [ref=e330]:
                - generic [ref=e331]: Orçamento total alocado
                - img [ref=e333]
              - generic [ref=e335]: R$ 500.000
              - generic [ref=e336]: 1 value streams
            - generic [ref=e337]:
              - img
              - img
              - img
              - generic [ref=e338]:
                - generic [ref=e339]: Comprometido até agora
                - img [ref=e341]
              - generic [ref=e343]: R$ 0
              - generic [ref=e344]: 0% do orçamento alocado
            - generic [ref=e345]:
              - img
              - img
              - img
              - generic [ref=e346]:
                - generic [ref=e347]: Utilização do portfólio
                - img [ref=e349]
              - generic [ref=e351]: 0%
              - generic [ref=e352]: dentro do saudável
            - generic [ref=e353]:
              - img
              - img
              - img
              - generic [ref=e354]:
                - generic [ref=e355]: Guardrails rompidos
                - img [ref=e357]
              - generic [ref=e359]: "0"
              - generic [ref=e360]: de 1 streams
          - generic [ref=e361]:
            - generic [ref=e362]:
              - img [ref=e364]
              - generic [ref=e367]:
                - generic [ref=e368]: Capital Allocation Flow
                - generic [ref=e369]: Como o capital flui dos ARTs para os Temas Estratégicos
            - generic [ref=e371]:
              - generic [ref=e372]: ↓
              - generic [ref=e373]:
                - paragraph [ref=e374]: Por Tema Estratégico (Investment Horizon)
                - 'generic "Sem Tema: R$ 500.000" [ref=e376]': Sem Tema
          - generic [ref=e377]:
            - generic [ref=e378]:
              - img [ref=e380]
              - generic [ref=e383]:
                - generic [ref=e384]: Value Streams
                - generic [ref=e385]: Lean Budgets por ART e Tema Estratégico
              - button "Novo Value Stream" [ref=e387] [cursor=pointer]:
                - img [ref=e388]
                - text: Novo Value Stream
            - table [ref=e389]:
              - rowgroup [ref=e390]:
                - row "Value Stream Período Consumido vs. guardrail Guardrail" [ref=e391]:
                  - columnheader "Value Stream" [ref=e392]
                  - columnheader "Período" [ref=e393]
                  - columnheader "Consumido vs. guardrail" [ref=e394]
                  - columnheader "Guardrail" [ref=e395]
                  - columnheader [ref=e396]
              - rowgroup [ref=e397]:
                - row "Budget COSMOS ART Q2 cmr851sa70000oepxfdneicep PI-2026-Q2 US$ 0 / US$ 500 mil 0% Referência de guardrail · 80% do orçamento ok Editar Remover" [ref=e398] [cursor=pointer]:
                  - cell "Budget COSMOS ART Q2 cmr851sa70000oepxfdneicep" [ref=e399]:
                    - generic [ref=e400]:
                      - paragraph [ref=e401]: Budget COSMOS ART Q2
                      - generic [ref=e403]: cmr851sa70000oepxfdneicep
                  - cell "PI-2026-Q2" [ref=e404]
                  - cell "US$ 0 / US$ 500 mil 0% Referência de guardrail · 80% do orçamento" [ref=e405]:
                    - generic [ref=e406]:
                      - generic [ref=e407]:
                        - generic [ref=e408]:
                          - text: US$ 0
                          - generic [ref=e409]: / US$ 500 mil
                        - generic [ref=e410]: 0%
                      - generic "Referência de guardrail · 80% do orçamento" [ref=e413]
                  - cell "ok" [ref=e414]:
                    - generic [ref=e415]:
                      - img [ref=e416]
                      - text: ok
                  - cell "Editar Remover" [ref=e419]:
                    - generic [ref=e420]:
                      - button "Editar" [ref=e421]:
                        - img [ref=e422]
                      - button "Remover" [ref=e425]:
                        - img [ref=e426]
          - generic [ref=e429]:
            - generic [ref=e430]:
              - img [ref=e432]
              - generic [ref=e435]:
                - generic [ref=e436]: Investment Horizons
                - generic [ref=e437]: Alocação do portfólio por Tema Estratégico (H1/H2/H3)
              - button "Novo Horizon" [ref=e439] [cursor=pointer]:
                - img [ref=e440]
                - text: Novo Horizon
            - generic [ref=e442]:
              - generic [ref=e443]:
                - generic [ref=e444]:
                  - heading "Alocação por Tema Estratégico" [level=2] [ref=e445]
                  - paragraph [ref=e446]: Distribuição do orçamento do portfólio entre temas SAFe
                - combobox "Período" [ref=e448]:
                  - option "PI-2026-Q2" [selected]
              - generic [ref=e449]:
                - generic [ref=e450]:
                  - img
                  - img
                  - img
                  - generic [ref=e451]:
                    - generic [ref=e452]: Total alocado
                    - img [ref=e454]
                  - generic [ref=e456]: R$ 500.000
                  - generic [ref=e457]: — alocado no período
                - generic [ref=e458]:
                  - img
                  - img
                  - img
                  - generic [ref=e459]:
                    - generic [ref=e460]: Total gasto
                    - img [ref=e462]
                  - generic [ref=e464]: R$ 0
                  - generic [ref=e465]: — 0% do alocado
                - generic [ref=e466]:
                  - paragraph [ref=e467]: Guardrails
                  - generic [ref=e469]:
                    - img [ref=e470]
                    - text: Todos OK
              - generic [ref=e474]:
                - generic [ref=e475]:
                  - generic [ref=e478]: Sem Tema
                  - generic [ref=e479]: 100% do portfólio
                - generic [ref=e482]:
                  - generic [ref=e483]: R$ 500.000 alocado
                  - generic [ref=e484]: R$ 0 gasto
                - generic [ref=e487]:
                  - img "Consumo" [ref=e488]:
                    - generic [ref=e491]: "0"
                  - generic [ref=e492]: Consumo
                  - generic [ref=e493]: 0%
          - generic [ref=e494]:
            - generic [ref=e495]:
              - img [ref=e497]
              - generic [ref=e501]: Consolidado por Período
            - table [ref=e502]:
              - rowgroup [ref=e503]:
                - row "Período Total Alocado Total Gasto Utilização" [ref=e504]:
                  - columnheader "Período" [ref=e505]
                  - columnheader "Total Alocado" [ref=e506]
                  - columnheader "Total Gasto" [ref=e507]
                  - columnheader "Utilização" [ref=e508]
              - rowgroup [ref=e509]:
                - row "PI-2026-Q2 R$ 500.000 R$ 0 0%" [ref=e510]:
                  - cell "PI-2026-Q2" [ref=e511]
                  - cell "R$ 500.000" [ref=e512]
                  - cell "R$ 0" [ref=e513]
                  - cell "0%" [ref=e514]:
                    - generic [ref=e515]: 0%
    - button "Abrir Copilot AI" [ref=e518] [cursor=pointer]:
      - img [ref=e519]
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e529] [cursor=pointer]:
    - img [ref=e530]
  - alert [ref=e533]
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
      |     ^ Error: [/portfolio/budgets] Critical/serious violations: [
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