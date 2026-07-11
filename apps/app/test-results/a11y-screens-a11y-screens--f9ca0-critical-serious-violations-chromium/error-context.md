# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y-screens.spec.ts >> a11y screens — dynamic ART/Team routes @auth >> Team standup has no critical/serious violations
- Location: e2e/a11y-screens.spec.ts:98:7

# Error details

```
Error: [/teams/[teamId]/standup] Critical/serious violations: [
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
                "html": "<a href=\"#meu-standup\" data-slot=\"button\" class=\"inline-flex items-ce...\">",
                "target": [
                  ".gap-2.items-center.flex > .bg-primary.text-primary-foreground.hover\\:bg-primary\\/90"
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
        "html": "<a href=\"#meu-standup\" data-slot=\"button\" class=\"inline-flex items-ce...\">",
        "target": [
          ".gap-2.items-center.flex > .bg-primary.text-primary-foreground.hover\\:bg-primary\\/90"
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
                "html": "<button data-slot=\"button\" class=\"inline-flex items-ce...\" type=\"submit\">",
                "target": [
                  "button[type=\"submit\"]"
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
        "html": "<button data-slot=\"button\" class=\"inline-flex items-ce...\" type=\"submit\">",
        "target": [
          "button[type=\"submit\"]"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 4.31 (foreground color: #fafafa, background color: #336cfa, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#7d8999",
              "bgColor": "#1c203d",
              "contrastRatio": 4.46,
              "fontSize": "8.6pt (11.5px)",
              "fontWeight": "bold",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<span class=\"inline-flex items-center gap-1.5 rounded-pill px-[9px] py-[3px] font-bold text-[11.5px] tracking-[.01em]\" style=\"background: var(--chip-bg); color: var(--ink-muted); border: 1px solid var(--hairline);\">você</span>",
                "target": [
                  "div:nth-child(1) > .\\[grid-template-columns\\:repeat\\(auto-fill\\,minmax\\(300px\\,1fr\\)\\)\\].gap-2\\.5.grid > .bg-surface.rounded-lg.overflow-hidden > .bg-surface-2.py-3.gap-2\\.5 > .gap-1\\.5.shrink-0.items-center > .rounded-pill.py-\\[3px\\].tracking-\\[\\.01em\\]"
                ]
              },
              {
                "html": "<div class=\"flex items-center gap-2.5 border-hairline border-b bg-surface-2 px-4 py-3\">",
                "target": [
                  "div:nth-child(1) > .\\[grid-template-columns\\:repeat\\(auto-fill\\,minmax\\(300px\\,1fr\\)\\)\\].gap-2\\.5.grid > .bg-surface.rounded-lg.overflow-hidden > .bg-surface-2.py-3.gap-2\\.5"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 4.46 (foreground color: #7d8999, background color: #1c203d, font size: 8.6pt (11.5px), font weight: bold). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"inline-flex items-center gap-1.5 rounded-pill px-[9px] py-[3px] font-bold text-[11.5px] tracking-[.01em]\" style=\"background: var(--chip-bg); color: var(--ink-muted); border: 1px solid var(--hairline);\">você</span>",
        "target": [
          "div:nth-child(1) > .\\[grid-template-columns\\:repeat\\(auto-fill\\,minmax\\(300px\\,1fr\\)\\)\\].gap-2\\.5.grid > .bg-surface.rounded-lg.overflow-hidden > .bg-surface-2.py-3.gap-2\\.5 > .gap-1\\.5.shrink-0.items-center > .rounded-pill.py-\\[3px\\].tracking-\\[\\.01em\\]"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 4.46 (foreground color: #7d8999, background color: #1c203d, font size: 8.6pt (11.5px), font weight: bold). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#6d6d70",
              "bgColor": "#0c1029",
              "contrastRatio": 3.62,
              "fontSize": "9.4pt (12.5px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div class=\"overflow-hidden rounded-lg bg-surface\" style=\"border: 1px solid var(--hairline); opacity: 0.85;\">",
                "target": [
                  "div:nth-child(1) > .\\[grid-template-columns\\:repeat\\(auto-fill\\,minmax\\(300px\\,1fr\\)\\)\\].gap-2\\.5.grid > .bg-surface.rounded-lg.overflow-hidden"
                ]
              },
              {
                "html": "<main data-slot=\"sidebar-inset\" class=\"bg-background relati...\">",
                "target": [
                  "main"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.62 (foreground color: #6d6d70, background color: #0c1029, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<p class=\"whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-subtle\">Implementei server action createOKR com validação Zod e error handling</p>",
        "target": [
          "div:nth-child(1) > .\\[grid-template-columns\\:repeat\\(auto-fill\\,minmax\\(300px\\,1fr\\)\\)\\].gap-2\\.5.grid > .bg-surface.rounded-lg.overflow-hidden > .px-4.py-1 > .py-2\\.5.border-hairline.border-b:nth-child(1) > .text-ink-subtle.whitespace-pre-wrap.leading-relaxed"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.62 (foreground color: #6d6d70, background color: #0c1029, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#6d6d70",
              "bgColor": "#0c1029",
              "contrastRatio": 3.62,
              "fontSize": "9.4pt (12.5px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div class=\"overflow-hidden rounded-lg bg-surface\" style=\"border: 1px solid var(--hairline); opacity: 0.85;\">",
                "target": [
                  "div:nth-child(1) > .\\[grid-template-columns\\:repeat\\(auto-fill\\,minmax\\(300px\\,1fr\\)\\)\\].gap-2\\.5.grid > .bg-surface.rounded-lg.overflow-hidden"
                ]
              },
              {
                "html": "<main data-slot=\"sidebar-inset\" class=\"bg-background relati...\">",
                "target": [
                  "main"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.62 (foreground color: #6d6d70, background color: #0c1029, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<p class=\"whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-subtle\">Vou construir OKRFormModal e integrar com server action</p>",
        "target": [
          "div:nth-child(1) > .\\[grid-template-columns\\:repeat\\(auto-fill\\,minmax\\(300px\\,1fr\\)\\)\\].gap-2\\.5.grid > .bg-surface.rounded-lg.overflow-hidden > .px-4.py-1 > .py-2\\.5.border-hairline.border-b:nth-child(2) > .text-ink-subtle.whitespace-pre-wrap.leading-relaxed"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.62 (foreground color: #6d6d70, background color: #0c1029, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#7d8999",
              "bgColor": "#1c203d",
              "contrastRatio": 4.46,
              "fontSize": "8.6pt (11.5px)",
              "fontWeight": "bold",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<span class=\"inline-flex items-center gap-1.5 rounded-pill px-[9px] py-[3px] font-bold text-[11.5px] tracking-[.01em]\" style=\"background: var(--chip-bg); color: var(--ink-muted); border: 1px solid var(--hairline);\">você</span>",
                "target": [
                  "div:nth-child(2) > .\\[grid-template-columns\\:repeat\\(auto-fill\\,minmax\\(300px\\,1fr\\)\\)\\].gap-2\\.5.grid > .bg-surface.rounded-lg.overflow-hidden > .bg-surface-2.py-3.gap-2\\.5 > .gap-1\\.5.shrink-0.items-center > .rounded-pill.py-\\[3px\\].tracking-\\[\\.01em\\]:nth-child(1)"
                ]
              },
              {
                "html": "<div class=\"flex items-center gap-2.5 border-hairline border-b bg-surface-2 px-4 py-3\">",
                "target": [
                  "div:nth-child(2) > .\\[grid-template-columns\\:repeat\\(auto-fill\\,minmax\\(300px\\,1fr\\)\\)\\].gap-2\\.5.grid > .bg-surface.rounded-lg.overflow-hidden > .bg-surface-2.py-3.gap-2\\.5"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 4.46 (foreground color: #7d8999, background color: #1c203d, font size: 8.6pt (11.5px), font weight: bold). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span class=\"inline-flex items-center gap-1.5 rounded-pill px-[9px] py-[3px] font-bold text-[11.5px] tracking-[.01em]\" style=\"background: var(--chip-bg); color: var(--ink-muted); border: 1px solid var(--hairline);\">você</span>",
        "target": [
          "div:nth-child(2) > .\\[grid-template-columns\\:repeat\\(auto-fill\\,minmax\\(300px\\,1fr\\)\\)\\].gap-2\\.5.grid > .bg-surface.rounded-lg.overflow-hidden > .bg-surface-2.py-3.gap-2\\.5 > .gap-1\\.5.shrink-0.items-center > .rounded-pill.py-\\[3px\\].tracking-\\[\\.01em\\]:nth-child(1)"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 4.46 (foreground color: #7d8999, background color: #1c203d, font size: 8.6pt (11.5px), font weight: bold). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#6d6d70",
              "bgColor": "#0c1029",
              "contrastRatio": 3.62,
              "fontSize": "9.4pt (12.5px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div class=\"overflow-hidden rounded-lg bg-surface\" style=\"border: 1px solid rgba(var(--red-rgb),.4); opacity: 0.85;\">",
                "target": [
                  "div:nth-child(2) > .\\[grid-template-columns\\:repeat\\(auto-fill\\,minmax\\(300px\\,1fr\\)\\)\\].gap-2\\.5.grid > .bg-surface.rounded-lg.overflow-hidden"
                ]
              },
              {
                "html": "<main data-slot=\"sidebar-inset\" class=\"bg-background relati...\">",
                "target": [
                  "main"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.62 (foreground color: #6d6d70, background color: #0c1029, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<p class=\"whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-subtle\">Criei schema Zod para OKR e escrevi testes unitários</p>",
        "target": [
          "div:nth-child(2) > .\\[grid-template-columns\\:repeat\\(auto-fill\\,minmax\\(300px\\,1fr\\)\\)\\].gap-2\\.5.grid > .bg-surface.rounded-lg.overflow-hidden > .px-4.py-1 > .py-2\\.5.border-hairline.border-b:nth-child(1) > .text-ink-subtle.whitespace-pre-wrap.leading-relaxed"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.62 (foreground color: #6d6d70, background color: #0c1029, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#6d6d70",
              "bgColor": "#0c1029",
              "contrastRatio": 3.62,
              "fontSize": "9.4pt (12.5px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<div class=\"overflow-hidden rounded-lg bg-surface\" style=\"border: 1px solid rgba(var(--red-rgb),.4); opacity: 0.85;\">",
                "target": [
                  "div:nth-child(2) > .\\[grid-template-columns\\:repeat\\(auto-fill\\,minmax\\(300px\\,1fr\\)\\)\\].gap-2\\.5.grid > .bg-surface.rounded-lg.overflow-hidden"
                ]
              },
              {
                "html": "<main data-slot=\"sidebar-inset\" class=\"bg-background relati...\">",
                "target": [
                  "main"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.62 (foreground color: #6d6d70, background color: #0c1029, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<p class=\"whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-subtle\">Implementar server action e começar o modal</p>",
        "target": [
          "div:nth-child(2) > .\\[grid-template-columns\\:repeat\\(auto-fill\\,minmax\\(300px\\,1fr\\)\\)\\].gap-2\\.5.grid > .bg-surface.rounded-lg.overflow-hidden > .px-4.py-1 > .py-2\\.5.border-hairline.border-b:nth-child(2) > .text-ink-subtle.whitespace-pre-wrap.leading-relaxed"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.62 (foreground color: #6d6d70, background color: #0c1029, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1"
      }
    ]
  }
]

expect(received).toEqual(expected) // deep equality

- Expected  -   1
+ Received  + 339

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
+                 "html": "<a href=\"#meu-standup\" data-slot=\"button\" class=\"inline-flex items-ce...\">",
+                 "target": Array [
+                   ".gap-2.items-center.flex > .bg-primary.text-primary-foreground.hover\\:bg-primary\\/90",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.31 (foreground color: #fafafa, background color: #336cfa, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<a href=\"#meu-standup\" data-slot=\"button\" class=\"inline-flex items-ce...\">",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".gap-2.items-center.flex > .bg-primary.text-primary-foreground.hover\\:bg-primary\\/90",
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
+                 "html": "<button data-slot=\"button\" class=\"inline-flex items-ce...\" type=\"submit\">",
+                 "target": Array [
+                   "button[type=\"submit\"]",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.31 (foreground color: #fafafa, background color: #336cfa, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<button data-slot=\"button\" class=\"inline-flex items-ce...\" type=\"submit\">",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "button[type=\"submit\"]",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#1c203d",
+               "contrastRatio": 4.46,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#7d8999",
+               "fontSize": "8.6pt (11.5px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.46 (foreground color: #7d8999, background color: #1c203d, font size: 8.6pt (11.5px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<span class=\"inline-flex items-center gap-1.5 rounded-pill px-[9px] py-[3px] font-bold text-[11.5px] tracking-[.01em]\" style=\"background: var(--chip-bg); color: var(--ink-muted); border: 1px solid var(--hairline);\">você</span>",
+                 "target": Array [
+                   "div:nth-child(1) > .\\[grid-template-columns\\:repeat\\(auto-fill\\,minmax\\(300px\\,1fr\\)\\)\\].gap-2\\.5.grid > .bg-surface.rounded-lg.overflow-hidden > .bg-surface-2.py-3.gap-2\\.5 > .gap-1\\.5.shrink-0.items-center > .rounded-pill.py-\\[3px\\].tracking-\\[\\.01em\\]",
+                 ],
+               },
+               Object {
+                 "html": "<div class=\"flex items-center gap-2.5 border-hairline border-b bg-surface-2 px-4 py-3\">",
+                 "target": Array [
+                   "div:nth-child(1) > .\\[grid-template-columns\\:repeat\\(auto-fill\\,minmax\\(300px\\,1fr\\)\\)\\].gap-2\\.5.grid > .bg-surface.rounded-lg.overflow-hidden > .bg-surface-2.py-3.gap-2\\.5",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.46 (foreground color: #7d8999, background color: #1c203d, font size: 8.6pt (11.5px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"inline-flex items-center gap-1.5 rounded-pill px-[9px] py-[3px] font-bold text-[11.5px] tracking-[.01em]\" style=\"background: var(--chip-bg); color: var(--ink-muted); border: 1px solid var(--hairline);\">você</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(1) > .\\[grid-template-columns\\:repeat\\(auto-fill\\,minmax\\(300px\\,1fr\\)\\)\\].gap-2\\.5.grid > .bg-surface.rounded-lg.overflow-hidden > .bg-surface-2.py-3.gap-2\\.5 > .gap-1\\.5.shrink-0.items-center > .rounded-pill.py-\\[3px\\].tracking-\\[\\.01em\\]",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#0c1029",
+               "contrastRatio": 3.62,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#6d6d70",
+               "fontSize": "9.4pt (12.5px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.62 (foreground color: #6d6d70, background color: #0c1029, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"overflow-hidden rounded-lg bg-surface\" style=\"border: 1px solid var(--hairline); opacity: 0.85;\">",
+                 "target": Array [
+                   "div:nth-child(1) > .\\[grid-template-columns\\:repeat\\(auto-fill\\,minmax\\(300px\\,1fr\\)\\)\\].gap-2\\.5.grid > .bg-surface.rounded-lg.overflow-hidden",
+                 ],
+               },
+               Object {
+                 "html": "<main data-slot=\"sidebar-inset\" class=\"bg-background relati...\">",
+                 "target": Array [
+                   "main",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.62 (foreground color: #6d6d70, background color: #0c1029, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<p class=\"whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-subtle\">Implementei server action createOKR com validação Zod e error handling</p>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(1) > .\\[grid-template-columns\\:repeat\\(auto-fill\\,minmax\\(300px\\,1fr\\)\\)\\].gap-2\\.5.grid > .bg-surface.rounded-lg.overflow-hidden > .px-4.py-1 > .py-2\\.5.border-hairline.border-b:nth-child(1) > .text-ink-subtle.whitespace-pre-wrap.leading-relaxed",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#0c1029",
+               "contrastRatio": 3.62,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#6d6d70",
+               "fontSize": "9.4pt (12.5px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.62 (foreground color: #6d6d70, background color: #0c1029, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"overflow-hidden rounded-lg bg-surface\" style=\"border: 1px solid var(--hairline); opacity: 0.85;\">",
+                 "target": Array [
+                   "div:nth-child(1) > .\\[grid-template-columns\\:repeat\\(auto-fill\\,minmax\\(300px\\,1fr\\)\\)\\].gap-2\\.5.grid > .bg-surface.rounded-lg.overflow-hidden",
+                 ],
+               },
+               Object {
+                 "html": "<main data-slot=\"sidebar-inset\" class=\"bg-background relati...\">",
+                 "target": Array [
+                   "main",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.62 (foreground color: #6d6d70, background color: #0c1029, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<p class=\"whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-subtle\">Vou construir OKRFormModal e integrar com server action</p>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(1) > .\\[grid-template-columns\\:repeat\\(auto-fill\\,minmax\\(300px\\,1fr\\)\\)\\].gap-2\\.5.grid > .bg-surface.rounded-lg.overflow-hidden > .px-4.py-1 > .py-2\\.5.border-hairline.border-b:nth-child(2) > .text-ink-subtle.whitespace-pre-wrap.leading-relaxed",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#1c203d",
+               "contrastRatio": 4.46,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#7d8999",
+               "fontSize": "8.6pt (11.5px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.46 (foreground color: #7d8999, background color: #1c203d, font size: 8.6pt (11.5px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<span class=\"inline-flex items-center gap-1.5 rounded-pill px-[9px] py-[3px] font-bold text-[11.5px] tracking-[.01em]\" style=\"background: var(--chip-bg); color: var(--ink-muted); border: 1px solid var(--hairline);\">você</span>",
+                 "target": Array [
+                   "div:nth-child(2) > .\\[grid-template-columns\\:repeat\\(auto-fill\\,minmax\\(300px\\,1fr\\)\\)\\].gap-2\\.5.grid > .bg-surface.rounded-lg.overflow-hidden > .bg-surface-2.py-3.gap-2\\.5 > .gap-1\\.5.shrink-0.items-center > .rounded-pill.py-\\[3px\\].tracking-\\[\\.01em\\]:nth-child(1)",
+                 ],
+               },
+               Object {
+                 "html": "<div class=\"flex items-center gap-2.5 border-hairline border-b bg-surface-2 px-4 py-3\">",
+                 "target": Array [
+                   "div:nth-child(2) > .\\[grid-template-columns\\:repeat\\(auto-fill\\,minmax\\(300px\\,1fr\\)\\)\\].gap-2\\.5.grid > .bg-surface.rounded-lg.overflow-hidden > .bg-surface-2.py-3.gap-2\\.5",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.46 (foreground color: #7d8999, background color: #1c203d, font size: 8.6pt (11.5px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"inline-flex items-center gap-1.5 rounded-pill px-[9px] py-[3px] font-bold text-[11.5px] tracking-[.01em]\" style=\"background: var(--chip-bg); color: var(--ink-muted); border: 1px solid var(--hairline);\">você</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(2) > .\\[grid-template-columns\\:repeat\\(auto-fill\\,minmax\\(300px\\,1fr\\)\\)\\].gap-2\\.5.grid > .bg-surface.rounded-lg.overflow-hidden > .bg-surface-2.py-3.gap-2\\.5 > .gap-1\\.5.shrink-0.items-center > .rounded-pill.py-\\[3px\\].tracking-\\[\\.01em\\]:nth-child(1)",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#0c1029",
+               "contrastRatio": 3.62,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#6d6d70",
+               "fontSize": "9.4pt (12.5px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.62 (foreground color: #6d6d70, background color: #0c1029, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"overflow-hidden rounded-lg bg-surface\" style=\"border: 1px solid rgba(var(--red-rgb),.4); opacity: 0.85;\">",
+                 "target": Array [
+                   "div:nth-child(2) > .\\[grid-template-columns\\:repeat\\(auto-fill\\,minmax\\(300px\\,1fr\\)\\)\\].gap-2\\.5.grid > .bg-surface.rounded-lg.overflow-hidden",
+                 ],
+               },
+               Object {
+                 "html": "<main data-slot=\"sidebar-inset\" class=\"bg-background relati...\">",
+                 "target": Array [
+                   "main",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.62 (foreground color: #6d6d70, background color: #0c1029, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<p class=\"whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-subtle\">Criei schema Zod para OKR e escrevi testes unitários</p>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(2) > .\\[grid-template-columns\\:repeat\\(auto-fill\\,minmax\\(300px\\,1fr\\)\\)\\].gap-2\\.5.grid > .bg-surface.rounded-lg.overflow-hidden > .px-4.py-1 > .py-2\\.5.border-hairline.border-b:nth-child(1) > .text-ink-subtle.whitespace-pre-wrap.leading-relaxed",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#0c1029",
+               "contrastRatio": 3.62,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#6d6d70",
+               "fontSize": "9.4pt (12.5px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.62 (foreground color: #6d6d70, background color: #0c1029, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"overflow-hidden rounded-lg bg-surface\" style=\"border: 1px solid rgba(var(--red-rgb),.4); opacity: 0.85;\">",
+                 "target": Array [
+                   "div:nth-child(2) > .\\[grid-template-columns\\:repeat\\(auto-fill\\,minmax\\(300px\\,1fr\\)\\)\\].gap-2\\.5.grid > .bg-surface.rounded-lg.overflow-hidden",
+                 ],
+               },
+               Object {
+                 "html": "<main data-slot=\"sidebar-inset\" class=\"bg-background relati...\">",
+                 "target": Array [
+                   "main",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.62 (foreground color: #6d6d70, background color: #0c1029, font size: 9.4pt (12.5px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<p class=\"whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-subtle\">Implementar server action e começar o modal</p>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div:nth-child(2) > .\\[grid-template-columns\\:repeat\\(auto-fill\\,minmax\\(300px\\,1fr\\)\\)\\].gap-2\\.5.grid > .bg-surface.rounded-lg.overflow-hidden > .px-4.py-1 > .py-2\\.5.border-hairline.border-b:nth-child(2) > .text-ink-subtle.whitespace-pre-wrap.leading-relaxed",
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
              - button "Toggle" [expanded] [ref=e69] [cursor=pointer]:
                - img [ref=e70]
                - generic [ref=e72]: Toggle
              - list [ref=e74]:
                - listitem [ref=e75]:
                  - link "Todos os Times" [ref=e76] [cursor=pointer]:
                    - /url: /teams
                    - generic [ref=e77]: Todos os Times
                - listitem [ref=e78]:
                  - list [ref=e79]:
                    - listitem [ref=e80]:
                      - link "Team Nebula" [ref=e81] [cursor=pointer]:
                        - /url: /teams/cmr8j4f5g0003icpx370whw3s
                        - generic [ref=e82]: Team Nebula
            - listitem [ref=e83]:
              - link "Analytics" [ref=e84] [cursor=pointer]:
                - /url: /analytics
                - img [ref=e85]
                - generic [ref=e87]: Analytics
              - button "Toggle" [ref=e88] [cursor=pointer]:
                - img [ref=e89]
                - generic [ref=e91]: Toggle
            - listitem [ref=e92]:
              - link "Workflows" [ref=e93] [cursor=pointer]:
                - /url: /workflows
                - img [ref=e94]
                - generic [ref=e98]: Workflows
              - button "Toggle" [ref=e99] [cursor=pointer]:
                - img [ref=e100]
                - generic [ref=e102]: Toggle
            - listitem [ref=e103]:
              - link "Large Solution" [ref=e104] [cursor=pointer]:
                - /url: /solution-trains
                - img [ref=e105]
                - generic [ref=e108]: Large Solution
              - button "Toggle" [ref=e109] [cursor=pointer]:
                - img [ref=e110]
                - generic [ref=e112]: Toggle
            - listitem [ref=e113]:
              - link "Integrações" [ref=e114] [cursor=pointer]:
                - /url: /integrations
                - img [ref=e115]
                - generic [ref=e121]: Integrações
              - button "Toggle" [ref=e122] [cursor=pointer]:
                - img [ref=e123]
                - generic [ref=e125]: Toggle
            - listitem [ref=e126]:
              - link "Settings" [ref=e127] [cursor=pointer]:
                - /url: /settings/workspace
                - img [ref=e128]
                - generic [ref=e131]: Settings
              - button "Toggle" [ref=e132] [cursor=pointer]:
                - img [ref=e133]
                - generic [ref=e135]: Toggle
        - list [ref=e138]:
          - listitem [ref=e139]:
            - link "Webhooks" [ref=e140] [cursor=pointer]:
              - /url: /webhooks
              - img [ref=e141]
              - generic [ref=e144]: Webhooks
          - listitem [ref=e145]:
            - link "Notificações" [ref=e146] [cursor=pointer]:
              - /url: /notifications
              - img [ref=e147]
              - generic [ref=e150]: Notificações
          - listitem [ref=e151]:
            - link "Exceções de Acesso" [ref=e152] [cursor=pointer]:
              - /url: /access-exceptions
              - img [ref=e153]
              - generic [ref=e155]: Exceções de Acesso
          - listitem [ref=e156]:
            - link "Perfil" [ref=e157] [cursor=pointer]:
              - /url: /profile
              - img [ref=e158]
              - generic [ref=e163]: Perfil
          - listitem [ref=e164]:
            - link "Suporte" [ref=e165] [cursor=pointer]:
              - /url: https://docs.cosmos.app
              - img [ref=e166]
              - generic [ref=e173]: Suporte
          - listitem [ref=e174]:
            - link "Feedback" [ref=e175] [cursor=pointer]:
              - /url: /feedback
              - img [ref=e176]
              - generic [ref=e179]: Feedback
      - list [ref=e181]:
        - listitem [ref=e182]:
          - button "Copilot ⌘K" [ref=e183] [cursor=pointer]:
            - img
            - text: Copilot ⌘K
          - link "Copilot fullscreen" [ref=e184] [cursor=pointer]:
            - /url: /copilot
            - img
        - listitem [ref=e185]:
          - button "AD Admin E2E admin@cosmos.local" [ref=e186] [cursor=pointer]:
            - generic [ref=e187]: AD
            - generic [ref=e188]:
              - generic [ref=e189]: Admin E2E
              - generic [ref=e190]: admin@cosmos.local
            - img [ref=e191]
          - generic [ref=e194]:
            - button "Toggle theme" [ref=e195] [cursor=pointer]:
              - img
              - img
              - generic [ref=e196]: Toggle theme
            - generic [ref=e197]:
              - button "Open notification feed" [ref=e198] [cursor=pointer]:
                - img
              - option "All" [selected]
              - option "Unread"
              - option "Read"
    - main [ref=e199]:
      - generic [ref=e200]:
        - heading "Command Palette" [level=2] [ref=e201]
        - paragraph [ref=e202]: Search for a command to run...
      - generic [ref=e203]:
        - generic [ref=e204]:
          - generic [ref=e205]: C
          - generic [ref=e206]: COSMOSSAFe
        - img [ref=e207]
        - navigation "Breadcrumb" [ref=e209]:
          - generic [ref=e210]:
            - generic [ref=e211] [cursor=pointer]: COSMOS Dev
            - img [ref=e212]
          - generic [ref=e214]:
            - generic [ref=e215] [cursor=pointer]: Teams
            - img [ref=e216]
          - generic [ref=e218]:
            - generic [ref=e219] [cursor=pointer]: Cmr8j4f5g0003icpx370whw3s
            - img [ref=e220]
          - generic [ref=e223] [cursor=pointer]: Standup
        - generic [ref=e224]:
          - group "Trocar persona" [ref=e225]:
            - button "RTE" [ref=e226] [cursor=pointer]: RTE
            - button "LPM" [pressed] [ref=e228] [cursor=pointer]: LPM
            - button "PO" [ref=e230] [cursor=pointer]: PO
            - button "SM" [ref=e232] [cursor=pointer]: SM
            - button "DEV" [ref=e234] [cursor=pointer]: DEV
          - button "Buscar" [ref=e236] [cursor=pointer]:
            - img [ref=e237]
          - generic "Admin E2E · admin@cosmos.local" [ref=e240]: AE
      - generic [ref=e241]:
        - generic [ref=e242]:
          - navigation "Navegação" [ref=e243]:
            - link "Times" [ref=e245] [cursor=pointer]:
              - /url: /teams
            - generic [ref=e246]:
              - img [ref=e247]
              - link "Team Nebula" [ref=e249] [cursor=pointer]:
                - /url: /teams/cmr8j4f5g0003icpx370whw3s
            - generic [ref=e250]:
              - img [ref=e251]
              - generic [ref=e253]: Standup
          - generic [ref=e254]:
            - generic [ref=e255]:
              - generic [ref=e257]: sem bloqueios
              - heading "Daily Standup" [level=1] [ref=e258]
              - paragraph [ref=e259]: "Sprint goal: Entregar temas estratégicos, épicos e OKRs funcionais"
            - generic [ref=e261]:
              - link "Todos os times" [ref=e262] [cursor=pointer]:
                - /url: /teams
                - img
                - text: Todos os times
              - link "Preencher" [ref=e263] [cursor=pointer]:
                - /url: "#meu-standup"
                - img
                - text: Preencher
        - generic [ref=e265]:
          - generic [ref=e266]:
            - generic [ref=e267]:
              - img
              - img
              - img
              - generic [ref=e268]:
                - generic [ref=e269]: Membros
                - img [ref=e271]
              - generic [ref=e273]: "5"
              - generic [ref=e274]: — No time
            - generic [ref=e275]:
              - img
              - img
              - img
              - generic [ref=e276]:
                - generic [ref=e277]: Velocity
                - img [ref=e279]
              - generic [ref=e281]: 40SP
              - generic [ref=e282]: — Sprint atual
            - generic [ref=e283]:
              - img
              - img
              - img
              - generic [ref=e284]:
                - generic [ref=e285]: Flow load (WIP)
                - img [ref=e287]
              - generic [ref=e289]: "0"
              - generic [ref=e290]: — Saudável
            - generic [ref=e291]:
              - img
              - img
              - img
              - generic [ref=e292]:
                - generic [ref=e293]: Bloqueios
                - img [ref=e295]
              - generic [ref=e297]: "0"
              - generic [ref=e298]: ↗ Nenhum
          - generic [ref=e300]:
            - generic [ref=e302]:
              - generic [ref=e304]: Meu Standup de Hoje
              - img [ref=e306]
            - generic [ref=e310]:
              - generic [ref=e311]:
                - generic [ref=e312]: O que fiz ontem?
                - textbox "O que fiz ontem?" [ref=e313]:
                  - /placeholder: Descreva o que você fez…
              - generic [ref=e314]:
                - generic [ref=e315]: O que farei hoje?
                - textbox "O que farei hoje?" [ref=e316]:
                  - /placeholder: Descreva o que você planeja fazer…
              - generic [ref=e317]:
                - generic [ref=e318]: Há bloqueios?
                - textbox "Há bloqueios?" [ref=e319]:
                  - /placeholder: Nenhum / Descreva os bloqueios…
              - button "Enviar" [ref=e321] [cursor=pointer]:
                - img
                - text: Enviar
          - generic [ref=e322]:
            - heading "Time hoje (0 entradas)" [level=2] [ref=e323]
            - generic [ref=e324]:
              - img [ref=e325]
              - paragraph [ref=e328]: Nenhum membro fez standup hoje ainda.
              - link "Preencher meu standup" [ref=e329] [cursor=pointer]:
                - /url: "#meu-standup"
          - generic [ref=e330]:
            - heading "Histórico recente" [level=2] [ref=e331]:
              - img [ref=e332]
              - text: Histórico recente
            - generic [ref=e334]:
              - generic [ref=e335]:
                - paragraph [ref=e336]: domingo, 05 de julho
                - generic [ref=e338]:
                  - generic [ref=e339]:
                    - generic [ref=e340]: V
                    - generic [ref=e341]: Você
                    - generic [ref=e343]: você
                  - generic [ref=e344]:
                    - generic [ref=e345]:
                      - generic [ref=e346]:
                        - img [ref=e347]
                        - text: Ontem
                      - paragraph [ref=e349]: Implementei server action createOKR com validação Zod e error handling
                    - generic [ref=e350]:
                      - generic [ref=e351]:
                        - img [ref=e352]
                        - text: Hoje
                      - paragraph [ref=e354]: Vou construir OKRFormModal e integrar com server action
                    - generic [ref=e355]:
                      - generic [ref=e356]:
                        - img [ref=e357]
                        - text: Bloqueios
                      - paragraph [ref=e359]: Nenhum
              - generic [ref=e360]:
                - paragraph [ref=e361]: sábado, 04 de julho
                - generic [ref=e363]:
                  - generic [ref=e364]:
                    - generic [ref=e365]: V
                    - generic [ref=e366]: Você
                    - generic [ref=e367]:
                      - generic [ref=e368]: você
                      - generic [ref=e370]:
                        - img [ref=e371]
                        - text: Bloqueio
                  - generic [ref=e373]:
                    - generic [ref=e374]:
                      - generic [ref=e375]:
                        - img [ref=e376]
                        - text: Ontem
                      - paragraph [ref=e378]: Criei schema Zod para OKR e escrevi testes unitários
                    - generic [ref=e379]:
                      - generic [ref=e380]:
                        - img [ref=e381]
                        - text: Hoje
                      - paragraph [ref=e383]: Implementar server action e começar o modal
                    - generic [ref=e384]:
                      - generic [ref=e385]:
                        - img [ref=e386]
                        - text: Bloqueios
                      - paragraph [ref=e388]: Aguardando design final do modal — desbloqueado pelo PO
    - button "Abrir Copilot AI" [ref=e391] [cursor=pointer]:
      - img [ref=e392]
  - region "Notifications alt+T"
  - generic [ref=e401] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e402]:
      - img [ref=e403]
    - generic [ref=e406]:
      - button "Open issues overlay" [ref=e407]:
        - generic [ref=e408]:
          - generic [ref=e409]: "1"
          - generic [ref=e410]: "2"
        - generic [ref=e411]:
          - text: Issue
          - generic [ref=e412]: s
      - button "Collapse issues badge" [ref=e413]:
        - img [ref=e414]
  - alert [ref=e416]
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
      |     ^ Error: [/teams/[teamId]/standup] Critical/serious violations: [
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