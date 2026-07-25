# Story 014 — INVEST Quality Gate with AI Analysis

**Epic:** 006 — Enhanced Portfolio & ART
**Feature:** F-004 Epic Quality Intelligence
**WSJF:** 6.5 (userValue=6, timeValue=5, riskReduction=4, jobSize=2)
**Story Points:** 8
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As a** Product Manager,
**I want** an AI-powered INVEST quality score on my epics with per-criterion feedback and a configurable gate on portfolio transitions,
**so that** only well-defined epics move to Portfolio Backlog and I get actionable guidance to improve quality.

---

## Acceptance Criteria

### AC-001: Full INVEST analysis returns per-criterion scores
Given an epic with >= 150 chars description and a valid hypothesis,
When `analyze-invest` runs,
Then:
- All six criteria return integer 0–100 scores
- A composite score is computed: `weighted(I×0.10 + N×0.15 + V×0.30 + E×0.20 + S×0.15 + T×0.10)`
- Scores stream back via SSE within 30s (non-cached)
- `Epic.investScore` and `investCriteria` JSON are persisted on completion

### AC-002: Insufficient content returns 422
Given an epic description of 80 characters,
When `analyze-invest` is triggered,
Then:
- HTTP 422 with `{code: "INSUFFICIENT_CONTENT", field: "description", minLength: 100, actual: 80}`
- `Epic.investScore` is unchanged

### AC-003: Rate limit returns 429 with retry-after
Given an org has exhausted their monthly AI analysis quota,
When `analyze-invest` is triggered,
Then:
- HTTP 429 with `{code: "AI_QUOTA_EXCEEDED", retryAfter: "<ISO timestamp of next billing period>", upgradeUrl: "..."}`
- No analysis runs, no credits consumed

### AC-004: 24h content-hash cache returns cached result
Given an identical analysis ran 2 hours ago with no field changes on the epic,
When `analyze-invest` is triggered without `forceRefresh: true`,
Then:
- HTTP 200 with `{cached: true, cachedAt: "<timestamp>"}` within 500ms
- No AI call is made, no credits consumed

### AC-005: Cache bypassed on forceRefresh
Given `forceRefresh: true` in the request body,
When `analyze-invest` runs,
Then:
- A new AI call is made even if a cache entry exists
- Cache is updated with the fresh result
- `Epic.investScoreOutdated` is reset to `false`

### AC-006: RTE manual override with DecisionLogEntry
Given an epic with `investScore: 35` (below threshold),
When an RTE with `portfolio:invest-override` permission submits a manual override with score 65 and justification "Risk reduction validated by SA review",
Then:
- `Epic.investScore` is updated to 65
- `Epic.investScoreOverridden` = true
- A `DecisionLogEntry` is written with `type: INVEST_OVERRIDE`, previous score, new score, justification, and RTE userId

### AC-007: ANALYZING → PORTFOLIO_BACKLOG gate blocks on low score
Given an ANALYZING epic with `investScore: 38` (default threshold 40),
When the state machine evaluates the transition guard,
Then:
- 422 `GUARD_FAILED` with `{guard: "investScore", current: 38, required: 40}`
- Transition does not occur
- `Epic.status` remains ANALYZING

### AC-008: Score invalidation on description change
Given an epic has `investScore: 72` and `investScoreOutdated: false`,
When the description is updated via the `improve-description` action or manual edit,
Then:
- `Epic.investScoreOutdated` is set to `true`
- A warning banner "INVEST score may be outdated — re-analyze before moving this epic" appears on the portfolio card and detail page

---

## Technical Notes

### Rate Limiting (Upstash)

```typescript
// packages/ai/src/rate-limit.ts
const INVEST_LIMITS = {
  STARTER:    { window: '30d', tokens: 200 },
  GROWTH:     { window: '30d', tokens: 2000 },
  ENTERPRISE: { window: '30d', tokens: Infinity },
}
```

### Content-Hash Cache

```typescript
// Cache key: ai:cache:{orgId}:invest:{sha256(description+hypothesis+businessOutcomes)}
// TTL: 24h, SET NX
// On epic field mutation: invalidate cache + set investScoreOutdated=true
const cacheKey = `ai:cache:${ctx.orgId}:invest:${sha256([
  epic.description,
  epic.hypothesis,
  JSON.stringify(epic.businessOutcomes),
].join(':'))}`
```

### Streaming Response

```typescript
// apps/app/app/api/ai-prompt/route.ts
export async function POST(request: Request) {
  const { feature, epicId, forceRefresh } = await request.json()

  if (feature === 'analyze-invest') {
    // Rate limit → cache check → streamText
    const result = streamText({
      model: openai('claude-sonnet-4-6'),
      system: INVEST_SYSTEM_PROMPT,
      prompt: buildInvestPrompt(epic),
      onFinish: async ({ text }) => {
        const scores = parseInvestResponse(text)
        await persistInvestScore(epicId, scores)
      }
    })
    return result.toDataStreamResponse()
  }
}
```

### INVEST Prompt Structure

```
Analyze this SAFe Epic against the INVEST criteria. For each criterion, provide:
1. Score 0–100 (integer)
2. One-sentence feedback
3. One-sentence improvement suggestion

Criteria weights: Independent(10%) Negotiable(15%) Valuable(30%) Estimable(20%) Small(15%) Testable(10%)

Epic:
Title: {title}
Description: {description}
Hypothesis: {hypothesis}
Business Outcomes: {outcomes}
MVP: {mvp}
NFRs: {nfrs}

Return JSON: {I:{score,feedback,suggestion}, N:{...}, V:{...}, E:{...}, S:{...}, T:{...}, composite: number}
```

---

## Dependencies

- Story-011 (state machine guard uses investScore)
- Story-013 (LBC fields feed into analysis)
- Story-022 (AI infra — shared rate limit + cache)
- `@repo/ai` shared utilities
- Upstash Redis for rate limit + cache

---

## Definition of Done

- [ ] `analyze-invest` server action with Upstash rate limit + content-hash cache
- [ ] SSE streaming via Vercel AI SDK `streamText`
- [ ] Per-criterion scores (0–100) + weighted composite persisted to `Epic.investScore` + `investCriteria`
- [ ] 422 INSUFFICIENT_CONTENT for < 100 chars description
- [ ] 429 AI_QUOTA_EXCEEDED with retryAfter
- [ ] 24h cache with `cached: true` flag, 500ms response
- [ ] `forceRefresh` bypasses cache
- [ ] RTE manual override → `DecisionLogEntry` + `investScoreOverridden=true`
- [ ] `investScoreOutdated=true` on description/hypothesis edit
- [ ] State machine guard integration (Story-011 ANALYZING → PORTFOLIO_BACKLOG)
- [ ] Structured audit log (model, tokens, latency, cached, orgId, epicId)
- [ ] Unit tests: all error codes, cache hit/miss, score persistence
