# Story 031 — Strategy Map, Traceability & Roadmap Scenarios

**Epic:** 007 — Solution Train & Advanced Features
**Feature:** F-007-011 Strategic Alignment
**WSJF:** 6.5 (userValue=6, timeValue=4, riskReduction=4, jobSize=2)
**Story Points:** 8
**Priority:** Should Have
**Status:** DEFINED

---

## User Story

**As a** Portfolio Manager,
**I want** a visual Strategy Map DAG, bottom-up traceability from any story to its strategic theme, and scenario-based roadmap planning,
**so that** I can show executives the linkage between delivery and strategy and model different PI plans without committing to them.

---

## Acceptance Criteria

### AC-001: Strategy Map DAG renders within 4s
Given an ART with 2 themes, 3 OKRs, 6 epics, 14 features,
When the Strategy Map opens,
Then:
- A layered DAG (Theme → OKR → Epic → Feature) renders within 4s
- Node size encodes WSJF (larger = higher WSJF)
- Node color matches strategic theme color
- Orphan/disconnected nodes appear in a "Misaligned" sidebar

### AC-002: Bottom-up traceability "Why does this matter?"
Given a story → feature → epic → theme → OKR chain (depth 5),
When a developer clicks "Why does this matter?" on the story detail,
Then:
- A breadcrumb panel shows all 5 levels with titles and statuses
- Each level is a deep link to its entity detail
- Broken links (e.g., epic with no theme) show a "Alignment gap" icon at the break point

### AC-003: Roadmap scenario deep-copy
Given a base roadmap of 8 items,
When the PM creates a scenario "Aggressive Q3",
Then:
- A deep-copy of all 8 items is created tagged with `scenarioName="Aggressive Q3"`
- The original base roadmap is unchanged
- The scenario appears in the "Scenarios" tab with an edit indicator

### AC-004: Scenario diff comparison
Given a base roadmap with 8 items and a scenario "Aggressive Q3" with 2 items removed and 1 added,
When "Compare Scenarios" is triggered,
Then:
- 2 items are shown with a red "Removed in scenario" tag
- 1 item is shown with a green "Added in scenario" tag
- 5 unchanged items are shown with a grey "No change" tag

### AC-005: Scenario promote-to-base
Given a scenario "Aggressive Q3" has been approved by the BO,
When the PM promotes it to base,
Then:
- The current base items are archived (`archived=true`, `archivedAt=<timestamp>`)
- The scenario's items become the new base (scenario tag removed)
- Prior base is accessible via "Roadmap History" rollback (90-day archive)

### AC-006: Capacity warning on roadmap drop
Given Team Alpha's velocity is 40 points/sprint and current Q3 roadmap shows 55 points/sprint (>120% threshold),
When the capacity warning check runs,
Then:
- A MEDIUM capacity warning appears on the Q3 column: "55 pts planned vs 40 pts avg velocity (137%)"
- Drag is not blocked — warning only

### AC-007: Alignment gap alert — unlinked epic
Given an IMPLEMENTING epic with `strategicThemeId=null`,
When the daily alignment gap scan runs,
Then:
- An `AlignmentGapAlert` of type `UNLINKED_EPIC`, severity HIGH is created
- A banner appears on the epic detail: "This epic is not linked to a strategic theme"
- Auto-resolves when a theme is assigned (within 60s of assignment)

### AC-008: Strategy Map PNG/SVG/PDF export
Given a Portfolio Manager wants to export the Strategy Map for a board presentation,
When "Export" is clicked with format=PDF,
Then:
- A server-side PDF is generated with the DAG visualization + AI narrative summary
- PDF is available for download within 30s
- The AI summary is omitted gracefully if AI is unavailable

---

## Technical Notes

### RoadmapItem Scenario Model

```prisma
model RoadmapItem {
  id              String   @id @default(cuid())
  orgId           String
  epicId          String
  artId           String?
  quarter         Int
  year            Int
  confidence      Int      @default(50)  // 0-100
  notes           String?
  active          Boolean  @default(true)
  archived        Boolean  @default(false)
  archivedAt      DateTime?
  scenarioName    String?  // null = base roadmap
  createdBy       String
  @@index([orgId, artId, year, quarter])
  @@index([orgId, scenarioName])
}
```

### AlignmentGapAlert Model

```prisma
model AlignmentGapAlert {
  id              String   @id @default(cuid())
  orgId           String
  artId           String?
  type            String
  severity        String
  entityType      String
  entityId        String
  message         String
  status          String   @default("OPEN")
  dismissalReason String?
  detectedAt      DateTime @default(now())
  resolvedAt      DateTime?
  @@index([orgId, artId, status])
  @@unique([orgId, type, entityId], { where: "status = 'OPEN'" }) // one open per entity
}
```

### Auto-Resolve Trigger

```typescript
// When an epic's strategicThemeId is updated, check for open UNLINKED_EPIC alert
prisma.$use(async (params, next) => {
  const result = await next(params)
  if (params.model === 'Epic' && params.action === 'update' && params.args.data.strategicThemeId) {
    // Auto-resolve open UNLINKED_EPIC alert for this epic
    await prisma.alignmentGapAlert.updateMany({
      where: { entityId: params.args.where.id, type: 'UNLINKED_EPIC', status: 'OPEN' },
      data: { status: 'AUTO_RESOLVED', resolvedAt: new Date() }
    })
  }
  return result
})
```

---

## Dependencies

- Epic 006 Story-025 (StrategicTheme model)
- Epic 007 Story-027 (OKR model)
- Epic 006 Story-014/015 (Epic/Feature for DAG nodes)
- `AlignmentGapAlert` model
- `RoadmapItem` with scenario support
- `@repo/ai` for narrative summary in export

---

## Definition of Done

- [ ] Strategy Map DAG: Theme → OKR → Epic → Feature, renders < 4s
- [ ] Node sizing by WSJF, coloring by theme, orphan sidebar
- [ ] Bottom-up "Why does this matter?" breadcrumb with gap icons
- [ ] Roadmap scenario deep-copy + diff comparison
- [ ] Scenario promote-to-base with archive + 90-day rollback
- [ ] Capacity warning at > 120% velocity (MEDIUM, non-blocking)
- [ ] `AlignmentGapAlert`: UNLINKED_EPIC, OKR_AT_RISK detection + auto-resolve
- [ ] Strategy Map export (PNG/SVG/PDF with AI narrative, graceful AI fallback)
- [ ] Max 5 scenarios per ART per year (422 on exceed)
- [ ] Unit tests: DAG construction, scenario diff, auto-resolve, alert dedup
