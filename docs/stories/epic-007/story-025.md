# Story 025 — GitHub SAFe-Aware Sync & DORA Metrics

**Epic:** 007 — Solution Train & Advanced Features
**Feature:** F-007-005 GitHub Integration & DORA
**WSJF:** 8.5 (userValue=7, timeValue=6, riskReduction=4, jobSize=2)
**Story Points:** 5
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As a** Developer,
**I want** my GitHub PRs and deployments automatically linked to Cosmos Stories and DORA metrics computed from real deployment data,
**so that** the SAFe hierarchy has traceable delivery evidence without manual tracking.

---

## Acceptance Criteria

### AC-001: PR merged closes Cosmos Story
Given a merged PR with body containing "Closes COSMOS-42",
When the GitHub webhook is processed,
Then:
- Story 42 has a linked PR with `prStatus=MERGED` and `prUrl=<github-pr-url>` within 5s
- `StateTransitionHistory` records a transition (if story was IN_REVIEW → DONE from PR merge)
- `SyncLog` entry created with `source=GITHUB`, `direction=INBOUND`, `action=UPDATED`

### AC-002: Branch naming auto-links story
Given a PR opened from branch `cosmos/story-42-implement-payment-flow`,
When the GitHub webhook fires (PR opened),
Then:
- Story 42 has the PR linked with `prStatus=OPEN` within 5s
- No "Closes COSMOS-42" keyword required when branch naming convention is used

### AC-003: Deployment status updates Feature.deployedAt
Given a GitHub `deployment_status` event with `state=success` and environment `production`,
When the webhook is processed,
Then:
- All Stories linked to the deploying PR are marked `status=DEPLOYED`
- If all Stories under a Feature are DEPLOYED: `Feature.deployedAt` is set to the deployment timestamp
- A notification is sent to the PO: "Feature '{title}' is now deployed to production"

### AC-004: Unlinked PR panel
Given a merged PR with no Cosmos ID in title, body, or branch name,
When the webhook fires,
Then:
- The PR appears in the "Unlinked PRs" panel within 10s
- NOT dropped silently
- RTE/PM can manually link it from the panel

### AC-005: DORA metric computation
Given an ART's GitHub integration has deployment events for the last 30 days,
When the DORA dashboard loads,
Then:
- Deployment Frequency: avg deployments/day in the period
- Lead Time for Changes: avg time from first commit to production deployment
- Change Failure Rate: % of deployments followed by an incident/rollback within 1h
- Mean Time to Restore: avg time from incident to next successful deployment
- DORA Elite/High/Medium/Low classification displayed

### AC-006: Only cosmos:* namespace writes to GitHub
Given a Feature receives a strategic theme update in Cosmos,
When the outbound sync to GitHub runs,
Then:
- A label `cosmos:theme:customer-growth` is created/updated on linked GitHub issues
- No non-`cosmos:` labels are modified
- Existing GitHub labels (e.g., `bug`, `enhancement`) are preserved

### AC-007: Webhook HMAC-SHA256 validation
Given a GitHub webhook arrives at `POST /api/webhooks/github`,
When the `X-Hub-Signature-256` header is validated,
Then:
- Valid signature → HTTP 200 within 200ms, Inngest job enqueued
- Invalid signature → HTTP 401, AuditLog entry, Sentry alert within 30s

### AC-008: GitHub Delivery UUID idempotency (48h)
Given the same GitHub webhook delivery UUID is received twice within 48h,
When the second request arrives,
Then:
- HTTP 200 returned within 100ms (idempotent ack)
- No duplicate data processing
- Redis key `webhook:github:{deliveryUUID}` has 48h TTL

---

## Technical Notes

### PR Linking Regex

```typescript
// Magic keyword matching in PR title/body
const COSMOS_KEYWORD_REGEX = /(?:Closes|Fixes|Resolves)\s+COSMOS-(\d+)/gi

// Branch naming convention
const COSMOS_BRANCH_REGEX = /^cosmos\/(?:story-)?(\d+)/i

const extractStoryIds = (pr: GitHubPR): string[] => {
  const ids: string[] = []
  const bodyMatches = [...(pr.body ?? '').matchAll(COSMOS_KEYWORD_REGEX)]
  ids.push(...bodyMatches.map(m => m[1]))
  const branchMatch = pr.headBranch.match(COSMOS_BRANCH_REGEX)
  if (branchMatch) ids.push(branchMatch[1])
  return [...new Set(ids)]
}
```

### DORA Computation

```typescript
// packages/analytics/src/dora.ts
export const computeDORAMetrics = async (artId: string, orgId: string, days: number = 30) => {
  const deployments = await getDeployments(artId, orgId, days)
  const incidents = await getIncidents(artId, orgId, days)

  const deployFrequency = deployments.length / days

  const leadTimes = deployments
    .filter(d => d.firstCommitAt)
    .map(d => (d.deployedAt.getTime() - d.firstCommitAt!.getTime()) / 3_600_000) // hours
  const avgLeadTime = mean(leadTimes)

  const failedDeployments = deployments.filter(d =>
    incidents.some(i => i.startedAt > d.deployedAt && i.startedAt < addHours(d.deployedAt, 1))
  )
  const changeFailureRate = failedDeployments.length / deployments.length

  const restorationTimes = incidents.map(i => (i.resolvedAt.getTime() - i.startedAt.getTime()) / 3_600_000)
  const mttr = mean(restorationTimes)

  return { deployFrequency, avgLeadTime, changeFailureRate, mttr, classification: classifyDORA({ deployFrequency, avgLeadTime, changeFailureRate, mttr }) }
}
```

---

## Dependencies

- Epic 007 Story-024 (webhook infrastructure — shared HMAC + Inngest pattern)
- Epic 006 Story + Feature models
- `StateTransitionHistory`
- `GitHubSync` model (integration config, repo mappings)
- `@repo/webhooks`

---

## Definition of Done

- [ ] GitHub App installation + webhook configuration
- [ ] PR→Story linking (keyword + branch naming convention)
- [ ] Deployment status → Story DEPLOYED + Feature.deployedAt
- [ ] Unlinked PR panel (not dropped silently)
- [ ] DORA metrics (4 metrics + Elite/High/Medium/Low classification)
- [ ] Outbound sync: `cosmos:*` namespace only (existing labels preserved)
- [ ] Webhook HMAC-SHA256 validation + Sentry alert on invalid
- [ ] GitHub Delivery UUID idempotency (48h Redis TTL)
- [ ] `SyncLog` entries for all inbound/outbound events
- [ ] Unit tests: PR linking regex, DORA computation, idempotency
