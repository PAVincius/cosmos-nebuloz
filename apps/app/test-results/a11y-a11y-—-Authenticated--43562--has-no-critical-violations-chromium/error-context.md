# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y.spec.ts >> a11y — Authenticated pages @auth >> dashboard has no critical violations
- Location: e2e/a11y.spec.ts:43:7

# Error details

```
Error: Critical/serious violations: [
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
              "fontSize": "9.4pt (12.5px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div style=\"border: 1px solid var(--hairline); border-radius: 14px; background: var(--surface); overflow: hidden; box-shadow: rgba(255, 255, 255, 0.03) 0px 1px 0px inset, rgba(0, 0, 0, 0.9) 0px 12px 28px -22px;\">",
                "target": [
                  "div:nth-child(3) > div > div:nth-child(2) > div:nth-child(2) > div:nth-child(1)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<div style=\"padding: 24px 12px; text-align: center; font-size: 12.5px; color: var(--ink-faint);\">Nenhuma sprint fechada ainda.</div>",
        "target": [
          "div:nth-child(2) > div:nth-child(2) > div:nth-child(1) > div:nth-child(2) > div"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1"
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
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div style=\"border: 1px solid var(--hairline); border-radius: 14px; background: var(--surface); overflow: hidden; box-shadow: rgba(255, 255, 255, 0.03) 0px 1px 0px inset, rgba(0, 0, 0, 0.9) 0px 12px 28px -22px;\">",
                "target": [
                  "div:nth-child(3) > div > div:nth-child(2) > div:nth-child(2) > div:nth-child(2)"
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
        "html": "<div class=\"font-mono\" style=\"font-size: 11px; color: var(--ink-faint);\">PI 2026-Q2</div>",
        "target": [
          ".font-mono:nth-child(3)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#46566d",
              "bgColor": "#0e1330",
              "contrastRatio": 2.43,
              "fontSize": "9.0pt (12px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div style=\"border: 1px solid var(--hairline); border-radius: 14px; background: var(--surface); overflow: hidden; box-shadow: rgba(255, 255, 255, 0.03) 0px 1px 0px inset, rgba(0, 0, 0, 0.9) 0px 12px 28px -22px;\">",
                "target": [
                  "div:nth-child(2) > div:nth-child(3) > div:nth-child(1)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<div style=\"display: grid; place-items: center; height: 120px; font-size: 12px; color: var(--ink-faint);\">Sem custo de nuvem registrado neste mês.</div>",
        "target": [
          "div:nth-child(2) > div:nth-child(3) > div:nth-child(1) > div:nth-child(2) > div"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#8b5cf6",
              "bgColor": "#141a3d",
              "contrastRatio": 3.98,
              "fontSize": "7.9pt (10.5px)",
              "fontWeight": "bold",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<a class=\"transition-transform duration-150 hover:-translate-y-0.5\" href=\"/epics/cmr8j4f6l001dicpx8n08ujxx\" style=\"display: flex; align-items: center; gap: 14px; padding: 11px 12px; border-radius: 10px; border: 1px solid var(--hairline); background: var(--surface-2); text-decoration: none;\">",
                "target": [
                  ".hover\\:-translate-y-0\\.5.transition-transform.duration-150:nth-child(1)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.98 (foreground color: #8b5cf6, background color: #141a3d, font size: 7.9pt (10.5px), font weight: bold). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span style=\"display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 700; color: rgb(139, 92, 246); white-space: nowrap;\"><span style=\"width: 6px; height: 6px; border-radius: 50%; background: rgb(139, 92, 246);\"></span>Inovação com IA aplicada ao SAFe</span>",
        "target": [
          ".hover\\:-translate-y-0\\.5.transition-transform.duration-150:nth-child(1) > span"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.98 (foreground color: #8b5cf6, background color: #141a3d, font size: 7.9pt (10.5px), font weight: bold). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#46566d",
              "bgColor": "#141a3d",
              "contrastRatio": 2.25,
              "fontSize": "8.3pt (11px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<a class=\"transition-transform duration-150 hover:-translate-y-0.5\" href=\"/epics/cmr8j4f6l001dicpx8n08ujxx\" style=\"display: flex; align-items: center; gap: 14px; padding: 11px 12px; border-radius: 10px; border: 1px solid var(--hairline); background: var(--surface-2); text-decoration: none;\">",
                "target": [
                  ".hover\\:-translate-y-0\\.5.transition-transform.duration-150:nth-child(1)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span style=\"color: var(--ink-faint);\">0%</span>",
        "target": [
          ".hover\\:-translate-y-0\\.5.transition-transform.duration-150:nth-child(1) > div:nth-child(3) > div:nth-child(1) > span:nth-child(1)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#6366f1",
              "bgColor": "#141a3d",
              "contrastRatio": 3.77,
              "fontSize": "7.9pt (10.5px)",
              "fontWeight": "bold",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<a class=\"transition-transform duration-150 hover:-translate-y-0.5\" href=\"/epics/cmr8j4f6k001cicpxi2hp5yh3\" style=\"display: flex; align-items: center; gap: 14px; padding: 11px 12px; border-radius: 10px; border: 1px solid var(--hairline); background: var(--surface-2); text-decoration: none;\">",
                "target": [
                  ".hover\\:-translate-y-0\\.5.transition-transform.duration-150:nth-child(2)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.77 (foreground color: #6366f1, background color: #141a3d, font size: 7.9pt (10.5px), font weight: bold). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span style=\"display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 700; color: rgb(99, 102, 241); white-space: nowrap;\"><span style=\"width: 6px; height: 6px; border-radius: 50%; background: rgb(99, 102, 241);\"></span>Acelerar time-to-market enterprise</span>",
        "target": [
          ".hover\\:-translate-y-0\\.5.transition-transform.duration-150:nth-child(2) > span"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.77 (foreground color: #6366f1, background color: #141a3d, font size: 7.9pt (10.5px), font weight: bold). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#46566d",
              "bgColor": "#141a3d",
              "contrastRatio": 2.25,
              "fontSize": "8.3pt (11px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<a class=\"transition-transform duration-150 hover:-translate-y-0.5\" href=\"/epics/cmr8j4f6k001cicpxi2hp5yh3\" style=\"display: flex; align-items: center; gap: 14px; padding: 11px 12px; border-radius: 10px; border: 1px solid var(--hairline); background: var(--surface-2); text-decoration: none;\">",
                "target": [
                  ".hover\\:-translate-y-0\\.5.transition-transform.duration-150:nth-child(2)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span style=\"color: var(--ink-faint);\">0%</span>",
        "target": [
          ".hover\\:-translate-y-0\\.5.transition-transform.duration-150:nth-child(2) > div:nth-child(3) > div:nth-child(1) > span:nth-child(1)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
      }
    ]
  }
]

expect(received).toEqual(expected) // deep equality

- Expected  -   1
+ Received  + 268

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
+               "fontSize": "9.4pt (12.5px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div style=\"border: 1px solid var(--hairline); border-radius: 14px; background: var(--surface); overflow: hidden; box-shadow: rgba(255, 255, 255, 0.03) 0px 1px 0px inset, rgba(0, 0, 0, 0.9) 0px 12px 28px -22px;\">",
+                 "target": Array [
+                   "div:nth-child(3) > div > div:nth-child(2) > div:nth-child(2) > div:nth-child(1)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<div style=\"padding: 24px 12px; text-align: center; font-size: 12.5px; color: var(--ink-faint);\">Nenhuma sprint fechada ainda.</div>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(2) > div:nth-child(2) > div:nth-child(1) > div:nth-child(2) > div",
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
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div style=\"border: 1px solid var(--hairline); border-radius: 14px; background: var(--surface); overflow: hidden; box-shadow: rgba(255, 255, 255, 0.03) 0px 1px 0px inset, rgba(0, 0, 0, 0.9) 0px 12px 28px -22px;\">",
+                 "target": Array [
+                   "div:nth-child(3) > div > div:nth-child(2) > div:nth-child(2) > div:nth-child(2)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<div class=\"font-mono\" style=\"font-size: 11px; color: var(--ink-faint);\">PI 2026-Q2</div>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".font-mono:nth-child(3)",
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
+               "fontSize": "9.0pt (12px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div style=\"border: 1px solid var(--hairline); border-radius: 14px; background: var(--surface); overflow: hidden; box-shadow: rgba(255, 255, 255, 0.03) 0px 1px 0px inset, rgba(0, 0, 0, 0.9) 0px 12px 28px -22px;\">",
+                 "target": Array [
+                   "div:nth-child(2) > div:nth-child(3) > div:nth-child(1)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.43 (foreground color: #46566d, background color: #0e1330, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<div style=\"display: grid; place-items: center; height: 120px; font-size: 12px; color: var(--ink-faint);\">Sem custo de nuvem registrado neste mês.</div>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(2) > div:nth-child(3) > div:nth-child(1) > div:nth-child(2) > div",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#141a3d",
+               "contrastRatio": 3.98,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#8b5cf6",
+               "fontSize": "7.9pt (10.5px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.98 (foreground color: #8b5cf6, background color: #141a3d, font size: 7.9pt (10.5px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<a class=\"transition-transform duration-150 hover:-translate-y-0.5\" href=\"/epics/cmr8j4f6l001dicpx8n08ujxx\" style=\"display: flex; align-items: center; gap: 14px; padding: 11px 12px; border-radius: 10px; border: 1px solid var(--hairline); background: var(--surface-2); text-decoration: none;\">",
+                 "target": Array [
+                   ".hover\\:-translate-y-0\\.5.transition-transform.duration-150:nth-child(1)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.98 (foreground color: #8b5cf6, background color: #141a3d, font size: 7.9pt (10.5px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<span style=\"display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 700; color: rgb(139, 92, 246); white-space: nowrap;\"><span style=\"width: 6px; height: 6px; border-radius: 50%; background: rgb(139, 92, 246);\"></span>Inovação com IA aplicada ao SAFe</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".hover\\:-translate-y-0\\.5.transition-transform.duration-150:nth-child(1) > span",
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
+               "fontSize": "8.3pt (11px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<a class=\"transition-transform duration-150 hover:-translate-y-0.5\" href=\"/epics/cmr8j4f6l001dicpx8n08ujxx\" style=\"display: flex; align-items: center; gap: 14px; padding: 11px 12px; border-radius: 10px; border: 1px solid var(--hairline); background: var(--surface-2); text-decoration: none;\">",
+                 "target": Array [
+                   ".hover\\:-translate-y-0\\.5.transition-transform.duration-150:nth-child(1)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span style=\"color: var(--ink-faint);\">0%</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".hover\\:-translate-y-0\\.5.transition-transform.duration-150:nth-child(1) > div:nth-child(3) > div:nth-child(1) > span:nth-child(1)",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#141a3d",
+               "contrastRatio": 3.77,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#6366f1",
+               "fontSize": "7.9pt (10.5px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.77 (foreground color: #6366f1, background color: #141a3d, font size: 7.9pt (10.5px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<a class=\"transition-transform duration-150 hover:-translate-y-0.5\" href=\"/epics/cmr8j4f6k001cicpxi2hp5yh3\" style=\"display: flex; align-items: center; gap: 14px; padding: 11px 12px; border-radius: 10px; border: 1px solid var(--hairline); background: var(--surface-2); text-decoration: none;\">",
+                 "target": Array [
+                   ".hover\\:-translate-y-0\\.5.transition-transform.duration-150:nth-child(2)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.77 (foreground color: #6366f1, background color: #141a3d, font size: 7.9pt (10.5px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<span style=\"display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 700; color: rgb(99, 102, 241); white-space: nowrap;\"><span style=\"width: 6px; height: 6px; border-radius: 50%; background: rgb(99, 102, 241);\"></span>Acelerar time-to-market enterprise</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".hover\\:-translate-y-0\\.5.transition-transform.duration-150:nth-child(2) > span",
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
+               "fontSize": "8.3pt (11px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<a class=\"transition-transform duration-150 hover:-translate-y-0.5\" href=\"/epics/cmr8j4f6k001cicpxi2hp5yh3\" style=\"display: flex; align-items: center; gap: 14px; padding: 11px 12px; border-radius: 10px; border: 1px solid var(--hairline); background: var(--surface-2); text-decoration: none;\">",
+                 "target": Array [
+                   ".hover\\:-translate-y-0\\.5.transition-transform.duration-150:nth-child(2)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span style=\"color: var(--ink-faint);\">0%</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".hover\\:-translate-y-0\\.5.transition-transform.duration-150:nth-child(2) > div:nth-child(3) > div:nth-child(1) > span:nth-child(1)",
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
          - generic [ref=e205] [cursor=pointer]: Dashboard
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
        - generic [ref=e226]:
          - generic [ref=e227]:
            - generic [ref=e228]:
              - link "PI ativo PI 2026-Q2" [ref=e229] [cursor=pointer]:
                - /url: /pi-planning
                - img [ref=e231]
                - generic [ref=e233]:
                  - generic [ref=e234]: PI ativo
                  - text: PI 2026-Q2
              - link "ARTs 1" [ref=e235] [cursor=pointer]:
                - /url: /arts
                - img [ref=e237]
                - generic [ref=e241]:
                  - generic [ref=e242]: ARTs
                  - text: "1"
              - link "Times 1" [ref=e243] [cursor=pointer]:
                - /url: /teams
                - img [ref=e245]
                - generic [ref=e250]:
                  - generic [ref=e251]: Times
                  - text: "1"
            - heading "Visão Geral do Portfolio" [level=1] [ref=e252]
            - paragraph [ref=e253]: Saúde do portfólio SAFe em tempo real — fluxo, predictability, custo e governança consolidados por ART.
          - link "Ver Portfolio →" [ref=e255] [cursor=pointer]:
            - /url: /portfolio
        - generic [ref=e256]:
          - generic [ref=e257]:
            - generic [ref=e258]:
              - img
              - img
              - img
              - generic [ref=e259]:
                - generic [ref=e260]: Épicos ativos no portfólio
                - img [ref=e262]
              - generic [ref=e264]: "3"
              - generic [ref=e265]: Em execução
            - generic [ref=e266]:
              - img
              - img
              - img
              - generic [ref=e267]:
                - generic [ref=e268]: PI Predictability
                - img [ref=e270]
              - generic [ref=e272]: 87%
              - generic [ref=e273]: PI PI 2026-Q2
            - generic [ref=e274]:
              - img
              - img
              - img
              - generic [ref=e275]:
                - generic [ref=e276]: Throughput médio
                - img [ref=e278]
              - generic [ref=e280]: —
              - generic [ref=e281]: Sem histórico
            - generic [ref=e282]:
              - img
              - img
              - img
              - generic [ref=e283]:
                - generic [ref=e284]: Custo de nuvem · MTD
                - img [ref=e286]
              - generic [ref=e288]: US$ 0
              - generic [ref=e289]: Mês atual
          - generic [ref=e290]:
            - generic [ref=e291]:
              - generic [ref=e292]:
                - img [ref=e294]
                - generic [ref=e297]:
                  - generic [ref=e298]: Throughput por sprint
                  - generic [ref=e299]: Story points concluídos · sprints fechadas
              - generic [ref=e301]: Nenhuma sprint fechada ainda.
            - generic [ref=e302]:
              - generic [ref=e303]:
                - img [ref=e305]
                - generic [ref=e309]:
                  - generic [ref=e310]: Predictability por PI
                  - generic [ref=e311]: Objetivos entregues no PI em execução
              - generic [ref=e314]:
                - generic [ref=e315]: "87"
                - generic [ref=e317]: PI 2026-Q2
          - generic [ref=e318]:
            - generic [ref=e319]:
              - generic [ref=e320]:
                - img [ref=e322]
                - generic [ref=e324]:
                  - generic [ref=e325]: Alocação por Tema Estratégico
                  - generic [ref=e326]: Custo de nuvem no mês, por tema
              - generic [ref=e328]: Sem custo de nuvem registrado neste mês.
            - generic [ref=e329]:
              - generic [ref=e330]:
                - img [ref=e332]
                - generic [ref=e334]:
                  - generic [ref=e335]: Épicos em implementação
                  - generic [ref=e336]: Progresso por épico ativo
                - link "ver todos →" [ref=e338] [cursor=pointer]:
                  - /url: /portfolio
              - generic [ref=e340]:
                - link "AI-Powered Risk Copilot Inovação com IA aplicada ao SAFe 0% —" [ref=e341] [cursor=pointer]:
                  - /url: /epics/cmr8j4f6l001dicpx8n08ujxx
                  - generic [ref=e343]: AI-Powered Risk Copilot
                  - generic [ref=e344]: Inovação com IA aplicada ao SAFe
                  - generic [ref=e347]:
                    - generic [ref=e348]: 0%
                    - generic [ref=e349]: —
                - link "Portfolio Kanban & OKR Dashboard Acelerar time-to-market enterprise 0% —" [ref=e351] [cursor=pointer]:
                  - /url: /epics/cmr8j4f6k001cicpxi2hp5yh3
                  - generic [ref=e353]: Portfolio Kanban & OKR Dashboard
                  - generic [ref=e354]: Acelerar time-to-market enterprise
                  - generic [ref=e357]:
                    - generic [ref=e358]: 0%
                    - generic [ref=e359]: —
    - button "Abrir Copilot AI" [ref=e363] [cursor=pointer]:
      - img [ref=e364]
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e374] [cursor=pointer]:
    - img [ref=e375]
  - alert [ref=e378]
```

# Test source

```ts
  1  | import AxeBuilder from "@axe-core/playwright";
  2  | import { expect, test } from "@playwright/test";
  3  | 
  4  | /**
  5  |  * Accessibility (a11y) audit using axe-core.
  6  |  *
  7  |  * Covers the four critical kanban/portfolio routes that received design
  8  |  * changes in the design-excellence sprint. Runs without auth to catch
  9  |  * structural violations on public redirect pages, and with auth (@auth)
  10 |  * for authenticated views.
  11 |  *
  12 |  * Rules:
  13 |  * - wcag2a + wcag2aa (WCAG 2.1 Level AA)
  14 |  * - Excludes known third-party iframes (Liveblocks, etc.)
  15 |  *
  16 |  * Run: pnpm test:e2e -- --grep a11y
  17 |  */
  18 | 
  19 | const WCAG_TAGS = ["wcag2a", "wcag2aa"];
  20 | 
  21 | test.describe("a11y — Public pages", () => {
  22 |   test("sign-in page has no critical violations", async ({ page }) => {
  23 |     await page.goto("/sign-in");
  24 | 
  25 |     const results = await new AxeBuilder({ page })
  26 |       .withTags(WCAG_TAGS)
  27 |       .exclude("iframe")
  28 |       .analyze();
  29 | 
  30 |     const serious = results.violations.filter(
  31 |       (v) => v.impact === "critical" || v.impact === "serious"
  32 |     );
  33 |     expect(
  34 |       serious,
  35 |       `Critical/serious violations: ${JSON.stringify(serious, null, 2)}`
  36 |     ).toEqual([]);
  37 |   });
  38 | });
  39 | 
  40 | test.describe("a11y — Authenticated pages @auth", () => {
  41 |   test.use({ storageState: "e2e/fixtures/auth-session.json" });
  42 | 
  43 |   test("dashboard has no critical violations", async ({ page }) => {
  44 |     await page.goto("/dashboard");
  45 |     await page.waitForLoadState("networkidle");
  46 | 
  47 |     const results = await new AxeBuilder({ page })
  48 |       .withTags(WCAG_TAGS)
  49 |       .exclude("iframe")
  50 |       .analyze();
  51 | 
  52 |     const serious = results.violations.filter(
  53 |       (v) => v.impact === "critical" || v.impact === "serious"
  54 |     );
  55 |     expect(
  56 |       serious,
  57 |       `Critical/serious violations: ${JSON.stringify(serious, null, 2)}`
> 58 |     ).toEqual([]);
     |       ^ Error: Critical/serious violations: [
  59 |   });
  60 | 
  61 |   test("portfolio kanban has no critical violations", async ({ page }) => {
  62 |     await page.goto("/portfolio");
  63 |     await page.waitForLoadState("networkidle");
  64 | 
  65 |     const results = await new AxeBuilder({ page })
  66 |       .withTags(WCAG_TAGS)
  67 |       .exclude("iframe")
  68 |       .analyze();
  69 | 
  70 |     const serious = results.violations.filter(
  71 |       (v) => v.impact === "critical" || v.impact === "serious"
  72 |     );
  73 |     expect(
  74 |       serious,
  75 |       `Critical/serious violations: ${JSON.stringify(serious, null, 2)}`
  76 |     ).toEqual([]);
  77 |   });
  78 | 
  79 |   test("PI planning kanban has no critical violations", async ({ page }) => {
  80 |     await page.goto("/pi-planning");
  81 |     await page.waitForLoadState("networkidle");
  82 | 
  83 |     const results = await new AxeBuilder({ page })
  84 |       .withTags(WCAG_TAGS)
  85 |       .exclude("iframe")
  86 |       .analyze();
  87 | 
  88 |     const serious = results.violations.filter(
  89 |       (v) => v.impact === "critical" || v.impact === "serious"
  90 |     );
  91 |     expect(
  92 |       serious,
  93 |       `Critical/serious violations: ${JSON.stringify(serious, null, 2)}`
  94 |     ).toEqual([]);
  95 |   });
  96 | });
  97 | 
```