# Story 032 — Velocity & Capacity Analytics, ROI Intelligence & Member Metrics

**Epic:** 007 — Solution Train & Advanced Features
**Feature:** F-007-012 Performance Intelligence
**WSJF:** 7.0 (userValue=6, timeValue=5, riskReduction=4, jobSize=2)
**Story Points:** 8
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As an** RTE,
**I want** velocity trends, capacity heatmaps, ROI hypothesis tracking, and privacy-guarded member metrics,
**so that** I can coach teams on predictability and show business owners the value delivered per dollar spent.

---

## Acceptance Criteria

### AC-001: Velocity trend chart renders per sprint
Given 6 completed sprints,
When the velocity trend opens,
Then:
- A grouped bar chart renders per sprint showing 3 bars: committed / completed / accepted points
- Rolling average overlay line at sprint 4+ (requires ≥3 data points)
- If committed = 0: predictability shows "N/A" (no division by zero)

### AC-002: Capacity utilization heatmap
Given 4 teams × 5 sprints in the current PI,
When the capacity heatmap renders,
Then:
- Each team×sprint cell shows utilization% with color bands:
  - < 80%: green
  - 80–100%: yellow
  - > 100%: red (always red, non-configurable)
- Hover shows: planned/actual/capacity in both points and hours

### AC-003: PI predictability score (PPM ≥80% benchmark)
Given a closed PI with PPM = 73%,
When predictability is displayed,
Then:
- Score shows 73% with a warning: "Below SAFe 80% predictability benchmark"
- A `LOW_PREDICTABILITY` HIGH anomaly is shown if < 70% for 3 consecutive PIs
- Stretch objectives are excluded from computation

### AC-004: Epic ROI hypothesis tracking
Given an epic with 3 business outcomes (2 with `confirmed=true`, 1 pending),
When the ROI tab renders,
Then:
- Hypothesis confidence shows 67% (2/3 confirmed)
- Green checkmarks on confirmed outcomes, grey dots on pending
- An AI-generated ROI summary card is available (uses `streamText`)

### AC-005: Cost-per-point trend
Given an ART with 3 PIs of cloud cost and accepted story points data,
When the cost-per-point chart renders,
Then:
- A line chart shows cost/point per PI with a trendline
- If the trend is increasing >10%/PI, a MEDIUM anomaly badge appears
- Projection shows estimated cost/point for the next PI based on linear regression

### AC-006: Member metrics privacy (SM-only)
Given a Developer requests another member's individual stats via the API,
When processed,
Then:
- HTTP 403 `{code: "INSUFFICIENT_ROLE", message: "Individual member stats require SM role"}`
- No data is returned

Given an SM views the team's member stats panel,
Then:
- Per-member: throughput (stories/sprint), cycle time, HIGH/CRITICAL defect rate, standup cadence
- No leaderboard ranking — stats presented per-individual only, not sorted/ranked

### AC-007: Low predictability anomaly at <70% for 3 consecutive PIs
Given a team with PI predictability scores [68%, 65%, 71%] (all < 70%),
When the anomaly run evaluates,
Then:
- A `LOW_PREDICTABILITY` HIGH anomaly is created for the team
- SM and RTE are notified with a "3 consecutive PIs below 70% threshold" message

### AC-008: Team skill heatmap (anonymous for non-SM/RTE)
Given a team with 5 members, each with `CompetencyAssessment` records,
When a DEVELOPER views the team heatmap,
Then:
- Individual columns are anonymized (no names shown)
- Only team averages per skill are shown with the viewing user's own row visible

When an SM views it,
Then:
- All individual rows with names and levels are shown (no anonymization)

---

## Technical Notes

### Velocity Predictability Computation

```typescript
const computePredictability = (sprints: SprintReview[]): number | null => {
  const withCommitments = sprints.filter(s => s.committedPoints > 0)
  if (withCommitments.length === 0) return null
  return withCommitments.reduce((sum, s) => sum + s.acceptedPoints / s.committedPoints, 0) / withCommitments.length
}
```

### Cost-Per-Point

```typescript
const costPerPoint = (artId: string, piPlanId: string) => {
  // cloud spend for PI period (via CostSnapshot) / accepted story points
  const spend = await getCostSnapshotForPI(artId, piPlanId)
  const points = await getTotalAcceptedPoints(artId, piPlanId)
  return points > 0 ? spend / points : null
}
```

### Member Metrics Privacy

```typescript
export const getMemberMetrics = withSecureAction(
  { schema: MemberMetricsSchema, requiredRole: 'SCRUM_MASTER', auditAction: 'analytics.member.viewed', auditResourceType: 'TeamMember' },
  async ({ teamId, memberId }, ctx) => {
    // requiredRole enforced by withSecureAction — DEVELOPER will get 403 before reaching here
    const metrics = await computeMemberMetrics(teamId, memberId, ctx.orgId)
    // Exclude: detailed PR activity, performance ratings, manager feedback
    return {
      throughput: metrics.throughput,
      cycleTime: metrics.cycleTime,
      defectRate: metrics.criticalHighDefectRate,
      standupCadence: metrics.standupCadencePct,
    }
  }
)
```

---

## Dependencies

- `FlowMetricSnapshot` (Epic 007 Story-022)
- `SprintReview`, `PIObjective` (Epic 006)
- `CompetencyAssessment`, `PersonSkillProfile` models
- `CostSnapshot` + `PersonCost` (Epic 007 Story-023/030)
- Epic 007 Story-021 anomaly engine (LOW_PREDICTABILITY rule)

---

## Definition of Done

- [ ] Velocity trend: committed/completed/accepted grouped bar chart + rolling average
- [ ] "N/A" predictability on zero committed (no division by zero)
- [ ] Capacity heatmap: team×sprint, green/yellow/red bands
- [ ] PI PPM ≥80% benchmark indicator
- [ ] `LOW_PREDICTABILITY` anomaly at <70% for 3 consecutive PIs
- [ ] Epic ROI hypothesis confidence score (confirmed/total outcomes)
- [ ] Cost-per-point trend + increasing >10%/PI MEDIUM anomaly badge
- [ ] Member metrics: SM-only access (403 for others)
- [ ] Team skill heatmap: anonymized for DEVELOPER, full for SM/RTE
- [ ] Unit tests: predictability formula (zero division), LOW_PREDICTABILITY trigger, heatmap anonymization
