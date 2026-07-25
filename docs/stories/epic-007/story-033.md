# Story 033 — Staleness Detection, Narrative Generation & Pair Synergy

**Epic:** 007 — Solution Train & Advanced Features
**Feature:** F-007-013 Flow Intelligence (cont.)
**WSJF:** 5.5 (userValue=5, timeValue=4, riskReduction=4, jobSize=2)
**Story Points:** 5
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As a** Scrum Master,
**I want** automatic staleness detection with nudges, AI-generated sprint/PI narratives with recommended SAFe actions, and opt-in pair synergy scores,
**so that** my team stays unblocked, I have coaching intelligence, and can make data-driven pairing decisions.

---

## Acceptance Criteria

### AC-001: Staleness detection creates STALE anomaly
Given a story in IN_PROGRESS for 6 business days with no status change or task updates,
When the nightly staleness cron (03:00 UTC) runs,
Then:
- A `STALE_STORY` LOW anomaly is created (if none already open for this story)
- The story card shows a "6d stale" badge on the sprint board

### AC-002: Resolved story excluded from staleness
Given a story transitions to DONE,
When the staleness cron runs the next day,
Then:
- The story is excluded from the staleness check
- Any existing `STALE_STORY` anomaly for it is auto-resolved

### AC-003: SM nudge notification
Given the SM uses "Nudge Team" on 3 stale stories,
When the nudge action is submitted,
Then:
- Each story's assignee receives a deep-linked notification within 30s: "{Story title} hasn't moved in {n} days. Take a look?"
- A `StalenessAuditLog` entry records the nudge (who, when, which story)

### AC-004: AI sprint narrative includes SAFe action
Given a CLOSED sprint with 3+ standup entries and anomaly data,
When the SM generates a sprint narrative,
Then:
- The narrative renders within 10s (if AI is available)
- Response includes ≥1 finding with a severity label
- Each finding includes a SAFe-specific recommended action (e.g., "SM to run emergency retrospective", "RTE to review capacity")
- No SAFe jargon present when "Executive mode" is enabled

### AC-005: AI unavailable → template narrative
Given the AI service returns a 503 or budget is exhausted,
When the SM clicks "Generate Sprint Summary",
Then:
- A template-based narrative renders within 3s
- A banner: "AI generation unavailable — using structured summary template"
- No error state shown to the user

### AC-006: Pair synergy score computed (opt-in)
Given pair synergy is enabled for the org (`pairSynergy.enabled=true`),
And two members (Alice, Bob) are co-assigned in 5 of 6 sprints with no negative signals (no blockers mentioning each other),
When synergy scores compute (nightly post-processing),
Then:
- `PairSynergy.score >= 0.7` for Alice-Bob pair
- The score is visible only to Alice and Bob on their own profile pages
- SM sees all scores in the team coaching view (no restriction for SM)

### AC-007: Pair synergy disabled by default
Given a new org with no synergy configuration,
When the pair synergy section is accessed,
Then:
- All scores are hidden with: "Pair synergy analysis is disabled. An Org Admin can enable it in Settings > Flow Intelligence."
- No computation runs when `pairSynergy.enabled=false`

### AC-008: Narrative executive jargon translation
Given the "SAFe terminology for executives" setting is disabled for the org,
When an executive summary narrative is generated,
Then:
- Output contains no "ART", "PI", "velocity", "WSJF", or "INVEST" terms
- These terms are replaced with plain-language equivalents ("Agile Release Train" → "engineering group", "PI" → "program increment period")

---

## Technical Notes

### Staleness Thresholds

```typescript
const STALENESS_THRESHOLDS = {
  STORY_IN_PROGRESS: 5,       // business days
  STORY_TODO: 10,             // business days
  RISK_UNCLASSIFIED: 3,       // business days
  IMPEDIMENT_OPEN: 3,         // business days
  EPIC_ANALYZING: 30,         // calendar days
  EPIC_PORTFOLIO_BACKLOG: 60, // calendar days
  FEATURE_DEFINED: 21,        // calendar days
} as const
```

### AI Narrative with SAFe Actions

```typescript
const SPRINT_NARRATIVE_PROMPT = (sprint: SprintData, anomalies: Anomaly[], executiveMode: boolean) => `
You are a SAFe coach summarizing a sprint delivery. ${executiveMode ? 'Use plain language. No SAFe terminology.' : 'Use SAFe terminology.'}

Provide:
1. Overall sprint health: GREEN/AMBER/RED
2. Top 3 findings, each with:
   - severity: LOW/MEDIUM/HIGH/CRITICAL
   - description: 1-2 sentences
   - recommended_action: specific SAFe-aligned action (e.g., "SM should run a focused retrospective on the blocker patterns identified")

Sprint data: ${JSON.stringify(sprint)}
Anomalies: ${JSON.stringify(anomalies)}
`
```

### Pair Synergy Computation

```typescript
// packages/analytics/src/pair-synergy.ts
export const computePairSynergy = async (teamId: string, orgId: string, sprintCount: number = 6) => {
  const recentSprints = await getRecentSprints(teamId, sprintCount)
  const members = await getTeamMembers(teamId)

  for (const [i, memberA] of members.entries()) {
    for (const memberB of members.slice(i + 1)) {
      const coAssigned = recentSprints.filter(s =>
        s.stories.some(story => story.assignees.includes(memberA.id) && story.assignees.includes(memberB.id))
      ).length

      // Decay factor: older sprints count less
      const coMentioned = await getCoStandupMentions(memberA.id, memberB.id, recentSprints)
      const githubCollaboration = await getGitHubCollaborationScore(memberA.id, memberB.id)

      const rawScore = (coAssigned / sprintCount) * 0.5 + githubCollaboration * 0.3 + coMentioned * 0.2
      const score = Math.min(1.0, rawScore)

      await prisma.pairSynergy.upsert({
        where: { teamId_member1Id_member2Id: { teamId, member1Id: memberA.id, member2Id: memberB.id } },
        update: { score, computedAt: new Date() },
        create: { teamId, orgId, member1Id: memberA.id, member2Id: memberB.id, score },
      })
    }
  }
}
```

---

## Dependencies

- Epic 007 Story-021 anomaly engine (staleness scheduling)
- `StalenessAuditLog` model
- `PairSynergy` model
- `@repo/ai` (narrative generation)
- `@repo/notifications` (nudge dispatch)
- Epic 006 standup data (Story-022)

---

## Definition of Done

- [ ] Staleness cron at 03:00 UTC with per-type thresholds
- [ ] `STALE_*` LOW anomaly with deduplication (no second open anomaly per entity)
- [ ] Auto-resolve stale anomaly when entity resolves
- [ ] SM nudge: assignee notification within 30s + `StalenessAuditLog`
- [ ] AI sprint narrative: ≥1 finding with severity + SAFe action within 10s
- [ ] Template fallback on AI unavailability (< 3s)
- [ ] Executive mode: no SAFe jargon in output
- [ ] Pair synergy: opt-in, nightly computation, privacy-scoped visibility
- [ ] Pair synergy disabled by default (no computation when off)
- [ ] Unit tests: staleness thresholds, auto-resolve, synergy score formula, jargon filter
