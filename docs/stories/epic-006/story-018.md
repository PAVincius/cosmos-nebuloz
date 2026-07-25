# Story 018 — Confidence Vote (Multi-Round, Anonymous, Cross-PI History)

**Epic:** 006 — Enhanced Portfolio & ART
**Feature:** F-008 PI Planning Consensus
**WSJF:** 6.25 (userValue=6, timeValue=5, riskReduction=4, jobSize=2)
**Story Points:** 5
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As an** RTE (Facilitator),
**I want** to run anonymous multi-round confidence votes during PI Planning, with threshold-gated commitment and cross-PI trend history,
**so that** the team's commitment confidence is measured honestly and trend data helps predict execution success.

---

## Acceptance Criteria

### AC-001: Overlay delivered to all non-OBSERVER participants
Given the facilitator opens a confidence vote in a FINAL_PLAN session,
When `ConfidenceVoteSession` is created with `status=OPEN`,
Then:
- All non-OBSERVER participants (≤500 connected) see the full-screen fist-of-five overlay within 2s via Liveblocks broadcast
- OBSERVER participants do not see the overlay
- The overlay shows vote scale 1–5 with SAFe fist-of-five imagery

### AC-002: Votes are anonymous at the data layer
Given any participant casts a vote (score 3),
When the vote is processed,
Then:
- No record links the vote to the user (no `userId` in any vote record)
- Only the aggregate `ConfidenceVoteTally.score3Count` increments
- Server-side: the only vote tracking is per-session tally counts, not individual votes

### AC-003: Reveal gate at ≥50% participation
Given 40% of participants have voted,
When the facilitator attempts to reveal,
Then:
- HTTP 422 `{code: "REVEAL_GATE_NOT_MET", current: 40, required: 50, message: "Only 40% of participants have voted (minimum 50% required)"}`
- Results remain hidden

Given 52% participation,
When the facilitator reveals,
Then:
- All participants see the vote histogram with count per score (1–5)
- `aggregateScore = Σ(score × count) / totalVotes` is displayed (e.g., "3.2")

### AC-004: Aggregate score blocks commitment below threshold
Given round 1 closes with `aggregateScore = 2.4` (default threshold = 3.0),
When the RTE attempts to commit the PI Plan (from Story-017),
Then:
- Commitment gate returns 422: "Confidence score 2.4 is below the required 3.0 threshold"
- Force-commit override with ≥20-char reason is still available (as per Story-017)

### AC-005: Multi-round support
Given round 1 closes with a score below threshold,
When the facilitator opens round 2,
Then:
- A new `ConfidenceVoteTally` row is created with `round=2`
- The round-1 tally is immutable (no further votes accepted for round 1)
- The overlay reappears for all non-OBSERVER participants
- Both rounds are visible in the "Round History" panel within the PISession

### AC-006: ≤10 rounds facilitator note
Given 10 rounds have been completed without reaching threshold,
When the facilitator attempts to open round 11,
Then:
- A warning modal: "You've reached 10 rounds. Please add a facilitator note before continuing."
- A `facilitatorNote` text input is required before round 11 opens

### AC-007: Cross-PI trend chart
Given an org with 3 completed PIs, each with at least 1 closed confidence vote session,
When the "Confidence Vote History" tab is viewed on the PI Planning console,
Then:
- A line chart shows the final-round `aggregateScore` per PI (3 data points)
- Each point is labeled with PI name and date
- A horizontal reference line at the configured threshold (default 3.0) is shown

### AC-008: Closed rounds are immutable
Given a closed `ConfidenceVoteTally` (round 1),
When any vote attempt is made for that session/round combination,
Then:
- HTTP 422 `{code: "ROUND_CLOSED"}`
- Tally is unchanged

---

## Technical Notes

### Anonymous Vote Architecture

```typescript
// CRITICAL: No user↔vote mapping at any layer
// Client sends: POST /api/confidence-votes/{sessionId}/cast
// Body: { score: 3 }  // no userId
// Server validates session ownership (via auth middleware) but does NOT store userId with vote
// Server atomically increments the tally count via Redis or Prisma transaction

// Prisma transaction (atomic increment)
await prisma.confidenceVoteTally.update({
  where: { sessionId_round: { sessionId, round: session.currentRound } },
  data: {
    score3Count: { increment: 1 },
    totalVotes: { increment: 1 },
  },
})

// Participation tracking: just count (not who voted)
// participationRate = totalVotes / eligibleParticipants
// eligibleParticipants = count(PIParticipant where role != OBSERVER and piPlanId = ...)
```

### Liveblocks Broadcast (not Storage)

```typescript
// apps/app/app/api/confidence-votes/[sessionId]/route.ts
// Open vote: broadcast event to room members
// Do NOT store individual votes in Liveblocks Storage
// Only broadcast: {type: 'VOTE_OPENED', round, participantCount}
// On reveal: broadcast {type: 'VOTE_REVEALED', round, histogram: {1:n, 2:n, ...}, aggregateScore}

const room = liveblocks.getRoom(`${orgId}:confidence-vote:${sessionId}`)
await room.broadcastEvent({ type: 'VOTE_OPENED', round: currentRound })
```

### ConfidenceVoteTally Model

```prisma
model ConfidenceVoteTally {
  id               String   @id @default(cuid())
  orgId            String
  sessionId        String
  piPlanId         String
  round            Int      @default(1)
  score1Count      Int      @default(0)
  score2Count      Int      @default(0)
  score3Count      Int      @default(0)
  score4Count      Int      @default(0)
  score5Count      Int      @default(0)
  totalVotes       Int      @default(0)
  participantCount Int      @default(0)
  participationRate Float   @default(0)
  aggregateScore   Float?
  revealedAt       DateTime?
  closedAt         DateTime?
  facilitatorNote  String?
  createdAt        DateTime @default(now())
  @@unique([sessionId, round])
  @@index([piPlanId])
}
```

---

## Dependencies

- Story-017 (PI Plan lifecycle — confidence score feeds commitment gate)
- Story-026 (PISession phases — vote opened in FINAL_PLAN phase)
- Liveblocks broadcast (not storage) for overlay delivery
- `@repo/notifications` for session start notifications

---

## Definition of Done

- [ ] `ConfidenceVoteTally` model with no user↔vote mapping
- [ ] Full-screen overlay via Liveblocks broadcast to non-OBSERVER participants within 2s
- [ ] Vote cast: atomic tally increment, no userId stored
- [ ] Reveal gate: ≥50% (configurable per-ART, min 25%) participation required
- [ ] Aggregate score = weighted sum / totalVotes
- [ ] Multi-round: new tally per round, prior round immutable
- [ ] ≤10 rounds facilitator note gate
- [ ] Cross-PI trend chart (line chart, final-round score per PI, threshold line)
- [ ] Commitment gate integration with Story-017 (score < threshold → 422)
- [ ] RLS: tallies scoped to orgId
- [ ] Unit tests: anonymous vote, participation rate, reveal gate, multi-round immutability
