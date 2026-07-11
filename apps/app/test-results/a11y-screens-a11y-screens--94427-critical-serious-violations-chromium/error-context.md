# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y-screens.spec.ts >> a11y screens — static routes @auth >> /integrations has no critical/serious violations
- Location: e2e/a11y-screens.spec.ts:67:9

# Error details

```
Error: [/integrations] Critical/serious violations: [
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
              "fgColor": "#703d5a",
              "bgColor": "#1d1d40",
              "contrastRatio": 1.92,
              "fontSize": "8.3pt (11px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<span class=\"inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 font-medium text-[11px]\" style=\"color: rgb(251, 113, 133); background: rgba(251, 113, 133, 0.1); border-color: rgba(251, 113, 133, 0.3); opacity: 0.4;\">◈ Asana<span class=\"ml-0.5 opacity-60\">em breve</span></span>",
                "target": [
                  ".py-0\\.5.px-2.rounded-pill:nth-child(3)"
                ]
              },
              {
                "html": "<div class=\"rounded-2xl border border-hairline bg-surface-2 p-5\">",
                "target": [
                  ".p-5"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 1.92 (foreground color: #703d5a, background color: #1d1d40, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 font-medium text-[11px]\" style=\"color: rgb(251, 113, 133); background: rgba(251, 113, 133, 0.1); border-color: rgba(251, 113, 133, 0.3); opacity: 0.4;\">◈ Asana<span class=\"ml-0.5 opacity-60\">em breve</span></span>",
        "target": [
          ".py-0\\.5.px-2.rounded-pill:nth-child(3)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 1.92 (foreground color: #703d5a, background color: #1d1d40, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#4b2f4e",
              "bgColor": "#1d1d40",
              "contrastRatio": 1.39,
              "fontSize": "8.3pt (11px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<span class=\"inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 font-medium text-[11px]\" style=\"color: rgb(251, 113, 133); background: rgba(251, 113, 133, 0.1); border-color: rgba(251, 113, 133, 0.3); opacity: 0.4;\">◈ Asana<span class=\"ml-0.5 opacity-60\">em breve</span></span>",
                "target": [
                  ".py-0\\.5.px-2.rounded-pill:nth-child(3)"
                ]
              },
              {
                "html": "<div class=\"rounded-2xl border border-hairline bg-surface-2 p-5\">",
                "target": [
                  ".p-5"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 1.39 (foreground color: #4b2f4e, background color: #1d1d40, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"ml-0.5 opacity-60\">em breve</span>",
        "target": [
          ".py-0\\.5.px-2.rounded-pill:nth-child(3) > .ml-0\\.5.opacity-60"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 1.39 (foreground color: #4b2f4e, background color: #1d1d40, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#705c33",
              "bgColor": "#1d213c",
              "contrastRatio": 2.44,
              "fontSize": "8.3pt (11px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<span class=\"inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 font-medium text-[11px]\" style=\"color: rgb(251, 191, 36); background: rgba(251, 191, 36, 0.1); border-color: rgba(251, 191, 36, 0.3); opacity: 0.4;\">◆ GitLab<span class=\"ml-0.5 opacity-60\">em breve</span></span>",
                "target": [
                  ".py-0\\.5.px-2.rounded-pill:nth-child(4)"
                ]
              },
              {
                "html": "<div class=\"rounded-2xl border border-hairline bg-surface-2 p-5\">",
                "target": [
                  ".p-5"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 2.44 (foreground color: #705c33, background color: #1d213c, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 font-medium text-[11px]\" style=\"color: rgb(251, 191, 36); background: rgba(251, 191, 36, 0.1); border-color: rgba(251, 191, 36, 0.3); opacity: 0.4;\">◆ GitLab<span class=\"ml-0.5 opacity-60\">em breve</span></span>",
        "target": [
          ".py-0\\.5.px-2.rounded-pill:nth-child(4)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 2.44 (foreground color: #705c33, background color: #1d213c, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#4b4237",
              "bgColor": "#1d213c",
              "contrastRatio": 1.59,
              "fontSize": "8.3pt (11px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<span class=\"inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 font-medium text-[11px]\" style=\"color: rgb(251, 191, 36); background: rgba(251, 191, 36, 0.1); border-color: rgba(251, 191, 36, 0.3); opacity: 0.4;\">◆ GitLab<span class=\"ml-0.5 opacity-60\">em breve</span></span>",
                "target": [
                  ".py-0\\.5.px-2.rounded-pill:nth-child(4)"
                ]
              },
              {
                "html": "<div class=\"rounded-2xl border border-hairline bg-surface-2 p-5\">",
                "target": [
                  ".p-5"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 1.59 (foreground color: #4b4237, background color: #1d213c, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"ml-0.5 opacity-60\">em breve</span>",
        "target": [
          ".py-0\\.5.px-2.rounded-pill:nth-child(4) > .ml-0\\.5.opacity-60"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 1.59 (foreground color: #4b4237, background color: #1d213c, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
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
                  ".mb-4 > .bg-primary.text-primary-foreground.hover\\:bg-primary\\/90"
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
          ".mb-4 > .bg-primary.text-primary-foreground.hover\\:bg-primary\\/90"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 4.31 (foreground color: #fafafa, background color: #336cfa, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
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
                  ".h-9"
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
          ".h-9"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 4.31 (foreground color: #fafafa, background color: #336cfa, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1"
      }
    ]
  }
]

expect(received).toEqual(expected) // deep equality

- Expected  -   1
+ Received  + 257

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
+               "bgColor": "#1d1d40",
+               "contrastRatio": 1.92,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#703d5a",
+               "fontSize": "8.3pt (11px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 1.92 (foreground color: #703d5a, background color: #1d1d40, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<span class=\"inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 font-medium text-[11px]\" style=\"color: rgb(251, 113, 133); background: rgba(251, 113, 133, 0.1); border-color: rgba(251, 113, 133, 0.3); opacity: 0.4;\">◈ Asana<span class=\"ml-0.5 opacity-60\">em breve</span></span>",
+                 "target": Array [
+                   ".py-0\\.5.px-2.rounded-pill:nth-child(3)",
+                 ],
+               },
+               Object {
+                 "html": "<div class=\"rounded-2xl border border-hairline bg-surface-2 p-5\">",
+                 "target": Array [
+                   ".p-5",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 1.92 (foreground color: #703d5a, background color: #1d1d40, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 font-medium text-[11px]\" style=\"color: rgb(251, 113, 133); background: rgba(251, 113, 133, 0.1); border-color: rgba(251, 113, 133, 0.3); opacity: 0.4;\">◈ Asana<span class=\"ml-0.5 opacity-60\">em breve</span></span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".py-0\\.5.px-2.rounded-pill:nth-child(3)",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#1d1d40",
+               "contrastRatio": 1.39,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#4b2f4e",
+               "fontSize": "8.3pt (11px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 1.39 (foreground color: #4b2f4e, background color: #1d1d40, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<span class=\"inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 font-medium text-[11px]\" style=\"color: rgb(251, 113, 133); background: rgba(251, 113, 133, 0.1); border-color: rgba(251, 113, 133, 0.3); opacity: 0.4;\">◈ Asana<span class=\"ml-0.5 opacity-60\">em breve</span></span>",
+                 "target": Array [
+                   ".py-0\\.5.px-2.rounded-pill:nth-child(3)",
+                 ],
+               },
+               Object {
+                 "html": "<div class=\"rounded-2xl border border-hairline bg-surface-2 p-5\">",
+                 "target": Array [
+                   ".p-5",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 1.39 (foreground color: #4b2f4e, background color: #1d1d40, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"ml-0.5 opacity-60\">em breve</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".py-0\\.5.px-2.rounded-pill:nth-child(3) > .ml-0\\.5.opacity-60",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#1d213c",
+               "contrastRatio": 2.44,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#705c33",
+               "fontSize": "8.3pt (11px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.44 (foreground color: #705c33, background color: #1d213c, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<span class=\"inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 font-medium text-[11px]\" style=\"color: rgb(251, 191, 36); background: rgba(251, 191, 36, 0.1); border-color: rgba(251, 191, 36, 0.3); opacity: 0.4;\">◆ GitLab<span class=\"ml-0.5 opacity-60\">em breve</span></span>",
+                 "target": Array [
+                   ".py-0\\.5.px-2.rounded-pill:nth-child(4)",
+                 ],
+               },
+               Object {
+                 "html": "<div class=\"rounded-2xl border border-hairline bg-surface-2 p-5\">",
+                 "target": Array [
+                   ".p-5",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.44 (foreground color: #705c33, background color: #1d213c, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 font-medium text-[11px]\" style=\"color: rgb(251, 191, 36); background: rgba(251, 191, 36, 0.1); border-color: rgba(251, 191, 36, 0.3); opacity: 0.4;\">◆ GitLab<span class=\"ml-0.5 opacity-60\">em breve</span></span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".py-0\\.5.px-2.rounded-pill:nth-child(4)",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#1d213c",
+               "contrastRatio": 1.59,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#4b4237",
+               "fontSize": "8.3pt (11px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 1.59 (foreground color: #4b4237, background color: #1d213c, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<span class=\"inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 font-medium text-[11px]\" style=\"color: rgb(251, 191, 36); background: rgba(251, 191, 36, 0.1); border-color: rgba(251, 191, 36, 0.3); opacity: 0.4;\">◆ GitLab<span class=\"ml-0.5 opacity-60\">em breve</span></span>",
+                 "target": Array [
+                   ".py-0\\.5.px-2.rounded-pill:nth-child(4)",
+                 ],
+               },
+               Object {
+                 "html": "<div class=\"rounded-2xl border border-hairline bg-surface-2 p-5\">",
+                 "target": Array [
+                   ".p-5",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 1.59 (foreground color: #4b4237, background color: #1d213c, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"ml-0.5 opacity-60\">em breve</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".py-0\\.5.px-2.rounded-pill:nth-child(4) > .ml-0\\.5.opacity-60",
+         ],
+       },
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
+                   ".mb-4 > .bg-primary.text-primary-foreground.hover\\:bg-primary\\/90",
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
+           ".mb-4 > .bg-primary.text-primary-foreground.hover\\:bg-primary\\/90",
+         ],
+       },
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
+                   ".h-9",
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
+           ".h-9",
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
              - button "Toggle" [expanded] [ref=e112] [cursor=pointer]:
                - img [ref=e113]
                - generic [ref=e115]: Toggle
              - list [ref=e117]:
                - listitem [ref=e118]:
                  - link "Integration Hub" [ref=e119] [cursor=pointer]:
                    - /url: /integrations
                    - generic [ref=e120]: Integration Hub
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
          - generic [ref=e210] [cursor=pointer]: Integrations
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
        - generic [ref=e229]:
          - navigation "Navegação" [ref=e230]:
            - link "Voltar" [ref=e231] [cursor=pointer]:
              - /url: /settings/workspace
              - img [ref=e232]
            - link "Settings" [ref=e235] [cursor=pointer]:
              - /url: /settings/workspace
          - generic [ref=e237]:
            - generic [ref=e238]:
              - generic [ref=e239]: 0 conectadas
              - generic [ref=e241]: 0 desconectadas
              - link "Monitoramento Integration Health" [ref=e242] [cursor=pointer]:
                - /url: /integrations/health
                - img [ref=e244]
                - generic [ref=e246]:
                  - generic [ref=e247]: Monitoramento
                  - text: Integration Health
              - link "Importação Import Linear" [ref=e248] [cursor=pointer]:
                - /url: /integrations/linear/import
                - img [ref=e250]
                - generic [ref=e253]:
                  - generic [ref=e254]: Importação
                  - text: Import Linear
            - heading "Integrações" [level=1] [ref=e255]
            - paragraph [ref=e256]: Hub de conexões com ferramentas externas. Conecte para sincronizar itens automaticamente.
        - generic [ref=e257]:
          - generic [ref=e258]:
            - generic [ref=e259]:
              - img
              - img
              - img
              - generic [ref=e260]:
                - generic [ref=e261]: Conectadas
                - img [ref=e263]
              - generic [ref=e265]: 0/0
              - generic [ref=e266]: — Ativas agora
            - generic [ref=e267]:
              - img
              - img
              - img
              - generic [ref=e268]:
                - generic [ref=e269]: Itens sincronizados
                - img [ref=e271]
              - generic [ref=e273]: "0"
              - generic [ref=e274]: — Épicos + features
            - generic [ref=e275]:
              - img
              - img
              - img
              - generic [ref=e276]:
                - generic [ref=e277]: Fontes de import
                - img [ref=e279]
              - generic [ref=e281]: "0"
              - generic [ref=e282]: — Com dados
            - generic [ref=e283]:
              - img
              - img
              - img
              - generic [ref=e284]:
                - generic [ref=e285]: Desconectadas
                - img [ref=e287]
              - generic [ref=e289]: "0"
              - generic [ref=e290]: — Disponíveis
          - generic [ref=e291]:
            - generic [ref=e293]:
              - generic [ref=e294]:
                - paragraph [ref=e295]: Continue no seu fluxo. Ganhe visibilidade SAFe.
                - paragraph [ref=e296]: Devs continuam no Linear ou GitHub. RTEs, LPMs e PMs veem Program Board, WSJF, Flow Metrics e PI Planning com os dados reais — sem pedir que o time troque de ferramenta.
                - generic [ref=e297]:
                  - generic [ref=e298]: Sem ruptura de stack
                  - generic [ref=e300]: Features importadas aparecem no Program Board + WSJF
                  - generic [ref=e302]: Link direto para o item original em cada card
              - generic [ref=e304]:
                - generic [ref=e305]: ⬡ Linear
                - generic [ref=e306]: ⚙ GitHub Projects
                - generic [ref=e307]:
                  - text: ◈ Asana
                  - generic [ref=e308]: em breve
                - generic [ref=e309]:
                  - text: ◆ GitLab
                  - generic [ref=e310]: em breve
            - generic [ref=e311]:
              - generic [ref=e312]:
                - paragraph [ref=e313]: Integrações (0)
                - button "Conectar ferramenta" [ref=e314] [cursor=pointer]:
                  - img
                  - text: Conectar ferramenta
              - generic [ref=e315]:
                - img [ref=e316]
                - generic [ref=e322]:
                  - paragraph [ref=e323]: Nenhuma integração configurada
                  - paragraph [ref=e324]: Conecte Linear ou GitHub Projects para importar features e stories diretamente para o COSMOS.
                - button "Conectar agora" [ref=e325] [cursor=pointer]:
                  - img
                  - text: Conectar agora
            - generic [ref=e326]:
              - paragraph [ref=e327]: Como funciona
              - generic [ref=e328]:
                - generic [ref=e329]:
                  - paragraph [ref=e330]: 1. Conecte
                  - paragraph [ref=e331]: Informe seu API key ou token. O COSMOS testa a conexão e lista seus projetos/times.
                - generic [ref=e332]:
                  - paragraph [ref=e333]: 2. Importe
                  - paragraph [ref=e334]: Selecione o projeto e mapeie para Epic, PI ou Time no COSMOS. Issues viram Features ou Stories.
                - generic [ref=e335]:
                  - paragraph [ref=e336]: 3. Use no COSMOS
                  - paragraph [ref=e337]: Features importadas aparecem no Program Board, WSJF, Flow Metrics e PI Planning — com link para o item original.
    - button "Abrir Copilot AI" [ref=e340] [cursor=pointer]:
      - img [ref=e341]
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e351] [cursor=pointer]:
    - img [ref=e352]
  - alert [ref=e355]
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
      |     ^ Error: [/integrations] Critical/serious violations: [
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