# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y-screens.spec.ts >> a11y screens — static routes @auth >> /workflows has no critical/serious violations
- Location: e2e/a11y-screens.spec.ts:67:9

# Error details

```
Error: [/workflows] Critical/serious violations: [
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
                "html": "<button class=\"inline-flex items-ce...\" style=\"background: var(--ac...\">",
                "target": [
                  ".px-\\[14px\\].py-2.text-white"
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
        "html": "<button class=\"inline-flex items-ce...\" style=\"background: var(--ac...\">",
        "target": [
          ".px-\\[14px\\].py-2.text-white"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 1.77 (foreground color: #ffffff, background color: #00d4ff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#4d5972",
              "bgColor": "#121839",
              "contrastRatio": 2.45,
              "fontSize": "8.3pt (11px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div class=\"lift grid items-center gap-4\" style=\"grid-template-columns: 40px minmax(0px, 1.5fr) minmax(0px, 1fr) 84px 80px 46px; padding: 14px 18px; border-radius: var(--cosmos-r-md, 8px); border: 1px solid var(--hairline); background: var(--surface-2); opacity: 0.72;\">",
                "target": [
                  ".lift"
                ]
              },
              {
                "html": "<div style=\"border: 1px solid var(--hairline); border-radius: 14px; background: var(--surface); overflow: hidden; box-shadow: rgba(255, 255, 255, 0.03) 0px 1px 0px inset, rgba(0, 0, 0, 0.9) 0px 12px 28px -22px;\">",
                "target": [
                  ".overflow-y-auto > div:nth-child(2) > div"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 2.45 (foreground color: #4d5972, background color: #121839, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"font-mono\" style=\"font-size: 11px; color: var(--ink-subtle); font-weight: 600;\">WF-01</span>",
        "target": [
          "div:nth-child(2) > div > .font-mono"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 2.45 (foreground color: #4d5972, background color: #121839, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#6e798e",
              "bgColor": "#121839",
              "contrastRatio": 3.93,
              "fontSize": "9.0pt (12px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div class=\"lift grid items-center gap-4\" style=\"grid-template-columns: 40px minmax(0px, 1.5fr) minmax(0px, 1fr) 84px 80px 46px; padding: 14px 18px; border-radius: var(--cosmos-r-md, 8px); border: 1px solid var(--hairline); background: var(--surface-2); opacity: 0.72;\">",
                "target": [
                  ".lift"
                ]
              },
              {
                "html": "<div style=\"border: 1px solid var(--hairline); border-radius: 14px; background: var(--surface); overflow: hidden; box-shadow: rgba(255, 255, 255, 0.03) 0px 1px 0px inset, rgba(0, 0, 0, 0.9) 0px 12px 28px -22px;\">",
                "target": [
                  ".overflow-y-auto > div:nth-child(2) > div"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.93 (foreground color: #6e798e, background color: #121839, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span style=\"font-size: 12px; color: var(--ink-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\">Gatilho não configurado</span>",
        "target": [
          ".contents > div:nth-child(3) > span"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.93 (foreground color: #6e798e, background color: #121839, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#6e798e",
              "bgColor": "#1b2041",
              "contrastRatio": 3.6,
              "fontSize": "9.0pt (12px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<span style=\"display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: var(--ink-muted); background: var(--chip-bg); border: 1px solid var(--hairline); border-radius: 99px; padding: 3px 10px;\">0 ação</span>",
                "target": [
                  ".contents > div:nth-child(4) > span"
                ]
              },
              {
                "html": "<div class=\"lift grid items-center gap-4\" style=\"grid-template-columns: 40px minmax(0px, 1.5fr) minmax(0px, 1fr) 84px 80px 46px; padding: 14px 18px; border-radius: var(--cosmos-r-md, 8px); border: 1px solid var(--hairline); background: var(--surface-2); opacity: 0.72;\">",
                "target": [
                  ".lift"
                ]
              },
              {
                "html": "<div style=\"border: 1px solid var(--hairline); border-radius: 14px; background: var(--surface); overflow: hidden; box-shadow: rgba(255, 255, 255, 0.03) 0px 1px 0px inset, rgba(0, 0, 0, 0.9) 0px 12px 28px -22px;\">",
                "target": [
                  ".overflow-y-auto > div:nth-child(2) > div"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.6 (foreground color: #6e798e, background color: #1b2041, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span style=\"display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: var(--ink-muted); background: var(--chip-bg); border: 1px solid var(--hairline); border-radius: 99px; padding: 3px 10px;\">0 ação</span>",
        "target": [
          ".contents > div:nth-child(4) > span"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.6 (foreground color: #6e798e, background color: #1b2041, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#4d5972",
              "bgColor": "#121839",
              "contrastRatio": 2.45,
              "fontSize": "7.5pt (10px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div class=\"lift grid items-center gap-4\" style=\"grid-template-columns: 40px minmax(0px, 1.5fr) minmax(0px, 1fr) 84px 80px 46px; padding: 14px 18px; border-radius: var(--cosmos-r-md, 8px); border: 1px solid var(--hairline); background: var(--surface-2); opacity: 0.72;\">",
                "target": [
                  ".lift"
                ]
              },
              {
                "html": "<div style=\"border: 1px solid var(--hairline); border-radius: 14px; background: var(--surface); overflow: hidden; box-shadow: rgba(255, 255, 255, 0.03) 0px 1px 0px inset, rgba(0, 0, 0, 0.9) 0px 12px 28px -22px;\">",
                "target": [
                  ".overflow-y-auto > div:nth-child(2) > div"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 2.45 (foreground color: #4d5972, background color: #121839, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<div style=\"font-size: 10px; color: var(--ink-subtle); font-weight: 600; letter-spacing: 0.03em;\">EXECUÇÕES</div>",
        "target": [
          "div:nth-child(5) > div:nth-child(2)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 2.45 (foreground color: #4d5972, background color: #121839, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1"
      }
    ]
  }
]

expect(received).toEqual(expected) // deep equality

- Expected  -   1
+ Received  + 228

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
+                 "html": "<button class=\"inline-flex items-ce...\" style=\"background: var(--ac...\">",
+                 "target": Array [
+                   ".px-\\[14px\\].py-2.text-white",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 1.77 (foreground color: #ffffff, background color: #00d4ff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<button class=\"inline-flex items-ce...\" style=\"background: var(--ac...\">",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".px-\\[14px\\].py-2.text-white",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#121839",
+               "contrastRatio": 2.45,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#4d5972",
+               "fontSize": "8.3pt (11px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.45 (foreground color: #4d5972, background color: #121839, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"lift grid items-center gap-4\" style=\"grid-template-columns: 40px minmax(0px, 1.5fr) minmax(0px, 1fr) 84px 80px 46px; padding: 14px 18px; border-radius: var(--cosmos-r-md, 8px); border: 1px solid var(--hairline); background: var(--surface-2); opacity: 0.72;\">",
+                 "target": Array [
+                   ".lift",
+                 ],
+               },
+               Object {
+                 "html": "<div style=\"border: 1px solid var(--hairline); border-radius: 14px; background: var(--surface); overflow: hidden; box-shadow: rgba(255, 255, 255, 0.03) 0px 1px 0px inset, rgba(0, 0, 0, 0.9) 0px 12px 28px -22px;\">",
+                 "target": Array [
+                   ".overflow-y-auto > div:nth-child(2) > div",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.45 (foreground color: #4d5972, background color: #121839, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"font-mono\" style=\"font-size: 11px; color: var(--ink-subtle); font-weight: 600;\">WF-01</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(2) > div > .font-mono",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#121839",
+               "contrastRatio": 3.93,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#6e798e",
+               "fontSize": "9.0pt (12px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.93 (foreground color: #6e798e, background color: #121839, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"lift grid items-center gap-4\" style=\"grid-template-columns: 40px minmax(0px, 1.5fr) minmax(0px, 1fr) 84px 80px 46px; padding: 14px 18px; border-radius: var(--cosmos-r-md, 8px); border: 1px solid var(--hairline); background: var(--surface-2); opacity: 0.72;\">",
+                 "target": Array [
+                   ".lift",
+                 ],
+               },
+               Object {
+                 "html": "<div style=\"border: 1px solid var(--hairline); border-radius: 14px; background: var(--surface); overflow: hidden; box-shadow: rgba(255, 255, 255, 0.03) 0px 1px 0px inset, rgba(0, 0, 0, 0.9) 0px 12px 28px -22px;\">",
+                 "target": Array [
+                   ".overflow-y-auto > div:nth-child(2) > div",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.93 (foreground color: #6e798e, background color: #121839, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span style=\"font-size: 12px; color: var(--ink-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\">Gatilho não configurado</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".contents > div:nth-child(3) > span",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#1b2041",
+               "contrastRatio": 3.6,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#6e798e",
+               "fontSize": "9.0pt (12px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.6 (foreground color: #6e798e, background color: #1b2041, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<span style=\"display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: var(--ink-muted); background: var(--chip-bg); border: 1px solid var(--hairline); border-radius: 99px; padding: 3px 10px;\">0 ação</span>",
+                 "target": Array [
+                   ".contents > div:nth-child(4) > span",
+                 ],
+               },
+               Object {
+                 "html": "<div class=\"lift grid items-center gap-4\" style=\"grid-template-columns: 40px minmax(0px, 1.5fr) minmax(0px, 1fr) 84px 80px 46px; padding: 14px 18px; border-radius: var(--cosmos-r-md, 8px); border: 1px solid var(--hairline); background: var(--surface-2); opacity: 0.72;\">",
+                 "target": Array [
+                   ".lift",
+                 ],
+               },
+               Object {
+                 "html": "<div style=\"border: 1px solid var(--hairline); border-radius: 14px; background: var(--surface); overflow: hidden; box-shadow: rgba(255, 255, 255, 0.03) 0px 1px 0px inset, rgba(0, 0, 0, 0.9) 0px 12px 28px -22px;\">",
+                 "target": Array [
+                   ".overflow-y-auto > div:nth-child(2) > div",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.6 (foreground color: #6e798e, background color: #1b2041, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span style=\"display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: var(--ink-muted); background: var(--chip-bg); border: 1px solid var(--hairline); border-radius: 99px; padding: 3px 10px;\">0 ação</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".contents > div:nth-child(4) > span",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#121839",
+               "contrastRatio": 2.45,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#4d5972",
+               "fontSize": "7.5pt (10px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.45 (foreground color: #4d5972, background color: #121839, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"lift grid items-center gap-4\" style=\"grid-template-columns: 40px minmax(0px, 1.5fr) minmax(0px, 1fr) 84px 80px 46px; padding: 14px 18px; border-radius: var(--cosmos-r-md, 8px); border: 1px solid var(--hairline); background: var(--surface-2); opacity: 0.72;\">",
+                 "target": Array [
+                   ".lift",
+                 ],
+               },
+               Object {
+                 "html": "<div style=\"border: 1px solid var(--hairline); border-radius: 14px; background: var(--surface); overflow: hidden; box-shadow: rgba(255, 255, 255, 0.03) 0px 1px 0px inset, rgba(0, 0, 0, 0.9) 0px 12px 28px -22px;\">",
+                 "target": Array [
+                   ".overflow-y-auto > div:nth-child(2) > div",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.45 (foreground color: #4d5972, background color: #121839, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<div style=\"font-size: 10px; color: var(--ink-subtle); font-weight: 600; letter-spacing: 0.03em;\">EXECUÇÕES</div>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(5) > div:nth-child(2)",
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
              - button "Toggle" [expanded] [ref=e89] [cursor=pointer]:
                - img [ref=e90]
                - generic [ref=e92]: Toggle
              - list [ref=e94]:
                - listitem [ref=e95]:
                  - link "BPMN Canvas" [ref=e96] [cursor=pointer]:
                    - /url: /workflows/team-demo/bpmn
                    - generic [ref=e97]: BPMN Canvas
            - listitem [ref=e98]:
              - link "Large Solution" [ref=e99] [cursor=pointer]:
                - /url: /solution-trains
                - img [ref=e100]
                - generic [ref=e103]: Large Solution
              - button "Toggle" [ref=e104] [cursor=pointer]:
                - img [ref=e105]
                - generic [ref=e107]: Toggle
            - listitem [ref=e108]:
              - link "Integrações" [ref=e109] [cursor=pointer]:
                - /url: /integrations
                - img [ref=e110]
                - generic [ref=e116]: Integrações
              - button "Toggle" [ref=e117] [cursor=pointer]:
                - img [ref=e118]
                - generic [ref=e120]: Toggle
            - listitem [ref=e121]:
              - link "Settings" [ref=e122] [cursor=pointer]:
                - /url: /settings/workspace
                - img [ref=e123]
                - generic [ref=e126]: Settings
              - button "Toggle" [ref=e127] [cursor=pointer]:
                - img [ref=e128]
                - generic [ref=e130]: Toggle
        - list [ref=e133]:
          - listitem [ref=e134]:
            - link "Webhooks" [ref=e135] [cursor=pointer]:
              - /url: /webhooks
              - img [ref=e136]
              - generic [ref=e139]: Webhooks
          - listitem [ref=e140]:
            - link "Notificações" [ref=e141] [cursor=pointer]:
              - /url: /notifications
              - img [ref=e142]
              - generic [ref=e145]: Notificações
          - listitem [ref=e146]:
            - link "Exceções de Acesso" [ref=e147] [cursor=pointer]:
              - /url: /access-exceptions
              - img [ref=e148]
              - generic [ref=e150]: Exceções de Acesso
          - listitem [ref=e151]:
            - link "Perfil" [ref=e152] [cursor=pointer]:
              - /url: /profile
              - img [ref=e153]
              - generic [ref=e158]: Perfil
          - listitem [ref=e159]:
            - link "Suporte" [ref=e160] [cursor=pointer]:
              - /url: https://docs.cosmos.app
              - img [ref=e161]
              - generic [ref=e168]: Suporte
          - listitem [ref=e169]:
            - link "Feedback" [ref=e170] [cursor=pointer]:
              - /url: /feedback
              - img [ref=e171]
              - generic [ref=e174]: Feedback
      - list [ref=e176]:
        - listitem [ref=e177]:
          - button "Copilot ⌘K" [ref=e178] [cursor=pointer]:
            - img
            - text: Copilot ⌘K
          - link "Copilot fullscreen" [ref=e179] [cursor=pointer]:
            - /url: /copilot
            - img
        - listitem [ref=e180]:
          - button "AD Admin E2E admin@cosmos.local" [ref=e181] [cursor=pointer]:
            - generic [ref=e182]: AD
            - generic [ref=e183]:
              - generic [ref=e184]: Admin E2E
              - generic [ref=e185]: admin@cosmos.local
            - img [ref=e186]
          - generic [ref=e189]:
            - button "Toggle theme" [ref=e190] [cursor=pointer]:
              - img
              - img
              - generic [ref=e191]: Toggle theme
            - button "Open notification feed" [ref=e193] [cursor=pointer]:
              - img
    - main [ref=e194]:
      - generic [ref=e195]:
        - heading "Command Palette" [level=2] [ref=e196]
        - paragraph [ref=e197]: Search for a command to run...
      - generic [ref=e198]:
        - generic [ref=e199]:
          - generic [ref=e200]: C
          - generic [ref=e201]: COSMOSSAFe
        - img [ref=e202]
        - navigation "Breadcrumb" [ref=e204]:
          - generic [ref=e205]:
            - generic [ref=e206] [cursor=pointer]: COSMOS Dev
            - img [ref=e207]
          - generic [ref=e210] [cursor=pointer]: Workflows
        - generic [ref=e211]:
          - group "Trocar persona" [ref=e212]:
            - button "RTE" [ref=e213] [cursor=pointer]: RTE
            - button "LPM" [pressed] [ref=e215] [cursor=pointer]: LPM
            - button "PO" [ref=e217] [cursor=pointer]: PO
            - button "SM" [ref=e219] [cursor=pointer]: SM
            - button "DEV" [ref=e221] [cursor=pointer]: DEV
          - button "Buscar" [ref=e223] [cursor=pointer]:
            - img [ref=e224]
          - generic "Admin E2E · admin@cosmos.local" [ref=e227]: AE
      - generic [ref=e228]:
        - generic [ref=e230]:
          - generic [ref=e231]:
            - generic [ref=e233]:
              - link "Times Equipes" [ref=e234] [cursor=pointer]:
                - /url: /teams
                - img [ref=e236]
                - generic [ref=e241]:
                  - generic [ref=e242]: Times
                  - text: Equipes
              - link "Automação Integrações" [ref=e243] [cursor=pointer]:
                - /url: /integrations
                - img [ref=e245]
                - generic [ref=e247]:
                  - generic [ref=e248]: Automação
                  - text: Integrações
              - link "Automação Webhooks" [ref=e249] [cursor=pointer]:
                - /url: /webhooks
                - img [ref=e251]
                - generic [ref=e255]:
                  - generic [ref=e256]: Automação
                  - text: Webhooks
            - heading "Workflows" [level=1] [ref=e257]
            - paragraph [ref=e258]: Automações no-code do portfólio. Cada workflow dispara ações a partir de eventos — promover gates, notificar, sincronizar ferramentas.
          - generic [ref=e259]:
            - button "Templates" [ref=e260] [cursor=pointer]:
              - img [ref=e261]
              - text: Templates
            - button "Criar workflow" [ref=e263] [cursor=pointer]:
              - img [ref=e264]
              - text: Criar workflow
        - generic [ref=e265]:
          - generic [ref=e266]:
            - generic [ref=e267]:
              - img
              - img
              - img
              - generic [ref=e268]:
                - generic [ref=e269]: Workflows ativos
                - img [ref=e271]
              - generic [ref=e273]: "0"
              - generic [ref=e274]: de 0 configurados
            - generic [ref=e275]:
              - img
              - img
              - img
              - generic [ref=e276]:
                - generic [ref=e277]: Execuções acumuladas
                - img [ref=e279]
              - generic [ref=e281]: "0"
              - generic [ref=e282]: ações automáticas registradas
            - generic [ref=e283]:
              - img
              - img
              - img
              - generic [ref=e284]:
                - generic [ref=e285]: Equipes cobertas
                - img [ref=e287]
              - generic [ref=e289]: 0/1
              - generic [ref=e290]: times com workflow salvo
          - generic [ref=e292]:
            - generic [ref=e293]:
              - img [ref=e295]
              - generic [ref=e299]:
                - generic [ref=e300]: Automações
                - generic [ref=e301]: Gatilho → ações · ordenadas por equipe
              - generic [ref=e303]: motor de eventos ativo
            - generic [ref=e306]:
              - link "WF-01 Team Nebula Gatilho não configurado 0 ação 0 EXECUÇÕES" [ref=e307] [cursor=pointer]:
                - /url: /workflows/cmr8j4f5g0003icpx370whw3s/bpmn
                - img [ref=e309]
                - generic [ref=e314]:
                  - generic [ref=e315]: WF-01
                  - generic [ref=e316]: Team Nebula
                - generic [ref=e317]:
                  - img [ref=e318]
                  - generic [ref=e320]: Gatilho não configurado
                - generic [ref=e322]: 0 ação
                - generic [ref=e323]:
                  - generic [ref=e324]: "0"
                  - generic [ref=e325]: EXECUÇÕES
              - switch "Ativar workflow" [disabled] [ref=e327]
    - button "Abrir Copilot AI" [ref=e331] [cursor=pointer]:
      - img [ref=e332]
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e342] [cursor=pointer]:
    - img [ref=e343]
  - alert [ref=e346]
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
      |     ^ Error: [/workflows] Critical/serious violations: [
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