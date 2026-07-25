# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y-screens.spec.ts >> a11y screens — static routes @auth >> /portfolio/wsjf has no critical/serious violations
- Location: e2e/a11y-screens.spec.ts:67:9

# Error details

```
Error: [/portfolio/wsjf] Critical/serious violations: [
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
          ".data-\\[placeholder\\]\\:text-muted-foreground"
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
              "fgColor": "#8b5cf6",
              "bgColor": "#1a1a43",
              "contrastRatio": 3.89,
              "fontSize": "7.5pt (10px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<span class=\"inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[10px]\" style=\"background: rgba(139, 92, 246, 0.094); border-color: rgba(139, 92, 246, 0.333); color: rgb(139, 92, 246);\">Inovação com IA aplicada ao SAFe</span>",
                "target": [
                  ".border-border\\/50.last\\:border-0.hover\\:bg-muted\\/30:nth-child(1) > .pl-2.pr-4:nth-child(4) > .inline-flex.text-\\[10px\\].py-0\\.5"
                ]
              },
              {
                "html": "<div style=\"border: 1px solid var(--hairline); border-radius: 14px; background: var(--surface); overflow: hidden; box-shadow: rgba(255, 255, 255, 0.03) 0px 1px 0px inset, rgba(0, 0, 0, 0.9) 0px 12px 28px -22px;\">",
                "target": [
                  ".space-y-6 > div:nth-child(4)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.89 (foreground color: #8b5cf6, background color: #1a1a43, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[10px]\" style=\"background: rgba(139, 92, 246, 0.094); border-color: rgba(139, 92, 246, 0.333); color: rgb(139, 92, 246);\">Inovação com IA aplicada ao SAFe</span>",
        "target": [
          ".border-border\\/50.last\\:border-0.hover\\:bg-muted\\/30:nth-child(1) > .pl-2.pr-4:nth-child(4) > .inline-flex.text-\\[10px\\].py-0\\.5"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.89 (foreground color: #8b5cf6, background color: #1a1a43, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#ef4444",
              "bgColor": "#231832",
              "contrastRatio": 4.47,
              "fontSize": "7.5pt (10px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<span class=\"inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[10px]\" style=\"background: rgba(239, 68, 68, 0.094); border-color: rgba(239, 68, 68, 0.333); color: rgb(239, 68, 68);\">Compliance &amp; Segurança Enterprise</span>",
                "target": [
                  ".border-border\\/50.last\\:border-0.hover\\:bg-muted\\/30:nth-child(2) > .pl-2.pr-4:nth-child(4) > .inline-flex.text-\\[10px\\].py-0\\.5"
                ]
              },
              {
                "html": "<div style=\"border: 1px solid var(--hairline); border-radius: 14px; background: var(--surface); overflow: hidden; box-shadow: rgba(255, 255, 255, 0.03) 0px 1px 0px inset, rgba(0, 0, 0, 0.9) 0px 12px 28px -22px;\">",
                "target": [
                  ".space-y-6 > div:nth-child(4)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 4.47 (foreground color: #ef4444, background color: #231832, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[10px]\" style=\"background: rgba(239, 68, 68, 0.094); border-color: rgba(239, 68, 68, 0.333); color: rgb(239, 68, 68);\">Compliance &amp; Segurança Enterprise</span>",
        "target": [
          ".border-border\\/50.last\\:border-0.hover\\:bg-muted\\/30:nth-child(2) > .pl-2.pr-4:nth-child(4) > .inline-flex.text-\\[10px\\].py-0\\.5"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 4.47 (foreground color: #ef4444, background color: #231832, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#6366f1",
              "bgColor": "#161b42",
              "contrastRatio": 3.7,
              "fontSize": "7.5pt (10px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<span class=\"inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[10px]\" style=\"background: rgba(99, 102, 241, 0.094); border-color: rgba(99, 102, 241, 0.333); color: rgb(99, 102, 241);\">Acelerar time-to-market enterprise</span>",
                "target": [
                  ".border-border\\/50.last\\:border-0.hover\\:bg-muted\\/30:nth-child(3) > .pl-2.pr-4:nth-child(4) > .inline-flex.text-\\[10px\\].py-0\\.5"
                ]
              },
              {
                "html": "<div style=\"border: 1px solid var(--hairline); border-radius: 14px; background: var(--surface); overflow: hidden; box-shadow: rgba(255, 255, 255, 0.03) 0px 1px 0px inset, rgba(0, 0, 0, 0.9) 0px 12px 28px -22px;\">",
                "target": [
                  ".space-y-6 > div:nth-child(4)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.7 (foreground color: #6366f1, background color: #161b42, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[10px]\" style=\"background: rgba(99, 102, 241, 0.094); border-color: rgba(99, 102, 241, 0.333); color: rgb(99, 102, 241);\">Acelerar time-to-market enterprise</span>",
        "target": [
          ".border-border\\/50.last\\:border-0.hover\\:bg-muted\\/30:nth-child(3) > .pl-2.pr-4:nth-child(4) > .inline-flex.text-\\[10px\\].py-0\\.5"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.7 (foreground color: #6366f1, background color: #161b42, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#6366f1",
              "bgColor": "#161b42",
              "contrastRatio": 3.7,
              "fontSize": "7.5pt (10px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<span class=\"inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[10px]\" style=\"background: rgba(99, 102, 241, 0.094); border-color: rgba(99, 102, 241, 0.333); color: rgb(99, 102, 241);\">Acelerar time-to-market enterprise</span>",
                "target": [
                  ".border-border\\/50.last\\:border-0.hover\\:bg-muted\\/30:nth-child(4) > .pl-2.pr-4:nth-child(4) > .inline-flex.text-\\[10px\\].py-0\\.5"
                ]
              },
              {
                "html": "<div style=\"border: 1px solid var(--hairline); border-radius: 14px; background: var(--surface); overflow: hidden; box-shadow: rgba(255, 255, 255, 0.03) 0px 1px 0px inset, rgba(0, 0, 0, 0.9) 0px 12px 28px -22px;\">",
                "target": [
                  ".space-y-6 > div:nth-child(4)"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.7 (foreground color: #6366f1, background color: #161b42, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[10px]\" style=\"background: rgba(99, 102, 241, 0.094); border-color: rgba(99, 102, 241, 0.333); color: rgb(99, 102, 241);\">Acelerar time-to-market enterprise</span>",
        "target": [
          ".border-border\\/50.last\\:border-0.hover\\:bg-muted\\/30:nth-child(4) > .pl-2.pr-4:nth-child(4) > .inline-flex.text-\\[10px\\].py-0\\.5"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.7 (foreground color: #6366f1, background color: #161b42, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1"
      }
    ]
  }
]

expect(received).toEqual(expected) // deep equality

- Expected  -   1
+ Received  + 280

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
+           ".data-\\[placeholder\\]\\:text-muted-foreground",
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
+               "bgColor": "#1a1a43",
+               "contrastRatio": 3.89,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#8b5cf6",
+               "fontSize": "7.5pt (10px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.89 (foreground color: #8b5cf6, background color: #1a1a43, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<span class=\"inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[10px]\" style=\"background: rgba(139, 92, 246, 0.094); border-color: rgba(139, 92, 246, 0.333); color: rgb(139, 92, 246);\">Inovação com IA aplicada ao SAFe</span>",
+                 "target": Array [
+                   ".border-border\\/50.last\\:border-0.hover\\:bg-muted\\/30:nth-child(1) > .pl-2.pr-4:nth-child(4) > .inline-flex.text-\\[10px\\].py-0\\.5",
+                 ],
+               },
+               Object {
+                 "html": "<div style=\"border: 1px solid var(--hairline); border-radius: 14px; background: var(--surface); overflow: hidden; box-shadow: rgba(255, 255, 255, 0.03) 0px 1px 0px inset, rgba(0, 0, 0, 0.9) 0px 12px 28px -22px;\">",
+                 "target": Array [
+                   ".space-y-6 > div:nth-child(4)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.89 (foreground color: #8b5cf6, background color: #1a1a43, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[10px]\" style=\"background: rgba(139, 92, 246, 0.094); border-color: rgba(139, 92, 246, 0.333); color: rgb(139, 92, 246);\">Inovação com IA aplicada ao SAFe</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".border-border\\/50.last\\:border-0.hover\\:bg-muted\\/30:nth-child(1) > .pl-2.pr-4:nth-child(4) > .inline-flex.text-\\[10px\\].py-0\\.5",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#231832",
+               "contrastRatio": 4.47,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#ef4444",
+               "fontSize": "7.5pt (10px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.47 (foreground color: #ef4444, background color: #231832, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<span class=\"inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[10px]\" style=\"background: rgba(239, 68, 68, 0.094); border-color: rgba(239, 68, 68, 0.333); color: rgb(239, 68, 68);\">Compliance &amp; Segurança Enterprise</span>",
+                 "target": Array [
+                   ".border-border\\/50.last\\:border-0.hover\\:bg-muted\\/30:nth-child(2) > .pl-2.pr-4:nth-child(4) > .inline-flex.text-\\[10px\\].py-0\\.5",
+                 ],
+               },
+               Object {
+                 "html": "<div style=\"border: 1px solid var(--hairline); border-radius: 14px; background: var(--surface); overflow: hidden; box-shadow: rgba(255, 255, 255, 0.03) 0px 1px 0px inset, rgba(0, 0, 0, 0.9) 0px 12px 28px -22px;\">",
+                 "target": Array [
+                   ".space-y-6 > div:nth-child(4)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.47 (foreground color: #ef4444, background color: #231832, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[10px]\" style=\"background: rgba(239, 68, 68, 0.094); border-color: rgba(239, 68, 68, 0.333); color: rgb(239, 68, 68);\">Compliance &amp; Segurança Enterprise</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".border-border\\/50.last\\:border-0.hover\\:bg-muted\\/30:nth-child(2) > .pl-2.pr-4:nth-child(4) > .inline-flex.text-\\[10px\\].py-0\\.5",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#161b42",
+               "contrastRatio": 3.7,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#6366f1",
+               "fontSize": "7.5pt (10px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.7 (foreground color: #6366f1, background color: #161b42, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<span class=\"inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[10px]\" style=\"background: rgba(99, 102, 241, 0.094); border-color: rgba(99, 102, 241, 0.333); color: rgb(99, 102, 241);\">Acelerar time-to-market enterprise</span>",
+                 "target": Array [
+                   ".border-border\\/50.last\\:border-0.hover\\:bg-muted\\/30:nth-child(3) > .pl-2.pr-4:nth-child(4) > .inline-flex.text-\\[10px\\].py-0\\.5",
+                 ],
+               },
+               Object {
+                 "html": "<div style=\"border: 1px solid var(--hairline); border-radius: 14px; background: var(--surface); overflow: hidden; box-shadow: rgba(255, 255, 255, 0.03) 0px 1px 0px inset, rgba(0, 0, 0, 0.9) 0px 12px 28px -22px;\">",
+                 "target": Array [
+                   ".space-y-6 > div:nth-child(4)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.7 (foreground color: #6366f1, background color: #161b42, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[10px]\" style=\"background: rgba(99, 102, 241, 0.094); border-color: rgba(99, 102, 241, 0.333); color: rgb(99, 102, 241);\">Acelerar time-to-market enterprise</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".border-border\\/50.last\\:border-0.hover\\:bg-muted\\/30:nth-child(3) > .pl-2.pr-4:nth-child(4) > .inline-flex.text-\\[10px\\].py-0\\.5",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#161b42",
+               "contrastRatio": 3.7,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#6366f1",
+               "fontSize": "7.5pt (10px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.7 (foreground color: #6366f1, background color: #161b42, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<span class=\"inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[10px]\" style=\"background: rgba(99, 102, 241, 0.094); border-color: rgba(99, 102, 241, 0.333); color: rgb(99, 102, 241);\">Acelerar time-to-market enterprise</span>",
+                 "target": Array [
+                   ".border-border\\/50.last\\:border-0.hover\\:bg-muted\\/30:nth-child(4) > .pl-2.pr-4:nth-child(4) > .inline-flex.text-\\[10px\\].py-0\\.5",
+                 ],
+               },
+               Object {
+                 "html": "<div style=\"border: 1px solid var(--hairline); border-radius: 14px; background: var(--surface); overflow: hidden; box-shadow: rgba(255, 255, 255, 0.03) 0px 1px 0px inset, rgba(0, 0, 0, 0.9) 0px 12px 28px -22px;\">",
+                 "target": Array [
+                   ".space-y-6 > div:nth-child(4)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.7 (foreground color: #6366f1, background color: #161b42, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[10px]\" style=\"background: rgba(99, 102, 241, 0.094); border-color: rgba(99, 102, 241, 0.333); color: rgb(99, 102, 241);\">Acelerar time-to-market enterprise</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".border-border\\/50.last\\:border-0.hover\\:bg-muted\\/30:nth-child(4) > .pl-2.pr-4:nth-child(4) > .inline-flex.text-\\[10px\\].py-0\\.5",
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
          - generic [ref=e241] [cursor=pointer]: Wsjf
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
            - link "Voltar" [ref=e262] [cursor=pointer]:
              - /url: /portfolio
              - img [ref=e263]
            - link "Portfolio" [ref=e266] [cursor=pointer]:
              - /url: /portfolio
          - generic [ref=e267]:
            - generic [ref=e268]:
              - generic [ref=e270]: 4 itens na fila
              - heading "Priorização WSJF" [level=1] [ref=e272]
              - paragraph [ref=e273]: Weighted Shortest Job First — ordene épicos e features por custo de atraso ÷ tamanho do job.
            - link "Board Portfolio Kanban" [ref=e275] [cursor=pointer]:
              - /url: /portfolio
              - img [ref=e277]
              - generic [ref=e282]:
                - generic [ref=e283]: Board
                - text: Portfolio Kanban
        - generic [ref=e285]:
          - generic [ref=e286]:
            - combobox [ref=e287] [cursor=pointer]:
              - generic: Todos os temas
              - img
            - generic [ref=e288]:
              - button "Simulador de Cenários" [ref=e289] [cursor=pointer]:
                - img
                - text: Simulador de Cenários
              - button "Configurações" [ref=e290] [cursor=pointer]:
                - img
                - text: Configurações
          - generic [ref=e291]:
            - generic [ref=e292]:
              - img
              - img
              - img
              - generic [ref=e293]:
                - generic [ref=e294]: Features priorizadas
                - img [ref=e296]
              - generic [ref=e298]: "4"
              - generic [ref=e299]: — Fila WSJF
            - generic [ref=e300]:
              - img
              - img
              - img
              - generic [ref=e301]:
                - generic [ref=e302]: Maior WSJF
                - img [ref=e304]
              - generic [ref=e306]: "9.7"
              - generic [ref=e307]: ↗ Próxima a puxar
            - generic [ref=e308]:
              - img
              - img
              - img
              - generic [ref=e309]:
                - generic [ref=e310]: WSJF médio
                - img [ref=e312]
              - generic [ref=e314]: "6.6"
              - generic [ref=e315]: — Média do portfólio
            - generic [ref=e316]:
              - img
              - img
              - img
              - generic [ref=e317]:
                - generic [ref=e318]: Aguardando score
                - img [ref=e320]
              - generic [ref=e322]: "0"
              - generic [ref=e323]: — Sem features ainda
          - generic [ref=e324]:
            - generic [ref=e325]:
              - img [ref=e327]
              - generic [ref=e330]:
                - paragraph [ref=e331]: Rebalanceamento por IA
                - paragraph [ref=e332]: Analise todos os épicos e features com base nas metas do portfólio e receba sugestões de repriorização automática.
            - button "Rebalancear com IA" [ref=e335] [cursor=pointer]:
              - img
              - text: Rebalancear com IA
          - generic [ref=e336]:
            - generic [ref=e337]:
              - img [ref=e339]
              - generic [ref=e342]:
                - generic [ref=e343]: Ranking WSJF
                - generic [ref=e344]: CoD (BV+TC+RR) ÷ Job Size
              - button "Rebalance" [ref=e346] [cursor=pointer]:
                - img
                - text: Rebalance
            - table [ref=e348]:
              - rowgroup [ref=e349]:
                - row "# Feature Título Tema Business Value Time Criticality Risk Reduction / OE CoD Job Size WSJF ▼" [ref=e350]:
                  - columnheader "#" [ref=e351]
                  - columnheader "Feature" [ref=e352] [cursor=pointer]
                  - columnheader "Título" [ref=e353]
                  - columnheader "Tema" [ref=e354] [cursor=pointer]
                  - columnheader "Business Value" [ref=e355] [cursor=pointer]
                  - columnheader "Time Criticality" [ref=e356] [cursor=pointer]
                  - columnheader "Risk Reduction / OE" [ref=e357] [cursor=pointer]
                  - columnheader "CoD" [ref=e358]
                  - columnheader "Job Size" [ref=e359] [cursor=pointer]
                  - columnheader "WSJF ▼" [ref=e360] [cursor=pointer]:
                    - text: WSJF
                    - generic [ref=e361]: ▼
              - rowgroup [ref=e362]:
                - 'row "1 FT-2YN3 Risk Score Engine baseado em histórico de entregas Inovação com IA aplicada ao SAFe Business Value: 13 Time Criticality: 8 Risk Reduction / OE: 8 29 Job Size: 3 9.7" [ref=e363] [cursor=pointer]':
                  - cell "1" [ref=e364]:
                    - generic [ref=e365]: "1"
                  - cell "FT-2YN3" [ref=e366]
                  - cell "Risk Score Engine baseado em histórico de entregas" [ref=e367]
                  - cell "Inovação com IA aplicada ao SAFe" [ref=e368]:
                    - generic [ref=e369]: Inovação com IA aplicada ao SAFe
                  - 'cell "Business Value: 13" [ref=e370]':
                    - 'button "Business Value: 13" [ref=e372]': Business Value13
                  - 'cell "Time Criticality: 8" [ref=e373]':
                    - 'button "Time Criticality: 8" [ref=e375]': Time Criticality8
                  - 'cell "Risk Reduction / OE: 8" [ref=e376]':
                    - 'button "Risk Reduction / OE: 8" [ref=e378]': Risk Reduction / OE8
                  - cell "29" [ref=e379]
                  - 'cell "Job Size: 3" [ref=e380]':
                    - 'button "Job Size: 3" [ref=e382]': Job Size3
                  - cell "9.7" [ref=e383]:
                    - generic [ref=e385]: "9.7"
                - 'row "2 FT-E85P SAML 2.0 IdP Integration (Okta, Azure AD) Compliance & Segurança Enterprise Business Value: 13 Time Criticality: 13 Risk Reduction / OE: 8 34 Job Size: 5 6.8" [ref=e388] [cursor=pointer]':
                  - cell "2" [ref=e389]:
                    - generic [ref=e390]: "2"
                  - cell "FT-E85P" [ref=e391]
                  - cell "SAML 2.0 IdP Integration (Okta, Azure AD)" [ref=e392]
                  - cell "Compliance & Segurança Enterprise" [ref=e393]:
                    - generic [ref=e394]: Compliance & Segurança Enterprise
                  - 'cell "Business Value: 13" [ref=e395]':
                    - 'button "Business Value: 13" [ref=e397]': Business Value13
                  - 'cell "Time Criticality: 13" [ref=e398]':
                    - 'button "Time Criticality: 13" [ref=e400]': Time Criticality13
                  - 'cell "Risk Reduction / OE: 8" [ref=e401]':
                    - 'button "Risk Reduction / OE: 8" [ref=e403]': Risk Reduction / OE8
                  - cell "34" [ref=e404]
                  - 'cell "Job Size: 5" [ref=e405]':
                    - 'button "Job Size: 5" [ref=e407]': Job Size5
                  - cell "6.8" [ref=e408]:
                    - generic [ref=e410]: "6.8"
                - 'row "3 FT-8COP OKR Dashboard com Key Results Acelerar time-to-market enterprise Business Value: 13 Time Criticality: 8 Risk Reduction / OE: 5 26 Job Size: 5 5.2" [ref=e413] [cursor=pointer]':
                  - cell "3" [ref=e414]:
                    - generic [ref=e415]: "3"
                  - cell "FT-8COP" [ref=e416]
                  - cell "OKR Dashboard com Key Results" [ref=e417]
                  - cell "Acelerar time-to-market enterprise" [ref=e418]:
                    - generic [ref=e419]: Acelerar time-to-market enterprise
                  - 'cell "Business Value: 13" [ref=e420]':
                    - 'button "Business Value: 13" [ref=e422]': Business Value13
                  - 'cell "Time Criticality: 8" [ref=e423]':
                    - 'button "Time Criticality: 8" [ref=e425]': Time Criticality8
                  - 'cell "Risk Reduction / OE: 5" [ref=e426]':
                    - 'button "Risk Reduction / OE: 5" [ref=e428]': Risk Reduction / OE5
                  - cell "26" [ref=e429]
                  - 'cell "Job Size: 5" [ref=e430]':
                    - 'button "Job Size: 5" [ref=e432]': Job Size5
                  - cell "5.2" [ref=e433]:
                    - generic [ref=e435]: "5.2"
                - 'row "4 FT-PT7Y Portfolio Kanban Board (5 colunas SAFe) Acelerar time-to-market enterprise Business Value: 20 Time Criticality: 13 Risk Reduction / OE: 5 38 Job Size: 8 4.8" [ref=e438] [cursor=pointer]':
                  - cell "4" [ref=e439]:
                    - generic [ref=e440]: "4"
                  - cell "FT-PT7Y" [ref=e441]
                  - cell "Portfolio Kanban Board (5 colunas SAFe)" [ref=e442]
                  - cell "Acelerar time-to-market enterprise" [ref=e443]:
                    - generic [ref=e444]: Acelerar time-to-market enterprise
                  - 'cell "Business Value: 20" [ref=e445]':
                    - 'button "Business Value: 20" [ref=e447]': Business Value20
                  - 'cell "Time Criticality: 13" [ref=e448]':
                    - 'button "Time Criticality: 13" [ref=e450]': Time Criticality13
                  - 'cell "Risk Reduction / OE: 5" [ref=e451]':
                    - 'button "Risk Reduction / OE: 5" [ref=e453]': Risk Reduction / OE5
                  - cell "38" [ref=e454]
                  - 'cell "Job Size: 8" [ref=e455]':
                    - 'button "Job Size: 8" [ref=e457]': Job Size8
                  - cell "4.8" [ref=e458]:
                    - generic [ref=e460]: "4.8"
          - generic [ref=e464]:
            - img [ref=e465]
            - text: Execute o Rebalanceamento IA para ver explicações de prioridade.
    - button "Abrir Copilot AI" [ref=e469] [cursor=pointer]:
      - img [ref=e470]
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e480] [cursor=pointer]:
    - img [ref=e481]
  - alert [ref=e484]
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
      |     ^ Error: [/portfolio/wsjf] Critical/serious violations: [
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