# COSMOS — Interface Design Document

**Base Design System:** Linear (via `getdesign.md/linear.app/design-md`)  
**Install command:** `npx getdesign@latest add linear.app` → `DESIGN.md` at repo root  
**Date:** 2026-05-11  
**Status:** Active — reference before writing any UI component

---

## 1. Design Foundation

COSMOS inherits the Linear design language: ultra-minimal, dark-first, data-dense, precision-driven.
A SAFe enterprise platform demands the same properties — high information density, clear hierarchy,
zero decorative noise.

### Base Rules from Linear DESIGN.md

- **Dark-only UI** — no light mode for the app shell
- **Surface ladder for depth** — no drop shadows; lift = surface-1/2/3 backgrounds
- **Lavender-blue accent** (`{colors.primary}`) — used only for primary CTAs and active states
- **4px spacing grid** — all spacing tokens are multiples of 4
- **Inter / Geist Sans** — weight 500/600/700 for headings; 400 for body
- **Hairline borders** (`{colors.hairline}`) — separators, card edges
- **No atmospheric gradients** — the dark canvas IS the whitespace

---

## 2. Color Palette (COSMOS Extension of Linear Tokens)

### Inherited from Linear

| Token | Value | Use |
|-------|-------|-----|
| `{colors.canvas}` | ~#0f0f10 | App background (near-black, not pure black) |
| `{colors.surface-1}` | ~#1a1a1e | Cards, panels, sidebar |
| `{colors.surface-2}` | ~#222228 | Hovered cards, featured items, modals |
| `{colors.surface-3}` | ~#2a2a32 | Dropdowns, sub-nav, tooltips |
| `{colors.primary}` | Lavender-Blue | Active nav item, primary button, links |
| `{colors.primary-hover}` | #828fff | Button hover |
| `{colors.primary-focus}` | #5e69d1 | Focus rings |
| `{colors.ink}` | ~#e2e2e4 | Primary text |
| `{colors.ink-subtle}` | ~#8b8b94 | Secondary text, meta |
| `{colors.ink-tertiary}` | ~#555560 | Disabled, placeholder |
| `{colors.hairline}` | ~#2a2a32 | Card borders |
| `{colors.hairline-strong}` | ~#3a3a46 | Active/hovered borders |

### COSMOS-Specific Semantic Colors (SAFe priority/status tags)

| Token | Value | Use |
|-------|-------|-----|
| `{colors.safe-epic}` | #7c6af7 | Epic badge (lavender — inherits primary) |
| `{colors.safe-feature}` | #4f8ef7 | Feature badge (blue) |
| `{colors.safe-story}` | #3db87a | Story/task badge (green) |
| `{colors.safe-risk-r}` | #ef4444 | ROAM — Resolved risk |
| `{colors.safe-risk-o}` | #f97316 | ROAM — Owned risk |
| `{colors.safe-risk-a}` | #eab308 | ROAM — Accepted risk |
| `{colors.safe-risk-m}` | #6b7280 | ROAM — Mitigated risk |
| `{colors.pi-active}` | #4f8ef7 | Active PI indicator |
| `{colors.pi-planning}` | #a855f7 | PI in planning state |
| `{colors.wsjf-high}` | #ef4444 | WSJF score high urgency |
| `{colors.wsjf-medium}` | #f97316 | WSJF score medium |
| `{colors.wsjf-low}` | #6b7280 | WSJF score low |
| `{colors.tenant-badge}` | #5e69d1 | Tenant/org identifier badge |

---

## 3. Typography

| Token | Size | Weight | Use in COSMOS |
|-------|------|--------|---------------|
| `{typography.display-lg}` | 56px/600 | Hero pages only (landing/onboarding) |
| `{typography.display-md}` | 40px/600 | Page titles (Portfolio, PI Planning) |
| `{typography.headline}` | 28px/600 | Section headers, modal titles |
| `{typography.card-title}` | 22px/500 | Card/panel headings (ART name, Epic title) |
| `{typography.subhead}` | 20px/400 | Sidebar section labels |
| `{typography.body-lg}` | 18px/400 | Lead text in dashboards |
| `{typography.body}` | 16px/400 | Default — descriptions, form labels |
| `{typography.body-sm}` | 14px/400 | Table rows, list items, card body |
| `{typography.caption}` | 12px/400 | Status badges, timestamps, meta |
| `{typography.eyebrow}` | 13px/500 | Section labels (PORTFOLIO, ART, TEAM) |
| `{typography.mono}` | 13px/400 | IDs, ticket numbers (EPIC-001, ART-03) |

**Font:** Inter (primary) — Geist Sans acceptable. JetBrains Mono or Geist Mono for ticket IDs.

---

## 4. App Shell Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ TOP BAR (56px, {colors.surface-1}, sticky)                      │
│  [COSMOS logo]  [Tenant Switcher ▼]          [Notifs] [Avatar]  │
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                  │
│  SIDEBAR     │  MAIN CONTENT AREA                               │
│  (240px)     │  (flex-1, overflow-y auto)                       │
│              │                                                  │
│  [Nav items] │  [Page header]                                   │
│              │  [Content]                                        │
│              │                                                  │
└──────────────┴──────────────────────────────────────────────────┘
```

### Top Bar
- Height: 56px — `{colors.surface-1}` background, `{colors.hairline}` bottom border
- Left: COSMOS wordmark + tenant switcher pill (`{colors.surface-2}` background, `{rounded.md}`)
- Right: notification bell + user avatar (32px circle, `{rounded.full}`)
- Tenant switcher shows org name + chevron — opens dropdown overlay on `{colors.surface-3}`

### Sidebar (240px fixed, collapsible to 48px icon rail)
- Background: `{colors.surface-1}`
- Right border: 1px `{colors.hairline}`
- Nav items: 36px height, 12px horizontal padding, `{typography.body-sm}`
- Active item: `{colors.primary}` text + `{colors.surface-2}` background + left 2px `{colors.primary}` bar
- Hover: `{colors.surface-2}` background
- Section labels: `{typography.eyebrow}` + `{colors.ink-tertiary}`
- Collapse toggle: chevron icon at sidebar bottom

### Sidebar Navigation Structure
```
─ OVERVIEW
  ● Dashboard

─ PORTFOLIO
  ◆ Portfolio Kanban
  ◆ Epics
  ◆ OKRs

─ RELEASE TRAINS
  ◆ ARTs
  ◆ PI Planning
  ◆ Program Board

─ TEAMS
  ◆ Teams
  ◆ Sprint Board
  ◆ Backlog
  ◆ Ceremonies

─ DELIVERY
  ◆ Features
  ◆ Stories
  ◆ Risks (ROAM)

─ INSIGHTS
  ◆ Analytics
  ◆ Flow Metrics
  ◆ Reports

─ SETTINGS
  ◆ Integrations
  ◆ Members
  ◆ Roles & Permissions
  ◆ Tenant Settings
```

### Main Content Area
- Background: `{colors.canvas}`
- Page header: 64px, contains page title (`{typography.display-md}`) + action buttons
- Padding: 24px (`{spacing.lg}`) horizontal, 32px (`{spacing.xl}`) top
- Max content width: 1280px centered

---

## 5. Key Page Layouts

### 5.1 Dashboard (Home)

```
┌─ Page Header ─────────────────────────────────────────────┐
│ Dashboard                          [PI: Q2 2026 — Week 6] │
└───────────────────────────────────────────────────────────┘

┌─ Metric Strip (4 cards) ──────────────────────────────────┐
│  [Active Epics: 3] [PI Progress: 68%] [ARTs: 2] [Risks: 5]│
└───────────────────────────────────────────────────────────┘

┌─ Left (66%) ──────────────────┐ ┌─ Right (34%) ──────────┐
│  PI Burndown Chart            │ │  Active Risks (ROAM)   │
│  (line chart, 8-week sprint)  │ │  WSJF Top 5 Items      │
│                               │ │                        │
│  ART Velocity Table           │ └────────────────────────┘
│  (ART name / velocity / trend)│ ┌─ Right ────────────────┐
└───────────────────────────────┘ │  Recent Activity Feed  │
                                  │  (last 10 events)      │
                                  └────────────────────────┘
```

Metric strip cards: `{colors.surface-1}`, `{rounded.lg}`, 24px padding.
Charts: Recharts — stroke `{colors.primary}`, grid lines `{colors.hairline}`.

---

### 5.2 Portfolio Kanban

Horizontal kanban with SAFe Portfolio Kanban columns:

```
[Funnel] → [Reviewing] → [Analyzing] → [Portfolio Backlog] → [Implementing] → [Done]
```

Each column:
- Header: `{typography.eyebrow}` label + item count badge
- Cards: `{colors.surface-1}`, `{rounded.lg}`, 16px padding, draggable
- Card anatomy: Epic ID (`{typography.mono}`) + title + WSJF score badge + owner avatar
- Column width: 240px min-width, horizontal scroll on overflow

---

### 5.3 PI Planning (Program Board)

Grid view: iterations (columns) × teams (rows).

```
            │ Iteration 1 │ Iteration 2 │ Iteration 3 │ Iteration 4 │ IP Iter │
────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────┤
Team Alpha  │ [Feature A] │ [Feature B] │             │ [Feature C] │         │
Team Beta   │             │ [Feature D] │ [Feature E] │ [Feature E] │         │
Team Gamma  │ [Feature F] │             │ [Feature G] │             │         │
```

- Dependency arrows: SVG lines between features, `{colors.safe-risk-o}` for cross-team deps
- Feature cards: mini (120×60px), `{colors.surface-2}`, `{rounded.sm}`
- Risks: red diamond overlay on feature card corner

---

### 5.4 ART Board (Feature Kanban)

Kanban board scoped to one ART:
```
[Backlog] → [In Analysis] → [In Development] → [In Review] → [Done]
```

Feature cards (larger than Portfolio): 240px wide, show assigned team + story point estimate.

---

### 5.5 Sprint Board (Team Level)

Classic Kanban: `[Backlog] → [To Do] → [In Progress] → [Review] → [Done]`

Story cards: `{colors.surface-1}`, show story ID, title, assignee avatar, story points pill.
Story points pill: `{colors.surface-3}`, `{rounded.pill}`, `{typography.caption}`.

---

### 5.6 Analytics

```
┌─ Page Header ─────────────────────────────────────────────────────────────┐
│ Analytics                                   [Date Range ▼] [Export ▼]     │
└───────────────────────────────────────────────────────────────────────────┘

┌─ Tab Bar ─────────────────────────────────────────────────────────────────┐
│ [Flow Metrics] [Quality] [Outcomes] [OKRs] [Predictive]                   │
└───────────────────────────────────────────────────────────────────────────┘

(Flow Metrics tab content)
┌─ Left (50%) ──────────────────────────┐ ┌─ Right (50%) ────────────────────┐
│  Cycle Time Distribution              │ │  Throughput Trend                │
│  (bar chart)                          │ │  (line chart)                    │
└───────────────────────────────────────┘ └──────────────────────────────────┘
┌─ Full Width ──────────────────────────────────────────────────────────────┐
│  Cumulative Flow Diagram                                                   │
└───────────────────────────────────────────────────────────────────────────┘
```

---

### 5.7 Epic / Feature Detail (Slide-over panel)

Opens from any board as a right-side panel (600px wide), not a full page navigation:

```
┌────────── Slide-over (600px, {colors.surface-1}) ───────────────┐
│ ✕  EPIC-003 · Portfolio Management                              │
├─────────────────────────────────────────────────────────────────┤
│ [Status pill] [Priority badge] [Owner avatar] [WSJF: 14.2]      │
│                                                                  │
│ Description                                                      │
│ ─────────────────────────────────────────────────────           │
│ [Rich text content]                                              │
│                                                                  │
│ Acceptance Criteria                                              │
│ ─────────────────────────────────────────────────────           │
│ ☑ criterion 1   ☐ criterion 2   ☐ criterion 3                   │
│                                                                  │
│ Child Features (3)                                               │
│ ─────────────────────────────────────────────────────           │
│ [Feature list rows with status]                                  │
│                                                                  │
│ ROAM Risks (1)                                                   │
│ [Risk row: O — Data migration risk — John]                       │
│                                                                  │
│ Activity                                                         │
│ [Comment feed + add comment input]                               │
└─────────────────────────────────────────────────────────────────┘
```

Slide-over background: `{colors.surface-1}`, left border: 1px `{colors.hairline-strong}`.
Overlay scrim: `{colors.semantic-overlay}` at 40% opacity.

---

## 6. Components Reference

### Status Pills (SAFe lifecycle states)
```
[● Funnel]  [● Reviewing]  [● Analyzing]  [● Implementing]  [● Done]
```
- Shape: `{rounded.pill}`, padding 4px 10px, `{typography.caption}`
- Colors: mapped to COSMOS semantic tokens per state
- Dot: 6px circle, same color as label

### WSJF Badge
```
[WSJF 14.2]
```
- `{colors.surface-3}` background, `{colors.ink-subtle}` text
- `{rounded.xs}`, `{typography.caption}`, weight 500

### Ticket ID (mono)
```
EPIC-003  ART-02  FEAT-0014  STR-0089
```
- `{typography.mono}`, `{colors.ink-tertiary}`

### Assignee Stack (multiple avatars)
- 24px circles, -6px overlap, `{rounded.full}`
- Max 3 shown + count overflow badge

### Priority Flag
- Icon + label: Critical / High / Medium / Low
- Icon color maps to WSJF tokens

### Integration Status Badge
- Connected: green dot + "Connected" — `{colors.safe-story}`
- Error: red dot + "Error" — `{colors.safe-risk-r}`
- Not configured: gray dot — `{colors.ink-tertiary}`

---

## 7. Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| ≥1280px | Full layout — sidebar 240px, content full width |
| 1024–1279px | Sidebar 200px, content adapts |
| 768–1023px | Sidebar collapses to 48px icon rail by default |
| <768px | Sidebar hidden, accessible via hamburger menu |

Kanban boards scroll horizontally on mobile — columns do not stack.
Program Board (PI Planning) requires ≥1024px — show locked message on smaller screens.

---

## 8. Motion & Interaction

- **Slide-over**: 250ms ease-out from right (`transform: translateX`)
- **Kanban drag**: 150ms scale(1.02) lift on grab, drop snap 100ms
- **Tab transitions**: 150ms fade-opacity crossfade
- **Sidebar collapse**: 200ms width transition
- **No bounce, no spring** — enterprise precision, not consumer playfulness

---

## 9. Usage Instructions for AI Agents

Before writing any UI component:
1. Read `DESIGN.md` at repo root (Linear base system, color tokens, component specs)
2. Read this file for COSMOS-specific layouts, semantic colors, and page structures
3. Use shadcn/ui as component primitives — override tokens via Tailwind CSS variables
4. Match Tailwind config CSS variables to the Linear token names above
5. Do not introduce new colors, gradients, or fonts not listed here
6. Reference the nearest section layout diagram before building a page

---

## 10. Figma / Storybook (Future)

- Storybook exists in `cosmos/.storybook/` — migrate to cosmos-nebuloz packages/ui
- Design tokens → CSS custom properties in `packages/design-system/src/tokens.css`
- Component stories per section above
