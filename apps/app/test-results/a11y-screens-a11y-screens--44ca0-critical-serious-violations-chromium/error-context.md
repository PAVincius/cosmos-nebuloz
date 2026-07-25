# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y-screens.spec.ts >> a11y screens — static routes @auth >> /portfolio/themes has no critical/serious violations
- Location: e2e/a11y-screens.spec.ts:67:9

# Error details

```
Error: [/portfolio/themes] Critical/serious violations: [
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
              "bgColor": "#00d4ff",
              "contrastRatio": 1.77,
              "fontSize": "10.5pt (14px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<button class=\"inline-flex items-ce...\" type=\"button\" style=\"background: var(--ac...\">",
                "target": [
                  ".px-\\[14px\\]"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 1.77 (foreground color: #ffffff, background color: #00d4ff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<button class=\"inline-flex items-ce...\" type=\"button\" style=\"background: var(--ac...\">",
        "target": [
          ".px-\\[14px\\]"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 1.77 (foreground color: #ffffff, background color: #00d4ff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1"
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
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div style=\"background: var(--su...\">",
                "target": [
                  ".grid-cols-1 > div:nth-child(1)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"font-mono\" style=\"font-size: 11px; color: var(--ink-subtle); font-weight: 600;\">THEME-001</span>",
        "target": [
          "div:nth-child(1) > div:nth-child(1) > div > div:nth-child(1) > .font-mono"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
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
                "html": "<div style=\"background: var(--su...\">",
                "target": [
                  ".grid-cols-1 > div:nth-child(1)"
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
        "html": "<p style=\"margin: 0px; font-size: 12.5px; line-height: 1.5; color: var(--ink-subtle);\">Reduzir lead time de épicos críticos para clientes enterprise via SAFe + automação.</p>",
        "target": [
          ".grid-cols-1 > div:nth-child(1) > p"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#46566d",
              "bgColor": "#0e1330",
              "contrastRatio": 2.43,
              "fontSize": "8.3pt (11px)",
              "fontWeight": "bold",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div style=\"background: var(--su...\">",
                "target": [
                  ".grid-cols-1 > div:nth-child(1)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span style=\"font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ink-faint);\">Alocação de investimento</span>",
        "target": [
          "div:nth-child(1) > div:nth-child(3) > div:nth-child(1) > span:nth-child(1)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#46566d",
              "bgColor": "#0e1330",
              "contrastRatio": 2.43,
              "fontSize": "8.3pt (11px)",
              "fontWeight": "bold",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div style=\"background: var(--su...\">",
                "target": [
                  ".grid-cols-1 > div:nth-child(1)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"font-mono\" style=\"font-size: 11px; color: var(--ink-faint); font-weight: 700;\">sem alvo definido</span>",
        "target": [
          "div:nth-child(1) > div:nth-child(3) > div:nth-child(1) > span:nth-child(2) > .font-mono:nth-child(2)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#65748b",
              "bgColor": "#0e1330",
              "contrastRatio": 3.83,
              "fontSize": "9.0pt (12px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div style=\"background: var(--su...\">",
                "target": [
                  ".grid-cols-1 > div:nth-child(1)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"font-mono\" style=\"font-size: 12px; color: var(--ink-subtle);\">2026</span>",
        "target": [
          "div:nth-child(1) > div:nth-child(4) > .font-mono"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1"
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
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div style=\"background: var(--su...\">",
                "target": [
                  ".grid-cols-1 > div:nth-child(2)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"font-mono\" style=\"font-size: 11px; color: var(--ink-subtle); font-weight: 600;\">THEME-002</span>",
        "target": [
          ".grid-cols-1 > div:nth-child(2) > div:nth-child(1) > div > div:nth-child(1) > .font-mono"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
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
                "html": "<div style=\"background: var(--su...\">",
                "target": [
                  ".grid-cols-1 > div:nth-child(2)"
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
        "html": "<p style=\"margin: 0px; font-size: 12.5px; line-height: 1.5; color: var(--ink-subtle);\">AI Copilots em PI Planning, risk scoring e dependency detection.</p>",
        "target": [
          "div:nth-child(2) > p"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#46566d",
              "bgColor": "#0e1330",
              "contrastRatio": 2.43,
              "fontSize": "8.3pt (11px)",
              "fontWeight": "bold",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div style=\"background: var(--su...\">",
                "target": [
                  ".grid-cols-1 > div:nth-child(2)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span style=\"font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ink-faint);\">Alocação de investimento</span>",
        "target": [
          ".grid-cols-1 > div:nth-child(2) > div:nth-child(3) > div:nth-child(1) > span:nth-child(1)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#46566d",
              "bgColor": "#0e1330",
              "contrastRatio": 2.43,
              "fontSize": "8.3pt (11px)",
              "fontWeight": "bold",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div style=\"background: var(--su...\">",
                "target": [
                  ".grid-cols-1 > div:nth-child(2)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"font-mono\" style=\"font-size: 11px; color: var(--ink-faint); font-weight: 700;\">sem alvo definido</span>",
        "target": [
          "div:nth-child(2) > div:nth-child(3) > div:nth-child(1) > span:nth-child(2) > .font-mono:nth-child(2)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#65748b",
              "bgColor": "#0e1330",
              "contrastRatio": 3.83,
              "fontSize": "9.0pt (12px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div style=\"background: var(--su...\">",
                "target": [
                  ".grid-cols-1 > div:nth-child(2)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"font-mono\" style=\"font-size: 12px; color: var(--ink-subtle);\">H1 2026</span>",
        "target": [
          "div:nth-child(2) > div:nth-child(4) > .font-mono"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1"
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
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div style=\"background: var(--su...\">",
                "target": [
                  ".grid-cols-1 > div:nth-child(3)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"font-mono\" style=\"font-size: 11px; color: var(--ink-subtle); font-weight: 600;\">THEME-003</span>",
        "target": [
          "div:nth-child(3) > div:nth-child(1) > div > div:nth-child(1) > .font-mono"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
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
                "html": "<div style=\"background: var(--su...\">",
                "target": [
                  ".grid-cols-1 > div:nth-child(3)"
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
        "html": "<p style=\"margin: 0px; font-size: 12.5px; line-height: 1.5; color: var(--ink-subtle);\">LGPD, SOC2, multi-tenant RLS e auditoria completa para vendas enterprise.</p>",
        "target": [
          "div:nth-child(3) > p"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#46566d",
              "bgColor": "#0e1330",
              "contrastRatio": 2.43,
              "fontSize": "8.3pt (11px)",
              "fontWeight": "bold",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div style=\"background: var(--su...\">",
                "target": [
                  ".grid-cols-1 > div:nth-child(3)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span style=\"font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ink-faint);\">Alocação de investimento</span>",
        "target": [
          "div:nth-child(3) > div:nth-child(3) > div:nth-child(1) > span:nth-child(1)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#46566d",
              "bgColor": "#0e1330",
              "contrastRatio": 2.43,
              "fontSize": "8.3pt (11px)",
              "fontWeight": "bold",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div style=\"background: var(--su...\">",
                "target": [
                  ".grid-cols-1 > div:nth-child(3)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"font-mono\" style=\"font-size: 11px; color: var(--ink-faint); font-weight: 700;\">sem alvo definido</span>",
        "target": [
          "div:nth-child(3) > div:nth-child(3) > div:nth-child(1) > span:nth-child(2) > .font-mono:nth-child(2)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#65748b",
              "bgColor": "#0e1330",
              "contrastRatio": 3.83,
              "fontSize": "9.0pt (12px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div style=\"background: var(--su...\">",
                "target": [
                  ".grid-cols-1 > div:nth-child(3)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"font-mono\" style=\"font-size: 12px; color: var(--ink-subtle);\">2026</span>",
        "target": [
          "div:nth-child(3) > div:nth-child(4) > .font-mono"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1"
      }
    ]
  }
]

expect(received).toEqual(expected) // deep equality

- Expected  -   1
+ Received  + 583

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
+               "bgColor": "#00d4ff",
+               "contrastRatio": 1.77,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#ffffff",
+               "fontSize": "10.5pt (14px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 1.77 (foreground color: #ffffff, background color: #00d4ff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<button class=\"inline-flex items-ce...\" type=\"button\" style=\"background: var(--ac...\">",
+                 "target": Array [
+                   ".px-\\[14px\\]",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 1.77 (foreground color: #ffffff, background color: #00d4ff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<button class=\"inline-flex items-ce...\" type=\"button\" style=\"background: var(--ac...\">",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".px-\\[14px\\]",
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
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div style=\"background: var(--su...\">",
+                 "target": Array [
+                   ".grid-cols-1 > div:nth-child(1)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"font-mono\" style=\"font-size: 11px; color: var(--ink-subtle); font-weight: 600;\">THEME-001</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(1) > div:nth-child(1) > div > div:nth-child(1) > .font-mono",
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
+               "fontSize": "9.4pt (12.5px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div style=\"background: var(--su...\">",
+                 "target": Array [
+                   ".grid-cols-1 > div:nth-child(1)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<p style=\"margin: 0px; font-size: 12.5px; line-height: 1.5; color: var(--ink-subtle);\">Reduzir lead time de épicos críticos para clientes enterprise via SAFe + automação.</p>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".grid-cols-1 > div:nth-child(1) > p",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#0e1330",
+               "contrastRatio": 2.43,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#46566d",
+               "fontSize": "8.3pt (11px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div style=\"background: var(--su...\">",
+                 "target": Array [
+                   ".grid-cols-1 > div:nth-child(1)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<span style=\"font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ink-faint);\">Alocação de investimento</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(1) > div:nth-child(3) > div:nth-child(1) > span:nth-child(1)",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#0e1330",
+               "contrastRatio": 2.43,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#46566d",
+               "fontSize": "8.3pt (11px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div style=\"background: var(--su...\">",
+                 "target": Array [
+                   ".grid-cols-1 > div:nth-child(1)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"font-mono\" style=\"font-size: 11px; color: var(--ink-faint); font-weight: 700;\">sem alvo definido</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(1) > div:nth-child(3) > div:nth-child(1) > span:nth-child(2) > .font-mono:nth-child(2)",
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
+               "fontSize": "9.0pt (12px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div style=\"background: var(--su...\">",
+                 "target": Array [
+                   ".grid-cols-1 > div:nth-child(1)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"font-mono\" style=\"font-size: 12px; color: var(--ink-subtle);\">2026</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(1) > div:nth-child(4) > .font-mono",
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
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div style=\"background: var(--su...\">",
+                 "target": Array [
+                   ".grid-cols-1 > div:nth-child(2)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"font-mono\" style=\"font-size: 11px; color: var(--ink-subtle); font-weight: 600;\">THEME-002</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".grid-cols-1 > div:nth-child(2) > div:nth-child(1) > div > div:nth-child(1) > .font-mono",
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
+               "fontSize": "9.4pt (12.5px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div style=\"background: var(--su...\">",
+                 "target": Array [
+                   ".grid-cols-1 > div:nth-child(2)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<p style=\"margin: 0px; font-size: 12.5px; line-height: 1.5; color: var(--ink-subtle);\">AI Copilots em PI Planning, risk scoring e dependency detection.</p>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(2) > p",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#0e1330",
+               "contrastRatio": 2.43,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#46566d",
+               "fontSize": "8.3pt (11px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div style=\"background: var(--su...\">",
+                 "target": Array [
+                   ".grid-cols-1 > div:nth-child(2)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<span style=\"font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ink-faint);\">Alocação de investimento</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".grid-cols-1 > div:nth-child(2) > div:nth-child(3) > div:nth-child(1) > span:nth-child(1)",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#0e1330",
+               "contrastRatio": 2.43,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#46566d",
+               "fontSize": "8.3pt (11px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div style=\"background: var(--su...\">",
+                 "target": Array [
+                   ".grid-cols-1 > div:nth-child(2)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"font-mono\" style=\"font-size: 11px; color: var(--ink-faint); font-weight: 700;\">sem alvo definido</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(2) > div:nth-child(3) > div:nth-child(1) > span:nth-child(2) > .font-mono:nth-child(2)",
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
+               "fontSize": "9.0pt (12px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div style=\"background: var(--su...\">",
+                 "target": Array [
+                   ".grid-cols-1 > div:nth-child(2)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"font-mono\" style=\"font-size: 12px; color: var(--ink-subtle);\">H1 2026</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(2) > div:nth-child(4) > .font-mono",
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
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div style=\"background: var(--su...\">",
+                 "target": Array [
+                   ".grid-cols-1 > div:nth-child(3)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"font-mono\" style=\"font-size: 11px; color: var(--ink-subtle); font-weight: 600;\">THEME-003</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(3) > div:nth-child(1) > div > div:nth-child(1) > .font-mono",
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
+               "fontSize": "9.4pt (12.5px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div style=\"background: var(--su...\">",
+                 "target": Array [
+                   ".grid-cols-1 > div:nth-child(3)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<p style=\"margin: 0px; font-size: 12.5px; line-height: 1.5; color: var(--ink-subtle);\">LGPD, SOC2, multi-tenant RLS e auditoria completa para vendas enterprise.</p>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(3) > p",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#0e1330",
+               "contrastRatio": 2.43,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#46566d",
+               "fontSize": "8.3pt (11px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div style=\"background: var(--su...\">",
+                 "target": Array [
+                   ".grid-cols-1 > div:nth-child(3)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<span style=\"font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ink-faint);\">Alocação de investimento</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(3) > div:nth-child(3) > div:nth-child(1) > span:nth-child(1)",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#0e1330",
+               "contrastRatio": 2.43,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#46566d",
+               "fontSize": "8.3pt (11px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div style=\"background: var(--su...\">",
+                 "target": Array [
+                   ".grid-cols-1 > div:nth-child(3)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"font-mono\" style=\"font-size: 11px; color: var(--ink-faint); font-weight: 700;\">sem alvo definido</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(3) > div:nth-child(3) > div:nth-child(1) > span:nth-child(2) > .font-mono:nth-child(2)",
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
+               "fontSize": "9.0pt (12px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div style=\"background: var(--su...\">",
+                 "target": Array [
+                   ".grid-cols-1 > div:nth-child(3)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"font-mono\" style=\"font-size: 12px; color: var(--ink-subtle);\">2026</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(3) > div:nth-child(4) > .font-mono",
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
          - generic [ref=e241] [cursor=pointer]: Themes
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
              - generic [ref=e267]: Temas Estratégicos
          - generic [ref=e268]:
            - generic [ref=e269]:
              - generic [ref=e270]:
                - generic [ref=e271]: 3 temas ativos
                - generic [ref=e272]: 0 fora do alvo
                - generic [ref=e273]: Revisão trimestral
              - heading "Temas Estratégicos" [level=1] [ref=e274]
              - paragraph [ref=e275]: Como o investimento do portfolio se distribui entre as apostas estratégicas — alocação real vs. alvo de orçamento.
            - generic [ref=e276]:
              - link "Pilares Mapa estratégico" [ref=e277] [cursor=pointer]:
                - /url: /portfolio/strategy-map
                - img [ref=e279]
                - generic [ref=e282]:
                  - generic [ref=e283]: Pilares
                  - text: Mapa estratégico
              - button "Novo tema" [ref=e284] [cursor=pointer]:
                - img [ref=e285]
                - text: Novo tema
        - generic [ref=e287]:
          - generic [ref=e288]:
            - generic [ref=e289]:
              - img
              - img
              - img
              - generic [ref=e290]:
                - generic [ref=e291]: Investimento mapeado
                - img [ref=e293]
              - generic [ref=e295]: 100%
              - generic [ref=e296]: de todo o portfólio
            - generic [ref=e297]:
              - img
              - img
              - img
              - generic [ref=e298]:
                - generic [ref=e299]: Épicos sob temas
                - img [ref=e301]
              - generic [ref=e303]: "3"
              - generic [ref=e304]: vinculados a temas
            - generic [ref=e305]:
              - img
              - img
              - img
              - generic [ref=e306]:
                - generic [ref=e307]: Aderência ao alvo
                - img [ref=e309]
              - generic [ref=e311]: 0%
              - generic [ref=e312]: vs. alvo definido
          - generic [ref=e313]:
            - generic [ref=e314]:
              - generic [ref=e315]:
                - img [ref=e317]
                - generic [ref=e320]:
                  - generic [ref=e321]:
                    - generic [ref=e322]: THEME-001
                    - generic [ref=e323]: No alvo
                  - generic [ref=e325]: Acelerar time-to-market enterprise
              - paragraph [ref=e326]: Reduzir lead time de épicos críticos para clientes enterprise via SAFe + automação.
              - generic [ref=e328]:
                - generic [ref=e329]: Alocação de investimento
                - generic [ref=e330]:
                  - generic [ref=e331]: 45%
                  - generic [ref=e332]: sem alvo definido
              - generic [ref=e336]:
                - generic [ref=e337]:
                  - img [ref=e338]
                  - text: 1 épicos
                - generic [ref=e342]: "2026"
                - generic [ref=e344]: 82%
            - generic [ref=e348]:
              - generic [ref=e349]:
                - img [ref=e351]
                - generic [ref=e354]:
                  - generic [ref=e355]:
                    - generic [ref=e356]: THEME-002
                    - generic [ref=e357]: No alvo
                  - generic [ref=e359]: Inovação com IA aplicada ao SAFe
              - paragraph [ref=e360]: AI Copilots em PI Planning, risk scoring e dependency detection.
              - generic [ref=e362]:
                - generic [ref=e363]: Alocação de investimento
                - generic [ref=e364]:
                  - generic [ref=e365]: 33%
                  - generic [ref=e366]: sem alvo definido
              - generic [ref=e370]:
                - generic [ref=e371]:
                  - img [ref=e372]
                  - text: 1 épicos
                - generic [ref=e376]: H1 2026
                - generic [ref=e378]: 29%
            - generic [ref=e382]:
              - generic [ref=e383]:
                - img [ref=e385]
                - generic [ref=e388]:
                  - generic [ref=e389]:
                    - generic [ref=e390]: THEME-003
                    - generic [ref=e391]: No alvo
                  - generic [ref=e393]: Compliance & Segurança Enterprise
              - paragraph [ref=e394]: LGPD, SOC2, multi-tenant RLS e auditoria completa para vendas enterprise.
              - generic [ref=e396]:
                - generic [ref=e397]: Alocação de investimento
                - generic [ref=e398]:
                  - generic [ref=e399]: 22%
                  - generic [ref=e400]: sem alvo definido
              - generic [ref=e404]:
                - generic [ref=e405]:
                  - img [ref=e406]
                  - text: 1 épicos
                - generic [ref=e410]: "2026"
                - generic [ref=e412]: 37%
    - button "Abrir Copilot AI" [ref=e418] [cursor=pointer]:
      - img [ref=e419]
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e429] [cursor=pointer]:
    - img [ref=e430]
  - alert [ref=e433]
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
      |     ^ Error: [/portfolio/themes] Critical/serious violations: [
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