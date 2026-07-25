# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y-screens.spec.ts >> a11y screens — static routes @auth >> /analytics/flow has no critical/serious violations
- Location: e2e/a11y-screens.spec.ts:67:9

# Error details

```
Error: [/analytics/flow] Critical/serious violations: [
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
              "fgColor": "#7fe8ff",
              "bgColor": "#00d4ff",
              "contrastRatio": 1.25,
              "fontSize": "8.3pt (11px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<button aria-pressed=\"true\" type=\"button\" style=\"padding: 5px 11px; b...\">",
                "target": [
                  ".gap-2.items-center.flex:nth-child(1) > .flex-wrap.gap-1\\.5.flex > button[type=\"button\"]"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 1.25 (foreground color: #7fe8ff, background color: #00d4ff, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<button aria-pressed=\"true\" type=\"button\" style=\"padding: 5px 11px; b...\">",
        "target": [
          ".gap-2.items-center.flex:nth-child(1) > .flex-wrap.gap-1\\.5.flex > button[type=\"button\"]"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 1.25 (foreground color: #7fe8ff, background color: #00d4ff, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#46566d",
              "bgColor": "#141a3d",
              "contrastRatio": 2.25,
              "fontSize": "9.8pt (13px)",
              "fontWeight": "bold",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div class=\"flex gap-[22px] border-hairline border-b bg-surface-2\" style=\"margin-left: -24px; margin-right: -24px; padding: 0px 24px;\">",
                "target": [
                  ".gap-\\[22px\\]"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 9.8pt (13px), font weight: bold). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<button class=\"border-transparent border-b-[2.5px] py-[11px] font-bold text-[13px] transition-colors\" type=\"button\" style=\"border-bottom-color: transparent; color: var(--ink-faint);\">Measure &amp; Grow</button>",
        "target": [
          ".border-b-\\[2\\.5px\\].py-\\[11px\\].border-transparent:nth-child(2)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 9.8pt (13px), font weight: bold). Expected contrast ratio of 4.5:1"
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
                "html": "<div style=\"border: 1px solid var(--hairline); border-radius: 14px; background: var(--surface); overflow: hidden; box-shadow: rgba(255, 255, 255, 0.03) 0px 1px 0px inset, rgba(0, 0, 0, 0.9) 0px 12px 28px -22px;\">",
                "target": [
                  ".grid-cols-1 > div:nth-child(5)"
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
        "html": "<span style=\"font-size: 11px; color: var(--ink-subtle); text-align: center;\">Meta: &gt;60%</span>",
        "target": [
          ".gap-7 > div:nth-child(1) > span:nth-child(3)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
      }
    ]
  },
  {
    "id": "svg-img-alt",
    "impact": "serious",
    "tags": [
      "cat.text-alternatives",
      "wcag2a",
      "wcag111",
      "section508",
      "section508.22.a",
      "TTv5",
      "TT7.a",
      "EN-301-549",
      "EN-9.1.1.1",
      "ACT",
      "RGAAv4",
      "RGAA-1.1.5"
    ],
    "description": "Ensure <svg> elements with an img, graphics-document or graphics-symbol role have accessible text",
    "help": "<svg> elements with an img role must have alternative text",
    "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/svg-img-alt?application=playwright",
    "nodes": [
      {
        "any": [
          {
            "id": "svg-non-empty-title",
            "data": {
              "messageKey": "noTitle"
            },
            "relatedNodes": [],
            "impact": "serious",
            "message": "Element has no child that is a title"
          },
          {
            "id": "aria-label",
            "data": null,
            "relatedNodes": [],
            "impact": "serious",
            "message": "aria-label attribute does not exist or is empty"
          },
          {
            "id": "aria-labelledby",
            "data": null,
            "relatedNodes": [],
            "impact": "serious",
            "message": "aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty"
          },
          {
            "id": "non-empty-title",
            "data": {
              "messageKey": "noAttr"
            },
            "relatedNodes": [],
            "impact": "serious",
            "message": "Element has no title attribute"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<path cx=\"90\" cy=\"90\" name=\"História\" stroke=\"#fff\" fill=\"rgb(var(--green-rgb)...\" tabindex=\"-1\" class=\"recharts-sector\" d=\"M 170,90\n    A 80,80...\" role=\"img\">",
        "target": [
          "path[name=\"História\"]"
        ],
        "failureSummary": "Fix any of the following:\n  Element has no child that is a title\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute"
      },
      {
        "any": [
          {
            "id": "svg-non-empty-title",
            "data": {
              "messageKey": "noTitle"
            },
            "relatedNodes": [],
            "impact": "serious",
            "message": "Element has no child that is a title"
          },
          {
            "id": "aria-label",
            "data": null,
            "relatedNodes": [],
            "impact": "serious",
            "message": "aria-label attribute does not exist or is empty"
          },
          {
            "id": "aria-labelledby",
            "data": null,
            "relatedNodes": [],
            "impact": "serious",
            "message": "aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty"
          },
          {
            "id": "non-empty-title",
            "data": {
              "messageKey": "noAttr"
            },
            "relatedNodes": [],
            "impact": "serious",
            "message": "Element has no title attribute"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<path cx=\"90\" cy=\"90\" name=\"Feature\" stroke=\"#fff\" fill=\"rgb(var(--blue-rgb))\" tabindex=\"-1\" class=\"recharts-sector\" d=\"M 95.39790419918252,...\" role=\"img\">",
        "target": [
          "path[name=\"Feature\"]"
        ],
        "failureSummary": "Fix any of the following:\n  Element has no child that is a title\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute"
      },
      {
        "any": [
          {
            "id": "svg-non-empty-title",
            "data": {
              "messageKey": "noTitle"
            },
            "relatedNodes": [],
            "impact": "serious",
            "message": "Element has no child that is a title"
          },
          {
            "id": "aria-label",
            "data": null,
            "relatedNodes": [],
            "impact": "serious",
            "message": "aria-label attribute does not exist or is empty"
          },
          {
            "id": "aria-labelledby",
            "data": null,
            "relatedNodes": [],
            "impact": "serious",
            "message": "aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty"
          },
          {
            "id": "non-empty-title",
            "data": {
              "messageKey": "noAttr"
            },
            "relatedNodes": [],
            "impact": "serious",
            "message": "Element has no title attribute"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<path cx=\"90\" cy=\"90\" name=\"Defect\" stroke=\"#fff\" fill=\"rgb(var(--purple-rgb...\" tabindex=\"-1\" class=\"recharts-sector\" d=\"M 10.728434243588808...\" role=\"img\">",
        "target": [
          "path[name=\"Defect\"]"
        ],
        "failureSummary": "Fix any of the following:\n  Element has no child that is a title\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute"
      }
    ]
  }
]

expect(received).toEqual(expected) // deep equality

- Expected  -   1
+ Received  + 296

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
+               "contrastRatio": 1.25,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#7fe8ff",
+               "fontSize": "8.3pt (11px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 1.25 (foreground color: #7fe8ff, background color: #00d4ff, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<button aria-pressed=\"true\" type=\"button\" style=\"padding: 5px 11px; b...\">",
+                 "target": Array [
+                   ".gap-2.items-center.flex:nth-child(1) > .flex-wrap.gap-1\\.5.flex > button[type=\"button\"]",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 1.25 (foreground color: #7fe8ff, background color: #00d4ff, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<button aria-pressed=\"true\" type=\"button\" style=\"padding: 5px 11px; b...\">",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".gap-2.items-center.flex:nth-child(1) > .flex-wrap.gap-1\\.5.flex > button[type=\"button\"]",
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
+               "fontSize": "9.8pt (13px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 9.8pt (13px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"flex gap-[22px] border-hairline border-b bg-surface-2\" style=\"margin-left: -24px; margin-right: -24px; padding: 0px 24px;\">",
+                 "target": Array [
+                   ".gap-\\[22px\\]",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.25 (foreground color: #46566d, background color: #141a3d, font size: 9.8pt (13px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<button class=\"border-transparent border-b-[2.5px] py-[11px] font-bold text-[13px] transition-colors\" type=\"button\" style=\"border-bottom-color: transparent; color: var(--ink-faint);\">Measure &amp; Grow</button>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".border-b-\\[2\\.5px\\].py-\\[11px\\].border-transparent:nth-child(2)",
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
+                 "html": "<div style=\"border: 1px solid var(--hairline); border-radius: 14px; background: var(--surface); overflow: hidden; box-shadow: rgba(255, 255, 255, 0.03) 0px 1px 0px inset, rgba(0, 0, 0, 0.9) 0px 12px 28px -22px;\">",
+                 "target": Array [
+                   ".grid-cols-1 > div:nth-child(5)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.83 (foreground color: #65748b, background color: #0e1330, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span style=\"font-size: 11px; color: var(--ink-subtle); text-align: center;\">Meta: &gt;60%</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".gap-7 > div:nth-child(1) > span:nth-child(3)",
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
+   Object {
+     "description": "Ensure <svg> elements with an img, graphics-document or graphics-symbol role have accessible text",
+     "help": "<svg> elements with an img role must have alternative text",
+     "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/svg-img-alt?application=playwright",
+     "id": "svg-img-alt",
+     "impact": "serious",
+     "nodes": Array [
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "messageKey": "noTitle",
+             },
+             "id": "svg-non-empty-title",
+             "impact": "serious",
+             "message": "Element has no child that is a title",
+             "relatedNodes": Array [],
+           },
+           Object {
+             "data": null,
+             "id": "aria-label",
+             "impact": "serious",
+             "message": "aria-label attribute does not exist or is empty",
+             "relatedNodes": Array [],
+           },
+           Object {
+             "data": null,
+             "id": "aria-labelledby",
+             "impact": "serious",
+             "message": "aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty",
+             "relatedNodes": Array [],
+           },
+           Object {
+             "data": Object {
+               "messageKey": "noAttr",
+             },
+             "id": "non-empty-title",
+             "impact": "serious",
+             "message": "Element has no title attribute",
+             "relatedNodes": Array [],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has no child that is a title
+   aria-label attribute does not exist or is empty
+   aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty
+   Element has no title attribute",
+         "html": "<path cx=\"90\" cy=\"90\" name=\"História\" stroke=\"#fff\" fill=\"rgb(var(--green-rgb)...\" tabindex=\"-1\" class=\"recharts-sector\" d=\"M 170,90
+     A 80,80...\" role=\"img\">",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "path[name=\"História\"]",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "messageKey": "noTitle",
+             },
+             "id": "svg-non-empty-title",
+             "impact": "serious",
+             "message": "Element has no child that is a title",
+             "relatedNodes": Array [],
+           },
+           Object {
+             "data": null,
+             "id": "aria-label",
+             "impact": "serious",
+             "message": "aria-label attribute does not exist or is empty",
+             "relatedNodes": Array [],
+           },
+           Object {
+             "data": null,
+             "id": "aria-labelledby",
+             "impact": "serious",
+             "message": "aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty",
+             "relatedNodes": Array [],
+           },
+           Object {
+             "data": Object {
+               "messageKey": "noAttr",
+             },
+             "id": "non-empty-title",
+             "impact": "serious",
+             "message": "Element has no title attribute",
+             "relatedNodes": Array [],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has no child that is a title
+   aria-label attribute does not exist or is empty
+   aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty
+   Element has no title attribute",
+         "html": "<path cx=\"90\" cy=\"90\" name=\"Feature\" stroke=\"#fff\" fill=\"rgb(var(--blue-rgb))\" tabindex=\"-1\" class=\"recharts-sector\" d=\"M 95.39790419918252,...\" role=\"img\">",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "path[name=\"Feature\"]",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "messageKey": "noTitle",
+             },
+             "id": "svg-non-empty-title",
+             "impact": "serious",
+             "message": "Element has no child that is a title",
+             "relatedNodes": Array [],
+           },
+           Object {
+             "data": null,
+             "id": "aria-label",
+             "impact": "serious",
+             "message": "aria-label attribute does not exist or is empty",
+             "relatedNodes": Array [],
+           },
+           Object {
+             "data": null,
+             "id": "aria-labelledby",
+             "impact": "serious",
+             "message": "aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty",
+             "relatedNodes": Array [],
+           },
+           Object {
+             "data": Object {
+               "messageKey": "noAttr",
+             },
+             "id": "non-empty-title",
+             "impact": "serious",
+             "message": "Element has no title attribute",
+             "relatedNodes": Array [],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has no child that is a title
+   aria-label attribute does not exist or is empty
+   aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty
+   Element has no title attribute",
+         "html": "<path cx=\"90\" cy=\"90\" name=\"Defect\" stroke=\"#fff\" fill=\"rgb(var(--purple-rgb...\" tabindex=\"-1\" class=\"recharts-sector\" d=\"M 10.728434243588808...\" role=\"img\">",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "path[name=\"Defect\"]",
+         ],
+       },
+     ],
+     "tags": Array [
+       "cat.text-alternatives",
+       "wcag2a",
+       "wcag111",
+       "section508",
+       "section508.22.a",
+       "TTv5",
+       "TT7.a",
+       "EN-301-549",
+       "EN-9.1.1.1",
+       "ACT",
+       "RGAAv4",
+       "RGAA-1.1.5",
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
          - generic [ref=e226] [cursor=pointer]: Flow
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
              - generic [ref=e255]:
                - link "ART Plataforma COSMOS" [ref=e256] [cursor=pointer]:
                  - /url: /arts/cmr8j4f5e0002icpxgfhrg988
                  - img [ref=e258]
                  - generic [ref=e261]:
                    - generic [ref=e262]: ART
                    - text: Plataforma COSMOS
                - link "Análise Measure & Grow" [ref=e263] [cursor=pointer]:
                  - /url: /analytics/measure-grow
                  - img [ref=e265]
                  - generic [ref=e268]:
                    - generic [ref=e269]: Análise
                    - text: Measure & Grow
                - link "Portfolio Executive Dashboard" [ref=e270] [cursor=pointer]:
                  - /url: /analytics/executive
                  - img [ref=e272]
                  - generic [ref=e275]:
                    - generic [ref=e276]: Portfolio
                    - text: Executive Dashboard
                - generic [ref=e277]: Fluxo em risco
              - heading "Flow Metrics" [level=1] [ref=e279]
              - paragraph [ref=e280]: SAFe 6.0 — Distribution · Velocity · Time · Load · Efficiency · Predictability
            - button "Copilot Flow" [ref=e282] [cursor=pointer]:
              - img
              - text: Copilot Flow
        - generic [ref=e283]:
          - generic [ref=e284]:
            - link "Flow Metrics" [ref=e285] [cursor=pointer]:
              - /url: "?scope=art&scopeId=cmr8j4f5e0002icpxgfhrg988"
            - link "Portfolio CFD" [ref=e286] [cursor=pointer]:
              - /url: "?scope=art&scopeId=cmr8j4f5e0002icpxgfhrg988&tab=portfolio"
            - link "PI Burnup" [ref=e287] [cursor=pointer]:
              - /url: "?scope=art&scopeId=cmr8j4f5e0002icpxgfhrg988&tab=burnup"
          - generic [ref=e288]:
            - generic [ref=e289]:
              - generic [ref=e290]:
                - generic [ref=e291]: ART
                - button "Plataforma COSMOS" [pressed] [ref=e293] [cursor=pointer]
              - generic [ref=e295]:
                - generic [ref=e296]: Time
                - button "Team Nebula" [ref=e298] [cursor=pointer]
              - button "↓ Export CSV" [ref=e299] [cursor=pointer]
            - generic [ref=e300]:
              - button "Flow Metrics" [ref=e301] [cursor=pointer]
              - button "Measure & Grow" [ref=e302] [cursor=pointer]
            - generic [ref=e303]:
              - generic [ref=e305]:
                - generic [ref=e306]: ⚠
                - generic [ref=e307]:
                  - generic [ref=e308]: Predictability em risco (0%)
                  - generic [ref=e309]: Revise capacidade vs. comprometimento e identifique dependências.
                - generic [ref=e310]: Reduzir escopo do próximo PI →
              - generic [ref=e312]: Atualizado
              - generic [ref=e314]:
                - generic [ref=e315]:
                  - img
                  - img
                  - img
                  - generic [ref=e316]:
                    - generic [ref=e317]: Velocity
                    - img [ref=e319]
                  - generic [ref=e321]: 0itens/sprint
                  - generic [ref=e322]: — estável
                - generic [ref=e323]:
                  - img
                  - img
                  - img
                  - generic [ref=e324]:
                    - generic [ref=e325]: Flow Time
                    - img [ref=e327]
                  - generic [ref=e329]: 0dias end-to-end
                  - generic [ref=e330]: — estável
                - generic [ref=e331]:
                  - img
                  - img
                  - img
                  - generic [ref=e332]:
                    - generic [ref=e333]: Flow Load
                    - img [ref=e335]
                  - generic [ref=e337]: 2itens em WIP
                  - generic [ref=e338]: — dentro do limite
                - generic [ref=e339]:
                  - img
                  - img
                  - img
                  - generic [ref=e340]:
                    - generic [ref=e341]: Efficiency
                    - img [ref=e343]
                  - generic [ref=e345]: 42% tempo ativo
                  - generic [ref=e346]: — estável
                - generic [ref=e347]:
                  - img
                  - img
                  - img
                  - generic [ref=e348]:
                    - generic [ref=e349]: Predictability
                    - img [ref=e351]
                  - generic [ref=e353]: 0% entregue/planejado
                  - generic [ref=e354]: — estável
                - generic [ref=e355]:
                  - img
                  - img
                  - img
                  - generic [ref=e356]:
                    - generic [ref=e357]: Distribution
                    - img [ref=e359]
                  - generic [ref=e361]: 3tipos balanceados
                  - generic [ref=e362]: História 33% · Feature 33% · Defect 33%
              - generic [ref=e363]:
                - generic [ref=e364]:
                  - generic [ref=e365]:
                    - img [ref=e367]
                    - generic [ref=e369]:
                      - generic [ref=e370]: Flow Velocity
                      - generic [ref=e371]: Itens entregues por sprint
                  - img [ref=e375]:
                    - generic [ref=e379]:
                      - generic [ref=e381]: Sprint 1 — Foundation
                      - generic [ref=e383]: Sprint 2 — Portfolio Core
                      - generic [ref=e385]: Sprint 3 — AI Features
                    - generic [ref=e387]:
                      - generic [ref=e389]: "0"
                      - generic [ref=e391]: "10"
                      - generic [ref=e393]: "20"
                      - generic [ref=e395]: "30"
                      - generic [ref=e397]: "40"
                - generic [ref=e403]:
                  - generic [ref=e404]:
                    - img [ref=e406]
                    - generic [ref=e411]:
                      - generic [ref=e412]: Flow Distribution
                      - generic [ref=e413]: Mix de trabalho no período
                  - generic [ref=e414]:
                    - generic [ref=e415]:
                      - img [ref=e418]:
                        - generic [ref=e420]:
                          - img [ref=e422]
                          - img [ref=e424]
                          - img [ref=e426]
                      - generic [ref=e427]:
                        - generic [ref=e428]:
                          - generic [ref=e430]: História
                          - generic [ref=e431]: 1 (33%)
                        - generic [ref=e432]:
                          - generic [ref=e434]: Feature
                          - generic [ref=e435]: 1 (33%)
                        - generic [ref=e436]:
                          - generic [ref=e438]: Defect
                          - generic [ref=e439]: 1 (33%)
                    - generic [ref=e440]: "Recomendado: Feature 60% · Bug 10% · Débito 15% · Spike 15%"
                - generic [ref=e441]:
                  - generic [ref=e442]:
                    - img [ref=e444]
                    - generic [ref=e447]:
                      - generic [ref=e448]: Flow Time
                      - generic [ref=e449]: Ciclo médio por tipo de item (dias)
                  - img [ref=e453]:
                    - generic [ref=e457]:
                      - generic [ref=e459]: 0d
                      - generic [ref=e461]: 1d
                      - generic [ref=e463]: 2d
                      - generic [ref=e465]: 3d
                      - generic [ref=e467]: 4d
                    - generic [ref=e469]:
                      - generic [ref=e471]: História
                      - generic [ref=e473]: Feature
                - generic [ref=e474]:
                  - generic [ref=e475]:
                    - img [ref=e477]
                    - generic [ref=e481]:
                      - generic [ref=e482]: Flow Load — WIP
                      - generic [ref=e483]: Itens em andamento por sprint
                  - generic [ref=e484]:
                    - img [ref=e487]:
                      - generic [ref=e492]:
                        - generic [ref=e494]: Sprint 1 — Foundation
                        - generic [ref=e496]: Sprint 2 — Portfolio Core
                        - generic [ref=e498]: Sprint 3 — AI Features
                      - generic [ref=e500]:
                        - generic [ref=e502]: "0"
                        - generic [ref=e504]: "4"
                        - generic [ref=e506]: "8"
                        - generic [ref=e508]: "12"
                        - generic [ref=e510]: "16"
                    - generic [ref=e517]: Linha vermelha = limite recomendado (15)
                - generic [ref=e518]:
                  - generic [ref=e519]:
                    - img [ref=e521]
                    - generic [ref=e525]:
                      - generic [ref=e526]: Flow Efficiency
                      - generic [ref=e527]: Tempo ativo vs tempo de espera no fluxo
                  - generic [ref=e529]:
                    - generic [ref=e530]:
                      - img "Eficiência de fluxo" [ref=e531]:
                        - generic [ref=e534]: "42"
                      - generic [ref=e535]: Eficiência de fluxo
                      - generic [ref=e536]: "Meta: >60%"
                    - generic [ref=e537]:
                      - generic [ref=e538]:
                        - generic [ref=e539]: Ativo
                        - generic [ref=e540]: 42%
                      - generic [ref=e541]:
                        - generic [ref=e542]: Espera
                        - generic [ref=e543]: 58%
                - generic [ref=e544]:
                  - generic [ref=e545]:
                    - img [ref=e547]
                    - generic [ref=e553]:
                      - generic [ref=e554]: Flow Predictability
                      - generic [ref=e555]: Planejado vs entregue por sprint
                  - generic [ref=e558]:
                    - img [ref=e559]:
                      - generic [ref=e565]: PI 2026-Q2
                      - generic [ref=e567]:
                        - generic [ref=e569]: "0"
                        - generic [ref=e571]: "0.75"
                        - generic [ref=e573]: "1.5"
                        - generic [ref=e575]: "2.25"
                        - generic [ref=e577]: "3"
                    - list [ref=e584]:
                      - listitem [ref=e585]:
                        - img [ref=e586]
                        - text: Planejado
                      - listitem [ref=e588]:
                        - img [ref=e589]
                        - text: Entregue
              - generic [ref=e591]:
                - generic [ref=e594]: Insights automáticos
                - generic [ref=e596]:
                  - generic [ref=e597]:
                    - generic [ref=e598]: 💡
                    - generic [ref=e599]: Eficiência em 42%
                  - paragraph [ref=e600]: Abaixo do ideal (>60%). Investigue filas de espera e handoffs.
                  - generic [ref=e601]: → Mapear gargalos no fluxo
              - generic [ref=e603]:
                - generic [ref=e604]:
                  - paragraph [ref=e605]: Copilot — Anomalias de Flow
                  - button "Analisar Flow" [ref=e606] [cursor=pointer]
                - paragraph [ref=e607]: Clique em "Analisar Flow" para detectar anomalias no snapshot atual.
    - button "Abrir Copilot AI" [ref=e610] [cursor=pointer]:
      - img [ref=e611]
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e621] [cursor=pointer]:
    - img [ref=e622]
  - alert [ref=e625]
  - generic [ref=e626]: "0.75"
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
      |     ^ Error: [/analytics/flow] Critical/serious violations: [
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