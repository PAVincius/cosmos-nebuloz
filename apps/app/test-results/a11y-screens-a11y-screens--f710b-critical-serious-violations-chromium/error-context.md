# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y-screens.spec.ts >> a11y screens — static routes @auth >> /risks has no critical/serious violations
- Location: e2e/a11y-screens.spec.ts:67:9

# Error details

```
Error: [/risks] Critical/serious violations: [
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
              "fgColor": "#ffffff",
              "bgColor": "#fbbf24",
              "contrastRatio": 1.66,
              "fontSize": "7.5pt (10px)",
              "fontWeight": "bold",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<span class=\"cursor-default rounded-[5px] px-[5px] py-0.5 font-bold font-mono text-[10px] text-white\" title=\"cmr8j4f7 · Capacidade do team reduzida por 2 semanas (férias)\" style=\"background: var(--amber); box-shadow: 0 2px 6px -1px rgba(var(--amber-rgb),.6);\">cmr8</span>",
                "target": [
                  ".content-start.p-1\\.5.flex-wrap:nth-child(2) > .cursor-default.rounded-\\[5px\\].px-\\[5px\\]"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 1.66 (foreground color: #ffffff, background color: #fbbf24, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"cursor-default rounded-[5px] px-[5px] py-0.5 font-bold font-mono text-[10px] text-white\" title=\"cmr8j4f7 · Capacidade do team reduzida por 2 semanas (férias)\" style=\"background: var(--amber); box-shadow: 0 2px 6px -1px rgba(var(--amber-rgb),.6);\">cmr8</span>",
        "target": [
          ".content-start.p-1\\.5.flex-wrap:nth-child(2) > .cursor-default.rounded-\\[5px\\].px-\\[5px\\]"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 1.66 (foreground color: #ffffff, background color: #fbbf24, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#ffffff",
              "bgColor": "#5b8def",
              "contrastRatio": 3.23,
              "fontSize": "7.5pt (10px)",
              "fontWeight": "bold",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<span class=\"cursor-default rounded-[5px] px-[5px] py-0.5 font-bold font-mono text-[10px] text-white\" title=\"cmr8j4f7 · Custo de infraestrutura acima do orçamento do PI\" style=\"background: var(--blue); box-shadow: 0 2px 6px -1px rgba(var(--blue-rgb),.6);\">cmr8</span>",
                "target": [
                  ".content-start.p-1\\.5.flex-wrap:nth-child(6) > .cursor-default.rounded-\\[5px\\].px-\\[5px\\]"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.23 (foreground color: #ffffff, background color: #5b8def, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"cursor-default rounded-[5px] px-[5px] py-0.5 font-bold font-mono text-[10px] text-white\" title=\"cmr8j4f7 · Custo de infraestrutura acima do orçamento do PI\" style=\"background: var(--blue); box-shadow: 0 2px 6px -1px rgba(var(--blue-rgb),.6);\">cmr8</span>",
        "target": [
          ".content-start.p-1\\.5.flex-wrap:nth-child(6) > .cursor-default.rounded-\\[5px\\].px-\\[5px\\]"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.23 (foreground color: #ffffff, background color: #5b8def, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#ffffff",
              "bgColor": "#fbbf24",
              "contrastRatio": 1.66,
              "fontSize": "7.5pt (10px)",
              "fontWeight": "bold",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<span class=\"cursor-default rounded-[5px] px-[5px] py-0.5 font-bold font-mono text-[10px] text-white\" title=\"cmr8j4f7 · Dependência de API externa sem SLA garantido\" style=\"background: var(--amber); box-shadow: 0 2px 6px -1px rgba(var(--amber-rgb),.6);\">cmr8</span>",
                "target": [
                  ".content-start.p-1\\.5.flex-wrap:nth-child(7) > .cursor-default.rounded-\\[5px\\].px-\\[5px\\]"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 1.66 (foreground color: #ffffff, background color: #fbbf24, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"cursor-default rounded-[5px] px-[5px] py-0.5 font-bold font-mono text-[10px] text-white\" title=\"cmr8j4f7 · Dependência de API externa sem SLA garantido\" style=\"background: var(--amber); box-shadow: 0 2px 6px -1px rgba(var(--amber-rgb),.6);\">cmr8</span>",
        "target": [
          ".content-start.p-1\\.5.flex-wrap:nth-child(7) > .cursor-default.rounded-\\[5px\\].px-\\[5px\\]"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 1.66 (foreground color: #ffffff, background color: #fbbf24, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#ffffff",
              "bgColor": "#5b8def",
              "contrastRatio": 3.23,
              "fontSize": "7.5pt (10px)",
              "fontWeight": "bold",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<span class=\"cursor-default rounded-[5px] px-[5px] py-0.5 font-bold font-mono text-[10px] text-white\" title=\"cmr8j4f7 · Dados históricos incompletos para treinamento do modelo IA\" style=\"background: var(--blue); box-shadow: 0 2px 6px -1px rgba(var(--blue-rgb),.6);\">cmr8</span>",
                "target": [
                  ".content-start.p-1\\.5.flex-wrap:nth-child(11) > .cursor-default.rounded-\\[5px\\].px-\\[5px\\]"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.23 (foreground color: #ffffff, background color: #5b8def, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"cursor-default rounded-[5px] px-[5px] py-0.5 font-bold font-mono text-[10px] text-white\" title=\"cmr8j4f7 · Dados históricos incompletos para treinamento do modelo IA\" style=\"background: var(--blue); box-shadow: 0 2px 6px -1px rgba(var(--blue-rgb),.6);\">cmr8</span>",
        "target": [
          ".content-start.p-1\\.5.flex-wrap:nth-child(11) > .cursor-default.rounded-\\[5px\\].px-\\[5px\\]"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.23 (foreground color: #ffffff, background color: #5b8def, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#ffffff",
              "bgColor": "#5b8def",
              "contrastRatio": 3.23,
              "fontSize": "7.5pt (10px)",
              "fontWeight": "bold",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<span class=\"cursor-default rounded-[5px] px-[5px] py-0.5 font-bold font-mono text-[10px] text-white\" title=\"cmr8j4f7 · Certificação LGPD concluída antes do PI\" style=\"background: var(--blue); box-shadow: 0 2px 6px -1px rgba(var(--blue-rgb),.6);\">cmr8</span>",
                "target": [
                  ".content-start.p-1\\.5.flex-wrap:nth-child(12) > .cursor-default.rounded-\\[5px\\].px-\\[5px\\]"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.23 (foreground color: #ffffff, background color: #5b8def, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"cursor-default rounded-[5px] px-[5px] py-0.5 font-bold font-mono text-[10px] text-white\" title=\"cmr8j4f7 · Certificação LGPD concluída antes do PI\" style=\"background: var(--blue); box-shadow: 0 2px 6px -1px rgba(var(--blue-rgb),.6);\">cmr8</span>",
        "target": [
          ".content-start.p-1\\.5.flex-wrap:nth-child(12) > .cursor-default.rounded-\\[5px\\].px-\\[5px\\]"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.23 (foreground color: #ffffff, background color: #5b8def, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#ffffff",
              "bgColor": "#fbbf24",
              "contrastRatio": 1.66,
              "fontSize": "10.5pt (14px)",
              "fontWeight": "bold",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div class=\"grid h-9 w-9 place-items-center rounded-cosmos-sm font-bold font-mono text-[14px] text-white\" title=\"Severidade (probabilidade × impacto)\" style=\"background: var(--amber); box-shadow: 0 4px 12px -3px rgba(var(--amber-rgb),.6);\">12</div>",
                "target": [
                  ".rounded-cosmos-md.bg-surface.p-3\\.5:nth-child(1) > .h-9.w-9.text-\\[14px\\]"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 1.66 (foreground color: #ffffff, background color: #fbbf24, font size: 10.5pt (14px), font weight: bold). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<div class=\"grid h-9 w-9 place-items-center rounded-cosmos-sm font-bold font-mono text-[14px] text-white\" title=\"Severidade (probabilidade × impacto)\" style=\"background: var(--amber); box-shadow: 0 4px 12px -3px rgba(var(--amber-rgb),.6);\">12</div>",
        "target": [
          ".rounded-cosmos-md.bg-surface.p-3\\.5:nth-child(1) > .h-9.w-9.text-\\[14px\\]"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 1.66 (foreground color: #ffffff, background color: #fbbf24, font size: 10.5pt (14px), font weight: bold). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#ffffff",
              "bgColor": "#fbbf24",
              "contrastRatio": 1.66,
              "fontSize": "10.5pt (14px)",
              "fontWeight": "bold",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div class=\"grid h-9 w-9 place-items-center rounded-cosmos-sm font-bold font-mono text-[14px] text-white\" title=\"Severidade (probabilidade × impacto)\" style=\"background: var(--amber); box-shadow: 0 4px 12px -3px rgba(var(--amber-rgb),.6);\">10</div>",
                "target": [
                  ".rounded-cosmos-md.bg-surface.p-3\\.5:nth-child(2) > .h-9.w-9.text-\\[14px\\]"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 1.66 (foreground color: #ffffff, background color: #fbbf24, font size: 10.5pt (14px), font weight: bold). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<div class=\"grid h-9 w-9 place-items-center rounded-cosmos-sm font-bold font-mono text-[14px] text-white\" title=\"Severidade (probabilidade × impacto)\" style=\"background: var(--amber); box-shadow: 0 4px 12px -3px rgba(var(--amber-rgb),.6);\">10</div>",
        "target": [
          ".rounded-cosmos-md.bg-surface.p-3\\.5:nth-child(2) > .h-9.w-9.text-\\[14px\\]"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 1.66 (foreground color: #ffffff, background color: #fbbf24, font size: 10.5pt (14px), font weight: bold). Expected contrast ratio of 4.5:1"
      }
    ]
  }
]

expect(received).toEqual(expected) // deep equality

- Expected  -   1
+ Received  + 303

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
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#fbbf24",
+               "contrastRatio": 1.66,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#ffffff",
+               "fontSize": "7.5pt (10px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 1.66 (foreground color: #ffffff, background color: #fbbf24, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<span class=\"cursor-default rounded-[5px] px-[5px] py-0.5 font-bold font-mono text-[10px] text-white\" title=\"cmr8j4f7 · Capacidade do team reduzida por 2 semanas (férias)\" style=\"background: var(--amber); box-shadow: 0 2px 6px -1px rgba(var(--amber-rgb),.6);\">cmr8</span>",
+                 "target": Array [
+                   ".content-start.p-1\\.5.flex-wrap:nth-child(2) > .cursor-default.rounded-\\[5px\\].px-\\[5px\\]",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 1.66 (foreground color: #ffffff, background color: #fbbf24, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"cursor-default rounded-[5px] px-[5px] py-0.5 font-bold font-mono text-[10px] text-white\" title=\"cmr8j4f7 · Capacidade do team reduzida por 2 semanas (férias)\" style=\"background: var(--amber); box-shadow: 0 2px 6px -1px rgba(var(--amber-rgb),.6);\">cmr8</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".content-start.p-1\\.5.flex-wrap:nth-child(2) > .cursor-default.rounded-\\[5px\\].px-\\[5px\\]",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#5b8def",
+               "contrastRatio": 3.23,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#ffffff",
+               "fontSize": "7.5pt (10px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.23 (foreground color: #ffffff, background color: #5b8def, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<span class=\"cursor-default rounded-[5px] px-[5px] py-0.5 font-bold font-mono text-[10px] text-white\" title=\"cmr8j4f7 · Custo de infraestrutura acima do orçamento do PI\" style=\"background: var(--blue); box-shadow: 0 2px 6px -1px rgba(var(--blue-rgb),.6);\">cmr8</span>",
+                 "target": Array [
+                   ".content-start.p-1\\.5.flex-wrap:nth-child(6) > .cursor-default.rounded-\\[5px\\].px-\\[5px\\]",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.23 (foreground color: #ffffff, background color: #5b8def, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"cursor-default rounded-[5px] px-[5px] py-0.5 font-bold font-mono text-[10px] text-white\" title=\"cmr8j4f7 · Custo de infraestrutura acima do orçamento do PI\" style=\"background: var(--blue); box-shadow: 0 2px 6px -1px rgba(var(--blue-rgb),.6);\">cmr8</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".content-start.p-1\\.5.flex-wrap:nth-child(6) > .cursor-default.rounded-\\[5px\\].px-\\[5px\\]",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#fbbf24",
+               "contrastRatio": 1.66,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#ffffff",
+               "fontSize": "7.5pt (10px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 1.66 (foreground color: #ffffff, background color: #fbbf24, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<span class=\"cursor-default rounded-[5px] px-[5px] py-0.5 font-bold font-mono text-[10px] text-white\" title=\"cmr8j4f7 · Dependência de API externa sem SLA garantido\" style=\"background: var(--amber); box-shadow: 0 2px 6px -1px rgba(var(--amber-rgb),.6);\">cmr8</span>",
+                 "target": Array [
+                   ".content-start.p-1\\.5.flex-wrap:nth-child(7) > .cursor-default.rounded-\\[5px\\].px-\\[5px\\]",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 1.66 (foreground color: #ffffff, background color: #fbbf24, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"cursor-default rounded-[5px] px-[5px] py-0.5 font-bold font-mono text-[10px] text-white\" title=\"cmr8j4f7 · Dependência de API externa sem SLA garantido\" style=\"background: var(--amber); box-shadow: 0 2px 6px -1px rgba(var(--amber-rgb),.6);\">cmr8</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".content-start.p-1\\.5.flex-wrap:nth-child(7) > .cursor-default.rounded-\\[5px\\].px-\\[5px\\]",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#5b8def",
+               "contrastRatio": 3.23,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#ffffff",
+               "fontSize": "7.5pt (10px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.23 (foreground color: #ffffff, background color: #5b8def, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<span class=\"cursor-default rounded-[5px] px-[5px] py-0.5 font-bold font-mono text-[10px] text-white\" title=\"cmr8j4f7 · Dados históricos incompletos para treinamento do modelo IA\" style=\"background: var(--blue); box-shadow: 0 2px 6px -1px rgba(var(--blue-rgb),.6);\">cmr8</span>",
+                 "target": Array [
+                   ".content-start.p-1\\.5.flex-wrap:nth-child(11) > .cursor-default.rounded-\\[5px\\].px-\\[5px\\]",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.23 (foreground color: #ffffff, background color: #5b8def, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"cursor-default rounded-[5px] px-[5px] py-0.5 font-bold font-mono text-[10px] text-white\" title=\"cmr8j4f7 · Dados históricos incompletos para treinamento do modelo IA\" style=\"background: var(--blue); box-shadow: 0 2px 6px -1px rgba(var(--blue-rgb),.6);\">cmr8</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".content-start.p-1\\.5.flex-wrap:nth-child(11) > .cursor-default.rounded-\\[5px\\].px-\\[5px\\]",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#5b8def",
+               "contrastRatio": 3.23,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#ffffff",
+               "fontSize": "7.5pt (10px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.23 (foreground color: #ffffff, background color: #5b8def, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<span class=\"cursor-default rounded-[5px] px-[5px] py-0.5 font-bold font-mono text-[10px] text-white\" title=\"cmr8j4f7 · Certificação LGPD concluída antes do PI\" style=\"background: var(--blue); box-shadow: 0 2px 6px -1px rgba(var(--blue-rgb),.6);\">cmr8</span>",
+                 "target": Array [
+                   ".content-start.p-1\\.5.flex-wrap:nth-child(12) > .cursor-default.rounded-\\[5px\\].px-\\[5px\\]",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.23 (foreground color: #ffffff, background color: #5b8def, font size: 7.5pt (10px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"cursor-default rounded-[5px] px-[5px] py-0.5 font-bold font-mono text-[10px] text-white\" title=\"cmr8j4f7 · Certificação LGPD concluída antes do PI\" style=\"background: var(--blue); box-shadow: 0 2px 6px -1px rgba(var(--blue-rgb),.6);\">cmr8</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".content-start.p-1\\.5.flex-wrap:nth-child(12) > .cursor-default.rounded-\\[5px\\].px-\\[5px\\]",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#fbbf24",
+               "contrastRatio": 1.66,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#ffffff",
+               "fontSize": "10.5pt (14px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 1.66 (foreground color: #ffffff, background color: #fbbf24, font size: 10.5pt (14px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"grid h-9 w-9 place-items-center rounded-cosmos-sm font-bold font-mono text-[14px] text-white\" title=\"Severidade (probabilidade × impacto)\" style=\"background: var(--amber); box-shadow: 0 4px 12px -3px rgba(var(--amber-rgb),.6);\">12</div>",
+                 "target": Array [
+                   ".rounded-cosmos-md.bg-surface.p-3\\.5:nth-child(1) > .h-9.w-9.text-\\[14px\\]",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 1.66 (foreground color: #ffffff, background color: #fbbf24, font size: 10.5pt (14px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<div class=\"grid h-9 w-9 place-items-center rounded-cosmos-sm font-bold font-mono text-[14px] text-white\" title=\"Severidade (probabilidade × impacto)\" style=\"background: var(--amber); box-shadow: 0 4px 12px -3px rgba(var(--amber-rgb),.6);\">12</div>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".rounded-cosmos-md.bg-surface.p-3\\.5:nth-child(1) > .h-9.w-9.text-\\[14px\\]",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#fbbf24",
+               "contrastRatio": 1.66,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#ffffff",
+               "fontSize": "10.5pt (14px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 1.66 (foreground color: #ffffff, background color: #fbbf24, font size: 10.5pt (14px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"grid h-9 w-9 place-items-center rounded-cosmos-sm font-bold font-mono text-[14px] text-white\" title=\"Severidade (probabilidade × impacto)\" style=\"background: var(--amber); box-shadow: 0 4px 12px -3px rgba(var(--amber-rgb),.6);\">10</div>",
+                 "target": Array [
+                   ".rounded-cosmos-md.bg-surface.p-3\\.5:nth-child(2) > .h-9.w-9.text-\\[14px\\]",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 1.66 (foreground color: #ffffff, background color: #fbbf24, font size: 10.5pt (14px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<div class=\"grid h-9 w-9 place-items-center rounded-cosmos-sm font-bold font-mono text-[14px] text-white\" title=\"Severidade (probabilidade × impacto)\" style=\"background: var(--amber); box-shadow: 0 4px 12px -3px rgba(var(--amber-rgb),.6);\">10</div>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".rounded-cosmos-md.bg-surface.p-3\\.5:nth-child(2) > .h-9.w-9.text-\\[14px\\]",
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
          - generic [ref=e222] [cursor=pointer]: Risks
        - generic [ref=e223]:
          - group "Trocar persona" [ref=e224]:
            - button "RTE" [ref=e225] [cursor=pointer]: RTE
            - button "LPM" [pressed] [ref=e227] [cursor=pointer]: LPM
            - button "PO" [ref=e229] [cursor=pointer]: PO
            - button "SM" [ref=e231] [cursor=pointer]: SM
            - button "DEV" [ref=e233] [cursor=pointer]: DEV
          - button "Buscar" [ref=e235] [cursor=pointer]:
            - img [ref=e236]
          - generic "Admin E2E · admin@cosmos.local" [ref=e239]: AE
      - generic [ref=e240]:
        - generic [ref=e242]:
          - generic [ref=e243]:
            - generic [ref=e244]:
              - generic [ref=e245]: 0 críticos
              - generic [ref=e247]: 1 em aberto (Owned)
              - generic [ref=e248]: 2 endereçados
              - link "Planejamento PI Planning" [ref=e249] [cursor=pointer]:
                - /url: /pi-planning
                - img [ref=e251]
                - generic [ref=e253]:
                  - generic [ref=e254]: Planejamento
                  - text: PI Planning
              - link "Squads ARTs" [ref=e255] [cursor=pointer]:
                - /url: /arts
                - img [ref=e257]
                - generic [ref=e261]:
                  - generic [ref=e262]: Squads
                  - text: ARTs
            - heading "Riscos" [level=1] [ref=e263]
            - paragraph [ref=e264]: Registro de riscos classificado por ROAM e severidade (probabilidade × impacto). Revisado a cada sync de PI.
          - button "Registrar risco" [ref=e266] [cursor=pointer]:
            - img
            - text: Registrar risco
        - generic [ref=e268]:
          - combobox "Filtrar por PI" [ref=e269] [cursor=pointer]:
            - generic: Todos os PIs
            - img
          - generic [ref=e270]:
            - generic [ref=e271]:
              - generic [ref=e272]:
                - img [ref=e274]
                - generic [ref=e278]:
                  - generic [ref=e279]: Matriz de risco
                  - generic [ref=e280]: Probabilidade × impacto · severidade por cor
              - generic [ref=e281]:
                - generic [ref=e282]:
                  - generic [ref=e284]: Probabilidade →
                  - generic [ref=e285]:
                    - generic [ref=e286]:
                      - generic "Alta probabilidade · Baixo impacto" [ref=e287]
                      - generic "Alta probabilidade · Médio impacto" [ref=e288]:
                        - generic "cmr8j4f7 · Capacidade do team reduzida por 2 semanas (férias)" [ref=e289]: cmr8
                      - generic "Alta probabilidade · Alto impacto" [ref=e290]
                      - generic "Alta probabilidade · Crítico impacto" [ref=e291]
                      - generic "Média probabilidade · Baixo impacto" [ref=e292]
                      - generic "Média probabilidade · Médio impacto" [ref=e293]:
                        - generic "cmr8j4f7 · Custo de infraestrutura acima do orçamento do PI" [ref=e294]: cmr8
                      - generic "Média probabilidade · Alto impacto" [ref=e295]:
                        - generic "cmr8j4f7 · Dependência de API externa sem SLA garantido" [ref=e296]: cmr8
                      - generic "Média probabilidade · Crítico impacto" [ref=e297]
                      - generic "Baixa probabilidade · Baixo impacto" [ref=e298]
                      - generic "Baixa probabilidade · Médio impacto" [ref=e299]
                      - generic "Baixa probabilidade · Alto impacto" [ref=e300]:
                        - generic "cmr8j4f7 · Dados históricos incompletos para treinamento do modelo IA" [ref=e301]: cmr8
                      - generic "Baixa probabilidade · Crítico impacto" [ref=e302]:
                        - generic "cmr8j4f7 · Certificação LGPD concluída antes do PI" [ref=e303]: cmr8
                    - generic [ref=e304]: Impacto →
                - generic [ref=e305]:
                  - generic [ref=e306]: Baixo
                  - generic [ref=e308]: Moderado
                  - generic [ref=e310]: Alto
                  - generic [ref=e312]: Crítico
            - generic [ref=e314]:
              - generic [ref=e315]:
                - img [ref=e317]
                - generic [ref=e319]:
                  - generic [ref=e320]: Registro de riscos
                  - generic [ref=e321]: Ordenado por severidade
                - generic [ref=e323]: 5 riscos
              - generic [ref=e325]:
                - generic [ref=e326]:
                  - generic "Severidade (probabilidade × impacto)" [ref=e327]: "12"
                  - generic [ref=e328]:
                    - generic [ref=e329]:
                      - generic [ref=e330]: "#cmr8j4"
                      - generic [ref=e331]: Técnico
                      - generic [ref=e333]: PI 2026-Q2
                    - generic [ref=e334]: Dependência de API externa sem SLA garantido
                  - generic [ref=e342]: Média · Alto
                  - combobox "Status ROAM" [ref=e343] [cursor=pointer]:
                    - generic: Identificado
                    - img
                  - generic [ref=e344]:
                    - generic "cmr78lbon0000bkpxgemu3510" [ref=e345]:
                      - img [ref=e346]
                      - generic [ref=e349]: cmr78lbo
                    - button "Excluir risco Dependência de API externa sem SLA garantido" [ref=e350] [cursor=pointer]:
                      - img [ref=e351]
                - generic [ref=e354]:
                  - generic "Severidade (probabilidade × impacto)" [ref=e355]: "10"
                  - generic [ref=e356]:
                    - generic [ref=e357]:
                      - generic [ref=e358]: "#cmr8j4"
                      - generic [ref=e359]: Organizacional
                      - generic [ref=e361]: PI 2026-Q2
                    - generic [ref=e362]: Capacidade do team reduzida por 2 semanas (férias)
                  - generic [ref=e370]: Alta · Médio
                  - combobox "Status ROAM" [ref=e371] [cursor=pointer]:
                    - generic: Atribuído
                    - img
                  - generic [ref=e372]:
                    - generic "cmr78lbon0000bkpxgemu3510" [ref=e373]:
                      - img [ref=e374]
                      - generic [ref=e377]: cmr78lbo
                    - button "Excluir risco Capacidade do team reduzida por 2 semanas (férias)" [ref=e378] [cursor=pointer]:
                      - img [ref=e379]
                - generic [ref=e382]:
                  - generic "Severidade (probabilidade × impacto)" [ref=e383]: "6"
                  - generic [ref=e384]:
                    - generic [ref=e385]:
                      - generic [ref=e386]: "#cmr8j4"
                      - generic [ref=e387]: financial
                      - generic [ref=e389]: PI 2026-Q2
                    - generic [ref=e390]: Custo de infraestrutura acima do orçamento do PI
                  - generic [ref=e398]: Média · Médio
                  - combobox "Status ROAM" [ref=e399] [cursor=pointer]:
                    - generic: Aceito
                    - img
                  - generic [ref=e400]:
                    - generic "cmr78lbon0000bkpxgemu3510" [ref=e401]:
                      - img [ref=e402]
                      - generic [ref=e405]: cmr78lbo
                    - button "Excluir risco Custo de infraestrutura acima do orçamento do PI" [ref=e406] [cursor=pointer]:
                      - img [ref=e407]
                - generic [ref=e410]:
                  - generic "Severidade (probabilidade × impacto)" [ref=e411]: "5"
                  - generic [ref=e412]:
                    - generic [ref=e413]:
                      - generic [ref=e414]: "#cmr8j4"
                      - generic [ref=e415]: compliance
                      - generic [ref=e417]: PI 2026-Q2
                    - generic [ref=e418]: Certificação LGPD concluída antes do PI
                  - generic [ref=e426]: Baixa · Crítico
                  - combobox "Status ROAM" [ref=e427] [cursor=pointer]:
                    - generic: Resolvido
                    - img
                  - generic [ref=e428]:
                    - generic "cmr78lbon0000bkpxgemu3510" [ref=e429]:
                      - img [ref=e430]
                      - generic [ref=e433]: cmr78lbo
                    - button "Excluir risco Certificação LGPD concluída antes do PI" [ref=e434] [cursor=pointer]:
                      - img [ref=e435]
                - generic [ref=e438]:
                  - generic "Severidade (probabilidade × impacto)" [ref=e439]: "4"
                  - generic [ref=e440]:
                    - generic [ref=e441]:
                      - generic [ref=e442]: "#cmr8j4"
                      - generic [ref=e443]: Técnico
                      - generic [ref=e445]: PI 2026-Q2
                    - generic [ref=e446]: Dados históricos incompletos para treinamento do modelo IA
                  - generic [ref=e454]: Baixa · Alto
                  - combobox "Status ROAM" [ref=e455] [cursor=pointer]:
                    - generic: Mitigado
                    - img
                  - generic [ref=e456]:
                    - generic "cmr78lbon0000bkpxgemu3510" [ref=e457]:
                      - img [ref=e458]
                      - generic [ref=e461]: cmr78lbo
                    - button "Excluir risco Dados históricos incompletos para treinamento do modelo IA" [ref=e462] [cursor=pointer]:
                      - img [ref=e463]
    - button "Abrir Copilot AI" [ref=e468] [cursor=pointer]:
      - img [ref=e469]
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e479] [cursor=pointer]:
    - img [ref=e480]
  - alert [ref=e483]
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
      |     ^ Error: [/risks] Critical/serious violations: [
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