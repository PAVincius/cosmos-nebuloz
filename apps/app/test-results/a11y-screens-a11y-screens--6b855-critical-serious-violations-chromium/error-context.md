# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y-screens.spec.ts >> a11y screens — dynamic ART/Team routes @auth >> ART detail, Program Board and PI Planning have no critical/serious violations
- Location: e2e/a11y-screens.spec.ts:77:7

# Error details

```
Error: [/arts/[artId]] Critical/serious violations: [
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
              "fgColor": "#46566d",
              "bgColor": "#0e1330",
              "contrastRatio": 2.43,
              "fontSize": "8.3pt (11px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<section class=\"overflow-hidden rounded-lg border border-hairline bg-surface shadow-[var(--card-shadow)]\">",
                "target": [
                  "section:nth-child(1)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<div style=\"margin-top: 6px; font-size: 11px; color: var(--ink-faint);\">68% consumido · US$ 0.78M restante</div>",
        "target": [
          "section:nth-child(1) > .p-\\[18px\\] > div > div > div:nth-child(3)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#65748b",
              "bgColor": "#1a2150",
              "contrastRatio": 3.21,
              "fontSize": "8.3pt (11px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<span style=\"font-size: 11px; padding: 2px 7px; border-radius: 999px; background: var(--surface-3); border: 1px solid var(--hairline); color: var(--ink-subtle); font-family: &quot;JetBrains Mono&quot;, ui-monospace, monospace;\">EP-0042</span>",
                "target": [
                  ".p-\\[18px\\] > div > div:nth-child(1) > div > div > span:nth-child(2)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.21 (foreground color: #65748b, background color: #1a2150, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span style=\"font-size: 11px; padding: 2px 7px; border-radius: 999px; background: var(--surface-3); border: 1px solid var(--hairline); color: var(--ink-subtle); font-family: &quot;JetBrains Mono&quot;, ui-monospace, monospace;\">EP-0042</span>",
        "target": [
          ".p-\\[18px\\] > div > div:nth-child(1) > div > div > span:nth-child(2)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.21 (foreground color: #65748b, background color: #1a2150, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#65748b",
              "bgColor": "#1a2150",
              "contrastRatio": 3.21,
              "fontSize": "8.3pt (11px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<span style=\"font-size: 11px; padding: 2px 7px; border-radius: 999px; background: var(--surface-3); border: 1px solid var(--hairline); color: var(--ink-subtle); font-family: &quot;JetBrains Mono&quot;, ui-monospace, monospace;\">EP-0042</span>",
                "target": [
                  "section:nth-child(2) > .p-\\[18px\\] > div > div:nth-child(2) > div > div > span:nth-child(2)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.21 (foreground color: #65748b, background color: #1a2150, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span style=\"font-size: 11px; padding: 2px 7px; border-radius: 999px; background: var(--surface-3); border: 1px solid var(--hairline); color: var(--ink-subtle); font-family: &quot;JetBrains Mono&quot;, ui-monospace, monospace;\">EP-0042</span>",
        "target": [
          "section:nth-child(2) > .p-\\[18px\\] > div > div:nth-child(2) > div > div > span:nth-child(2)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.21 (foreground color: #65748b, background color: #1a2150, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#65748b",
              "bgColor": "#1a2150",
              "contrastRatio": 3.21,
              "fontSize": "8.3pt (11px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<span style=\"font-size: 11px; padding: 2px 7px; border-radius: 999px; background: var(--surface-3); border: 1px solid var(--hairline); color: var(--ink-subtle); font-family: &quot;JetBrains Mono&quot;, ui-monospace, monospace;\">EP-0042</span>",
                "target": [
                  ".p-\\[18px\\] > div > div:nth-child(3) > div > div > span:nth-child(2)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.21 (foreground color: #65748b, background color: #1a2150, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span style=\"font-size: 11px; padding: 2px 7px; border-radius: 999px; background: var(--surface-3); border: 1px solid var(--hairline); color: var(--ink-subtle); font-family: &quot;JetBrains Mono&quot;, ui-monospace, monospace;\">EP-0042</span>",
        "target": [
          ".p-\\[18px\\] > div > div:nth-child(3) > div > div > span:nth-child(2)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.21 (foreground color: #65748b, background color: #1a2150, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#7f8083",
              "bgColor": "#121738",
              "contrastRatio": 4.41,
              "fontSize": "9.0pt (12px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div class=\"flex min-w-0 flex-1 flex-col rounded-lg border px-3 py-2.5 border-[#5e6ad2]/40 bg-[#5e6ad2]/5\">",
                "target": [
                  ".items-start.gap-3.flex:nth-child(1) > .py-2\\.5.border-\\[\\#5e6ad2\\]\\/40.bg-\\[\\#5e6ad2\\]\\/5"
                ]
              },
              {
                "html": "<section class=\"overflow-hidden rounded-lg border border-hairline bg-surface shadow-[var(--card-shadow)]\">",
                "target": [
                  "section:nth-child(4)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 4.41 (foreground color: #7f8083, background color: #121738, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"mt-0.5 text-muted-foreground text-xs tabular-nums\">07 de jun. de 2026</span>",
        "target": [
          ".items-start.gap-3.flex:nth-child(1) > .py-2\\.5.border-\\[\\#5e6ad2\\]\\/40.bg-\\[\\#5e6ad2\\]\\/5 > .mt-0\\.5.tabular-nums.text-muted-foreground"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 4.41 (foreground color: #7f8083, background color: #121738, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#7f8083",
              "bgColor": "#121738",
              "contrastRatio": 4.41,
              "fontSize": "9.0pt (12px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div class=\"flex min-w-0 flex-1 flex-col rounded-lg border px-3 py-2.5 border-[#5e6ad2]/40 bg-[#5e6ad2]/5\">",
                "target": [
                  ".items-start.gap-3.flex:nth-child(2) > .py-2\\.5.border-\\[\\#5e6ad2\\]\\/40.bg-\\[\\#5e6ad2\\]\\/5"
                ]
              },
              {
                "html": "<section class=\"overflow-hidden rounded-lg border border-hairline bg-surface shadow-[var(--card-shadow)]\">",
                "target": [
                  "section:nth-child(4)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 4.41 (foreground color: #7f8083, background color: #121738, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"mt-0.5 text-muted-foreground text-xs tabular-nums\">02 de ago. de 2026</span>",
        "target": [
          ".items-start.gap-3.flex:nth-child(2) > .py-2\\.5.border-\\[\\#5e6ad2\\]\\/40.bg-\\[\\#5e6ad2\\]\\/5 > .mt-0\\.5.tabular-nums.text-muted-foreground"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 4.41 (foreground color: #7f8083, background color: #121738, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#7f8083",
              "bgColor": "#121738",
              "contrastRatio": 4.41,
              "fontSize": "9.0pt (12px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div class=\"flex min-w-0 flex-1 flex-col rounded-lg border px-3 py-2.5 border-[#5e6ad2]/40 bg-[#5e6ad2]/5\">",
                "target": [
                  ".items-start.gap-3.flex:nth-child(3) > .py-2\\.5.border-\\[\\#5e6ad2\\]\\/40.bg-\\[\\#5e6ad2\\]\\/5"
                ]
              },
              {
                "html": "<section class=\"overflow-hidden rounded-lg border border-hairline bg-surface shadow-[var(--card-shadow)]\">",
                "target": [
                  "section:nth-child(4)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 4.41 (foreground color: #7f8083, background color: #121738, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"mt-0.5 text-muted-foreground text-xs tabular-nums\">16 de ago. de 2026</span>",
        "target": [
          ".items-start.gap-3.flex:nth-child(3) > .py-2\\.5.border-\\[\\#5e6ad2\\]\\/40.bg-\\[\\#5e6ad2\\]\\/5 > .mt-0\\.5.tabular-nums.text-muted-foreground"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 4.41 (foreground color: #7f8083, background color: #121738, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1"
      }
    ]
  }
]

expect(received).toEqual(expected) // deep equality

- Expected  -   1
+ Received  + 286

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
+               "contrastRatio": 2.43,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#46566d",
+               "fontSize": "8.3pt (11px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<section class=\"overflow-hidden rounded-lg border border-hairline bg-surface shadow-[var(--card-shadow)]\">",
+                 "target": Array [
+                   "section:nth-child(1)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<div style=\"margin-top: 6px; font-size: 11px; color: var(--ink-faint);\">68% consumido · US$ 0.78M restante</div>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "section:nth-child(1) > .p-\\[18px\\] > div > div > div:nth-child(3)",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#1a2150",
+               "contrastRatio": 3.21,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#65748b",
+               "fontSize": "8.3pt (11px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.21 (foreground color: #65748b, background color: #1a2150, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<span style=\"font-size: 11px; padding: 2px 7px; border-radius: 999px; background: var(--surface-3); border: 1px solid var(--hairline); color: var(--ink-subtle); font-family: &quot;JetBrains Mono&quot;, ui-monospace, monospace;\">EP-0042</span>",
+                 "target": Array [
+                   ".p-\\[18px\\] > div > div:nth-child(1) > div > div > span:nth-child(2)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.21 (foreground color: #65748b, background color: #1a2150, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span style=\"font-size: 11px; padding: 2px 7px; border-radius: 999px; background: var(--surface-3); border: 1px solid var(--hairline); color: var(--ink-subtle); font-family: &quot;JetBrains Mono&quot;, ui-monospace, monospace;\">EP-0042</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".p-\\[18px\\] > div > div:nth-child(1) > div > div > span:nth-child(2)",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#1a2150",
+               "contrastRatio": 3.21,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#65748b",
+               "fontSize": "8.3pt (11px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.21 (foreground color: #65748b, background color: #1a2150, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<span style=\"font-size: 11px; padding: 2px 7px; border-radius: 999px; background: var(--surface-3); border: 1px solid var(--hairline); color: var(--ink-subtle); font-family: &quot;JetBrains Mono&quot;, ui-monospace, monospace;\">EP-0042</span>",
+                 "target": Array [
+                   "section:nth-child(2) > .p-\\[18px\\] > div > div:nth-child(2) > div > div > span:nth-child(2)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.21 (foreground color: #65748b, background color: #1a2150, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span style=\"font-size: 11px; padding: 2px 7px; border-radius: 999px; background: var(--surface-3); border: 1px solid var(--hairline); color: var(--ink-subtle); font-family: &quot;JetBrains Mono&quot;, ui-monospace, monospace;\">EP-0042</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "section:nth-child(2) > .p-\\[18px\\] > div > div:nth-child(2) > div > div > span:nth-child(2)",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#1a2150",
+               "contrastRatio": 3.21,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#65748b",
+               "fontSize": "8.3pt (11px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.21 (foreground color: #65748b, background color: #1a2150, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<span style=\"font-size: 11px; padding: 2px 7px; border-radius: 999px; background: var(--surface-3); border: 1px solid var(--hairline); color: var(--ink-subtle); font-family: &quot;JetBrains Mono&quot;, ui-monospace, monospace;\">EP-0042</span>",
+                 "target": Array [
+                   ".p-\\[18px\\] > div > div:nth-child(3) > div > div > span:nth-child(2)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.21 (foreground color: #65748b, background color: #1a2150, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span style=\"font-size: 11px; padding: 2px 7px; border-radius: 999px; background: var(--surface-3); border: 1px solid var(--hairline); color: var(--ink-subtle); font-family: &quot;JetBrains Mono&quot;, ui-monospace, monospace;\">EP-0042</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".p-\\[18px\\] > div > div:nth-child(3) > div > div > span:nth-child(2)",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#121738",
+               "contrastRatio": 4.41,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#7f8083",
+               "fontSize": "9.0pt (12px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.41 (foreground color: #7f8083, background color: #121738, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"flex min-w-0 flex-1 flex-col rounded-lg border px-3 py-2.5 border-[#5e6ad2]/40 bg-[#5e6ad2]/5\">",
+                 "target": Array [
+                   ".items-start.gap-3.flex:nth-child(1) > .py-2\\.5.border-\\[\\#5e6ad2\\]\\/40.bg-\\[\\#5e6ad2\\]\\/5",
+                 ],
+               },
+               Object {
+                 "html": "<section class=\"overflow-hidden rounded-lg border border-hairline bg-surface shadow-[var(--card-shadow)]\">",
+                 "target": Array [
+                   "section:nth-child(4)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.41 (foreground color: #7f8083, background color: #121738, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"mt-0.5 text-muted-foreground text-xs tabular-nums\">07 de jun. de 2026</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".items-start.gap-3.flex:nth-child(1) > .py-2\\.5.border-\\[\\#5e6ad2\\]\\/40.bg-\\[\\#5e6ad2\\]\\/5 > .mt-0\\.5.tabular-nums.text-muted-foreground",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#121738",
+               "contrastRatio": 4.41,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#7f8083",
+               "fontSize": "9.0pt (12px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.41 (foreground color: #7f8083, background color: #121738, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"flex min-w-0 flex-1 flex-col rounded-lg border px-3 py-2.5 border-[#5e6ad2]/40 bg-[#5e6ad2]/5\">",
+                 "target": Array [
+                   ".items-start.gap-3.flex:nth-child(2) > .py-2\\.5.border-\\[\\#5e6ad2\\]\\/40.bg-\\[\\#5e6ad2\\]\\/5",
+                 ],
+               },
+               Object {
+                 "html": "<section class=\"overflow-hidden rounded-lg border border-hairline bg-surface shadow-[var(--card-shadow)]\">",
+                 "target": Array [
+                   "section:nth-child(4)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.41 (foreground color: #7f8083, background color: #121738, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"mt-0.5 text-muted-foreground text-xs tabular-nums\">02 de ago. de 2026</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".items-start.gap-3.flex:nth-child(2) > .py-2\\.5.border-\\[\\#5e6ad2\\]\\/40.bg-\\[\\#5e6ad2\\]\\/5 > .mt-0\\.5.tabular-nums.text-muted-foreground",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#121738",
+               "contrastRatio": 4.41,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#7f8083",
+               "fontSize": "9.0pt (12px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.41 (foreground color: #7f8083, background color: #121738, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"flex min-w-0 flex-1 flex-col rounded-lg border px-3 py-2.5 border-[#5e6ad2]/40 bg-[#5e6ad2]/5\">",
+                 "target": Array [
+                   ".items-start.gap-3.flex:nth-child(3) > .py-2\\.5.border-\\[\\#5e6ad2\\]\\/40.bg-\\[\\#5e6ad2\\]\\/5",
+                 ],
+               },
+               Object {
+                 "html": "<section class=\"overflow-hidden rounded-lg border border-hairline bg-surface shadow-[var(--card-shadow)]\">",
+                 "target": Array [
+                   "section:nth-child(4)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.41 (foreground color: #7f8083, background color: #121738, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"mt-0.5 text-muted-foreground text-xs tabular-nums\">16 de ago. de 2026</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".items-start.gap-3.flex:nth-child(3) > .py-2\\.5.border-\\[\\#5e6ad2\\]\\/40.bg-\\[\\#5e6ad2\\]\\/5 > .mt-0\\.5.tabular-nums.text-muted-foreground",
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
              - button "Toggle" [expanded] [ref=e57] [cursor=pointer]:
                - img [ref=e58]
                - generic [ref=e60]: Toggle
              - list [ref=e62]:
                - listitem [ref=e63]:
                  - link "Todos os ARTs" [ref=e64] [cursor=pointer]:
                    - /url: /arts
                    - generic [ref=e65]: Todos os ARTs
                - listitem [ref=e66]:
                  - link "PI Planning" [ref=e67] [cursor=pointer]:
                    - /url: /pi-planning
                    - generic [ref=e68]: PI Planning
                - listitem [ref=e69]:
                  - link "Dependências" [ref=e70] [cursor=pointer]:
                    - /url: /dependencies
                    - generic [ref=e71]: Dependências
            - listitem [ref=e72]:
              - link "Times" [ref=e73] [cursor=pointer]:
                - /url: /teams
                - img [ref=e74]
                - generic [ref=e79]: Times
              - button "Toggle" [ref=e80] [cursor=pointer]:
                - img [ref=e81]
                - generic [ref=e83]: Toggle
            - listitem [ref=e84]:
              - link "Analytics" [ref=e85] [cursor=pointer]:
                - /url: /analytics
                - img [ref=e86]
                - generic [ref=e88]: Analytics
              - button "Toggle" [ref=e89] [cursor=pointer]:
                - img [ref=e90]
                - generic [ref=e92]: Toggle
            - listitem [ref=e93]:
              - link "Workflows" [ref=e94] [cursor=pointer]:
                - /url: /workflows
                - img [ref=e95]
                - generic [ref=e99]: Workflows
              - button "Toggle" [ref=e100] [cursor=pointer]:
                - img [ref=e101]
                - generic [ref=e103]: Toggle
            - listitem [ref=e104]:
              - link "Large Solution" [ref=e105] [cursor=pointer]:
                - /url: /solution-trains
                - img [ref=e106]
                - generic [ref=e109]: Large Solution
              - button "Toggle" [ref=e110] [cursor=pointer]:
                - img [ref=e111]
                - generic [ref=e113]: Toggle
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
          - generic [ref=e215]:
            - generic [ref=e216] [cursor=pointer]: Arts
            - img [ref=e217]
          - generic [ref=e220] [cursor=pointer]: Cmr8j4f5e0002icpxgfhrg988
        - generic [ref=e221]:
          - group "Trocar persona" [ref=e222]:
            - button "RTE" [ref=e223] [cursor=pointer]: RTE
            - button "LPM" [pressed] [ref=e225] [cursor=pointer]: LPM
            - button "PO" [ref=e227] [cursor=pointer]: PO
            - button "SM" [ref=e229] [cursor=pointer]: SM
            - button "DEV" [ref=e231] [cursor=pointer]: DEV
          - button "Buscar" [ref=e233] [cursor=pointer]:
            - img [ref=e234]
          - generic "Admin E2E · admin@cosmos.local" [ref=e237]: AE
      - generic [ref=e238]:
        - generic [ref=e239]:
          - link "Agile Release Train" [ref=e241] [cursor=pointer]:
            - /url: /arts
          - generic [ref=e242]:
            - generic [ref=e243]:
              - generic [ref=e244]:
                - heading "Plataforma COSMOS" [level=1] [ref=e245]
                - generic [ref=e246]: INACTIVE
                - generic [ref=e248]: 10 sem · IP on
              - generic [ref=e249]:
                - generic [ref=e250]:
                  - generic [ref=e251]: PI ATIVO
                  - link "PI 2026-Q2" [ref=e253] [cursor=pointer]:
                    - /url: /arts/cmr8j4f5e0002icpxgfhrg988/pi-planning?piId=cmr8j4f5p0009icpxoxqax315
                - generic [ref=e254]:
                  - generic [ref=e255]: ROADMAP
                  - link "Multi-PI" [ref=e257] [cursor=pointer]:
                    - /url: /portfolio/roadmap
                - generic [ref=e258]:
                  - generic [ref=e259]: BUDGET FLOW
                  - link "Lean Budget" [ref=e261] [cursor=pointer]:
                    - /url: /portfolio/budgets?artId=cmr8j4f5e0002icpxgfhrg988
                - generic [ref=e262]:
                  - generic [ref=e263]: PIS ANTERIORES
                  - generic [ref=e265]: 0 finalizados
            - generic [ref=e266]:
              - link "Program Board" [ref=e267] [cursor=pointer]:
                - /url: /arts/cmr8j4f5e0002icpxgfhrg988/program-board?piPlanId=cmr8j4f5p0009icpxoxqax315
                - img [ref=e268]
                - text: Program Board
              - button "PI Planning" [ref=e273] [cursor=pointer]:
                - img
                - text: PI Planning
        - generic [ref=e275]:
          - generic [ref=e276]:
            - generic [ref=e277]:
              - img
              - img
              - img
              - generic [ref=e278]:
                - generic [ref=e279]: Confidence Vote
                - img [ref=e281]
              - generic [ref=e283]: 4.1/5
              - generic [ref=e284]: ↗ Acima do threshold
            - generic [ref=e285]:
              - img
              - img
              - img
              - generic [ref=e286]:
                - generic [ref=e287]: Program Predictability
                - img [ref=e289]
              - generic [ref=e291]: 0%
              - generic [ref=e292]: — PPM do PI atual
            - generic [ref=e293]:
              - img
              - img
              - img
              - generic [ref=e294]:
                - generic [ref=e295]: Predictability histórica
                - img [ref=e297]
              - generic [ref=e299]: 0%
              - generic [ref=e300]: — Últimos PIs
            - generic [ref=e301]:
              - img
              - img
              - img
              - generic [ref=e302]:
                - generic [ref=e303]: Budget consumido
                - img [ref=e305]
              - generic [ref=e307]: US$ 1.62M
              - generic [ref=e308]: — de US$ 2.40M alocado
          - generic [ref=e309]:
            - generic [ref=e310]:
              - generic [ref=e311]:
                - img [ref=e313]
                - generic [ref=e315]:
                  - generic [ref=e316]: Lean Budget da ART
                  - generic [ref=e317]: Alocado vs consumido
              - generic [ref=e320]:
                - generic [ref=e321]:
                  - generic [ref=e322]: Consumo do orçamento
                  - generic [ref=e323]: US$ 1.62M / US$ 2.40M
                - generic [ref=e326]: 68% consumido · US$ 0.78M restante
            - generic [ref=e327]:
              - generic [ref=e328]:
                - img [ref=e330]
                - generic [ref=e332]:
                  - generic [ref=e333]: Strategic Themes
                  - generic [ref=e334]: Épicos linkados por tema
              - generic [ref=e336]:
                - generic [ref=e337]:
                  - generic [ref=e338]:
                    - generic [ref=e339]: Acelerar time-to-market enterprise
                    - generic [ref=e340]:
                      - generic [ref=e341]: 1 épico
                      - generic [ref=e342]: EP-0042
                  - generic [ref=e343]: US$ 2.50M
                - generic [ref=e344]:
                  - generic [ref=e345]:
                    - generic [ref=e346]: Inovação com IA aplicada ao SAFe
                    - generic [ref=e347]:
                      - generic [ref=e348]: 1 épico
                      - generic [ref=e349]: EP-0042
                  - generic [ref=e350]: US$ 1.80M
                - generic [ref=e351]:
                  - generic [ref=e352]:
                    - generic [ref=e353]: Compliance & Segurança Enterprise
                    - generic [ref=e354]:
                      - generic [ref=e355]: 1 épico
                      - generic [ref=e356]: EP-0042
                  - generic [ref=e357]: US$ 1.20M
          - generic [ref=e358]:
            - link "Impedimentos" [ref=e359] [cursor=pointer]:
              - /url: /arts/cmr8j4f5e0002icpxgfhrg988/impediments
              - button "Impedimentos" [ref=e360]:
                - img [ref=e361]
                - text: Impedimentos
            - link "Flow Metrics" [ref=e363] [cursor=pointer]:
              - /url: /analytics/flow?scope=art&scopeId=cmr8j4f5e0002icpxgfhrg988
              - button "Flow Metrics" [ref=e364]:
                - img [ref=e365]
                - text: Flow Metrics
            - link "OKRs do ART" [ref=e368] [cursor=pointer]:
              - /url: /portfolio/okrs?artId=cmr8j4f5e0002icpxgfhrg988
              - button "OKRs do ART" [ref=e369]:
                - img [ref=e370]
                - text: OKRs do ART
            - link "PI Workspace" [ref=e374] [cursor=pointer]:
              - /url: /arts/cmr8j4f5e0002icpxgfhrg988/pi-planning?piId=cmr8j4f5p0009icpxoxqax315
              - button "PI Workspace" [ref=e375]:
                - img [ref=e376]
                - text: PI Workspace
            - link "Inspect & Adapt" [ref=e378] [cursor=pointer]:
              - /url: /arts/cmr8j4f5e0002icpxgfhrg988/post-pi?piPlanId=cmr8j4f5p0009icpxoxqax315
              - button "Inspect & Adapt" [ref=e379]:
                - img [ref=e380]
                - text: Inspect & Adapt
          - generic [ref=e382]:
            - generic [ref=e383]:
              - img [ref=e385]
              - generic [ref=e387]:
                - generic [ref=e388]: Timeline de Eventos
                - generic [ref=e389]: PI Planning, System Demo e Inspect & Adapt por PI
            - generic [ref=e393]:
              - generic [ref=e394]:
                - img [ref=e396]
                - generic [ref=e399]:
                  - generic [ref=e400]:
                    - generic [ref=e401]: PI Planning – PI 2026-Q2
                    - generic [ref=e402]: Atual
                  - generic [ref=e403]: 07 de jun. de 2026
              - generic [ref=e404]:
                - img [ref=e406]
                - generic [ref=e408]:
                  - generic [ref=e409]:
                    - generic [ref=e410]: System Demo – PI 2026-Q2
                    - generic [ref=e411]: Atual
                  - generic [ref=e412]: 02 de ago. de 2026
              - generic [ref=e413]:
                - img [ref=e415]
                - generic [ref=e420]:
                  - generic [ref=e421]:
                    - generic [ref=e422]: Inspect & Adapt – PI 2026-Q2
                    - generic [ref=e423]: Atual
                  - generic [ref=e424]: 16 de ago. de 2026
          - generic [ref=e425]:
            - generic [ref=e426]:
              - img [ref=e428]
              - generic [ref=e430]:
                - generic [ref=e431]: Saúde do ART
                - generic [ref=e432]: Riscos ativos, predictability e objetivos por PI
            - generic [ref=e434]:
              - generic [ref=e435]:
                - generic [ref=e436]:
                  - generic [ref=e437]:
                    - img [ref=e438]
                    - text: Riscos Ativos
                  - generic [ref=e440]: "3"
                  - paragraph [ref=e441]: 2 sem plano
                - generic [ref=e442]:
                  - generic [ref=e443]:
                    - img [ref=e444]
                    - text: Predictability
                  - generic [ref=e447]: 0%
                  - paragraph [ref=e448]: PI 2026-Q2
                - generic [ref=e449]:
                  - generic [ref=e450]:
                    - img [ref=e451]
                    - text: PIs Planejados
                  - generic [ref=e455]: "1"
                  - paragraph [ref=e456]: histórico total
                - generic [ref=e457]:
                  - generic [ref=e458]:
                    - img [ref=e459]
                    - text: Objetivos Alcançados
                  - generic [ref=e462]: "0"
                  - paragraph [ref=e463]: total acumulado
              - generic [ref=e464]:
                - heading "Predictability por PI" [level=4] [ref=e465]
                - generic [ref=e467]:
                  - generic [ref=e468]:
                    - generic [ref=e469]:
                      - generic [ref=e470]: PI 2026-Q2
                      - generic [ref=e471]: 1 stretch
                    - paragraph [ref=e472]: 0/4 objetivos alcançados
                  - generic [ref=e475]: 0%
    - button "Abrir Copilot AI" [ref=e478] [cursor=pointer]:
      - img [ref=e479]
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e489] [cursor=pointer]:
    - img [ref=e490]
  - alert [ref=e493]
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
      |     ^ Error: [/arts/[artId]] Critical/serious violations: [
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