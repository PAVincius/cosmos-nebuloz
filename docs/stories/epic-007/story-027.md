# Story 027 — OKR Management & Key Result Snapshots

**Epic:** 007 — Solution Train & Advanced Features
**Feature:** F-007-007 OKR & Strategy Alignment
**WSJF:** 7.0 (userValue=6, timeValue=5, riskReduction=4, jobSize=2)
**Story Points:** 5
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As an** RTE,
**I want** to create and track OKRs with automatic key result progress snapshots, threshold notifications, and strategy-to-execution traceability,
**so that** strategic objectives are connected to PI delivery and progress is visible without manual reporting.

---

## Acceptance Criteria

### AC-001: Valid OKR creation persists
Given an RTE submits a valid OKR (objective text, ≥1 KR with target+unit, quarter/year, ART assignment),
When saved,
Then:
- OKR persists with `status=ACTIVE`
- Appears in the ART OKR list within 2s
- If quarterly count exceeds 10 for this ART, save is blocked: "Maximum 10 OKRs per ART per quarter"

### AC-002: PO cannot create ART-level OKR
Given a PO (not RTE) submits an ART-level OKR,
When the action is processed,
Then:
- HTTP 403 `{code: "INSUFFICIENT_ROLE", message: "Creating ART-level OKRs requires RTE role or above"}`

### AC-003: 75% threshold notification fires
Given a KR at 74% progress,
When it is updated to 76%,
Then:
- A threshold notification dispatches to RTE + Business Owner within 5s
- Notification: "OKR Key Result '{title}' has reached 75%"
- Deduplication: if the KR already crossed 75% and notification was sent, no duplicate fires

### AC-004: Automated snapshot from GitHub webhook metric rule
Given a metric rule maps `deployment_frequency` from GitHub to a KR with unit `deploys/day`,
When a GitHub deployment webhook fires and increments the metric,
Then:
- A `KeyResultSnapshot` is created with `source=AUTOMATED`, `value=<computed>`, `recordedAt=now()`
- The KR's current value updates without manual entry
- `SyncLog` records the automated update

### AC-005: Quarter-close auto-archive with final achievement
Given a quarter ends for an ART's OKR set,
When the quarter-close cron fires,
Then:
- All OKRs for that quarter are archived: `status=ARCHIVED`, `finalAchievement=<final KR values>`
- New OKRs for the quarter are no longer accepted for the closed quarter
- Historical OKRs remain queryable via the "Past Quarters" filter

### AC-006: KR trend chart + "At Risk" badge
Given a KR with target 100 and current value 30 with 10 days remaining in the quarter (project: 30/remaining_days × remaining_days = 30),
When the KR trend renders,
Then:
- A linear projection line shows the KR will not reach 100
- An "At Risk" badge appears if projected completion < 85% of target
- The trend chart shows historical snapshots with source (MANUAL vs AUTOMATED) distinguished by dot style

### AC-007: OKR to Epic strategy traceability
Given an OKR is linked to a strategic theme, and an epic is linked to the same theme,
When the Strategy Map renders,
Then:
- A Theme → OKR → Epic chain is visible in the DAG
- The epic's delivery status (% complete) is shown in the traceability chain
- Clicking the chain shows the "Why does this matter?" breadcrumb for any story

### AC-008: Maximum 5 key results per OKR
Given an OKR already has 5 key results,
When a 6th is added,
Then:
- HTTP 422 `{code: "MAX_KEY_RESULTS_EXCEEDED", max: 5}`
- No 6th KR is created

---

## Technical Notes

### OKR & KeyResult Schema (extend existing)

```prisma
model OKR {
  id            String   @id @default(cuid())
  orgId         String
  artId         String
  teamId        String?
  title         String
  quarter       Int      // 1-4
  year          Int
  status        String   @default("ACTIVE") // ACTIVE|ARCHIVED
  finalAchievement Json?
  strategicThemeId String?
  createdBy     String
  createdAt     DateTime @default(now())
  keyResults    KeyResult[]
  @@index([orgId, artId, year, quarter])
}

model KeyResult {
  id            String   @id @default(cuid())
  orgId         String
  okrId         String
  title         String
  unit          String   // %, count, $, ratio, custom
  startValue    Float    @default(0)
  targetValue   Float
  currentValue  Float    @default(0)
  confidence    String   @default("ON_TRACK") // ON_TRACK|AT_RISK|ACHIEVED
  metricRuleId  String?  // for automated snapshots
  okr           OKR      @relation(fields: [okrId], references: [id])
  snapshots     KeyResultSnapshot[]
  @@index([orgId, okrId])
}

model KeyResultSnapshot {
  id           String   @id @default(cuid())
  orgId        String
  keyResultId  String
  value        Float
  recordedAt   DateTime @default(now())
  recordedBy   String?
  source       String   @default("MANUAL") // MANUAL|AUTOMATED
  note         String?
  keyResult    KeyResult @relation(fields: [keyResultId], references: [id])
  @@unique([keyResultId, recordedAt, source]) // dedup for manual same-day
  @@index([orgId, keyResultId, recordedAt])
}
```

### Threshold Notification Logic

```typescript
const KR_THRESHOLDS = [25, 50, 75, 100]

const checkThresholds = async (krId: string, prevValue: number, newValue: number, target: number) => {
  const prevPct = (prevValue / target) * 100
  const newPct = (newValue / target) * 100

  for (const threshold of KR_THRESHOLDS) {
    if (prevPct < threshold && newPct >= threshold) {
      await sendKRNotification(krId, threshold)
      // Dedup: set Redis key kr:notified:{krId}:{threshold} with 90d TTL
    }
  }
}
```

---

## Dependencies

- Epic 007 Story-025 (GitHub webhook for automated metric rules)
- `StrategicTheme` model (Epic 006 Story-025)
- `@repo/notifications`
- Strategy Map (Story-029 in Epic 007)

---

## Definition of Done

- [ ] OKR CRUD (≤10/ART/quarter, ≤5 KRs per OKR)
- [ ] `KeyResultSnapshot` (manual daily dedup, automated via webhook)
- [ ] Threshold notifications at 25/50/75/100% with deduplication
- [ ] "At Risk" badge when projected completion < 85%
- [ ] Quarter-close auto-archive with `finalAchievement`
- [ ] Past Quarters filter
- [ ] PO blocked from ART-level OKR creation (403)
- [ ] OKR → Strategic Theme → Epic traceability
- [ ] Trend chart: linear projection + MANUAL vs AUTOMATED dot styles
- [ ] Unit tests: threshold dedup, max KRs, projection "At Risk" logic
