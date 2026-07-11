# Story 036 — Global Search, Notification System & Feature Flags

**Epic:** 008 — Enterprise & Scale
**Feature:** F-008-006 Platform Usability
**WSJF:** 7.0 (userValue=7, timeValue=5, riskReduction=3, jobSize=2)
**Story Points:** 8
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As a** Developer,
**I want** a command-palette global search, smart notifications with deduplication and digest mode, and feature flag management for progressive rollouts,
**so that** I can navigate the platform quickly, stay informed without notification overload, and new features are safely rolled out.

---

## Acceptance Criteria

### AC-001: Global search returns results within 200ms
Given a user types "payment gateway" in the command palette (`Cmd+K`),
When the query is processed,
Then:
- ≥1 relevant results appear within 200ms
- Results span multiple entity types (Epics, Features, Stories, Risks, Users)
- Results are org-scoped (no cross-tenant data)

### AC-002: Type prefix filtering
Given a user types `epic:payment` in the search bar,
When results render,
Then:
- Only Epic-type results are returned (no Features, Stories, Users, etc.)
- Prefix `feature:`, `risk:`, `sprint:`, `user:`, `art:` also work for their respective types

### AC-003: Role-filtered search results
Given a VIEWER-role user searches,
When results include Stories from ARTs they're not assigned to,
Then:
- Those Stories are excluded from results
- The VIEWER only sees entities they have `read` permission on

### AC-004: Notification deduplication within 1h
Given an anomaly fires and a notification is sent for `VELOCITY_DROP` on Team Alpha at 14:00,
When the same anomaly condition fires again at 14:45 (within 1h),
Then:
- No second notification is sent
- The existing notification's `updatedAt` is refreshed
- Redis dedup key: `notification:dedup:{type}:{entityId}:{orgId}` with 3600s TTL

### AC-005: Digest mode batches LOW notifications
Given a user sets ANOMALY LOW to `digestMode=DAILY`,
When 10 LOW anomaly notifications fire throughout the day,
Then:
- No individual notifications are sent for those 10 events
- At the configured daily digest time (e.g., 08:00 user timezone): a single digest email lists all 10
- Email subject: "Daily Summary: 10 flow anomalies detected"

### AC-006: Org Admin broadcast to all members
Given an Org Admin sends a broadcast announcement "Planned maintenance window 2026-06-15 20:00 UTC",
When sent,
Then:
- All org users with IN_APP channel enabled see the announcement pinned at the top within 10s
- Maximum 3 announcements pinned at once (4th removes oldest)

### AC-007: Feature flag org-level override
Given a feature flag `bpmn-editor` is disabled globally (default=false),
When an Org Admin sets an override to `true` for their org,
Then:
- The BPMN Editor feature is available for their org
- Other orgs without the override see the feature as disabled
- Override persists after the org admin logs out

### AC-008: Feature flag expiry
Given a `FeatureFlagOverride` with `expiresAt=2026-06-15`,
When the date passes,
Then:
- The override is automatically expired (Redis or DB TTL)
- The global default value resumes for that org
- The org admin receives an expiry notification: "Feature flag 'bpmn-editor' override expired"

---

## Technical Notes

### Global Search Architecture

```typescript
// apps/app/app/api/search/route.ts
// Uses PostgreSQL full-text search with GIN index
// Cache: Upstash Redis 30s for repeated queries

export async function GET(req: Request) {
  const { q, type, limit = 10 } = parseSearchParams(req)
  const session = await requireSession(req)

  const cacheKey = `search:${session.orgId}:${session.role}:${sha256(q + (type ?? ''))}}`
  const cached = await redis.get(cacheKey)
  if (cached) return Response.json(JSON.parse(cached))

  const results = await searchAllEntities({
    query: q,
    typeFilter: type,
    orgId: session.orgId,
    role: session.role,
    limit,
  })

  await redis.set(cacheKey, JSON.stringify(results), { ex: 30 })
  return Response.json(results)
}
```

### tsvector GIN Indexes

```sql
-- Add to each searchable entity migration
ALTER TABLE "Epic" ADD COLUMN search_vector tsvector;
CREATE INDEX idx_epic_search ON "Epic" USING gin(search_vector);

-- Trigger to keep search_vector updated
CREATE OR REPLACE FUNCTION update_epic_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector = to_tsvector('english',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.hypothesis, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER epic_search_vector_update
BEFORE INSERT OR UPDATE ON "Epic"
FOR EACH ROW EXECUTE FUNCTION update_epic_search_vector();
```

### Notification Dedup (Redis)

```typescript
// packages/notifications/src/dedup.ts
export const sendDedupedNotification = async (params: NotificationParams): Promise<boolean> => {
  const key = `notification:dedup:${params.type}:${params.entityId}:${params.orgId}`
  const setResult = await redis.set(key, '1', { nx: true, ex: 3600 }) // 1h dedup window

  if (!setResult) {
    // Already notified recently — refresh TTL only
    await redis.expire(key, 3600)
    return false
  }

  await createAndDispatchNotification(params)
  return true
}
```

### Feature Flag Resolution

```typescript
// packages/feature-flags/src/resolve.ts
export const resolveFlag = async (flagKey: string, orgId: string, userId?: string): Promise<boolean> => {
  // 1. Per-user override (highest priority)
  const userOverride = userId ? await prisma.featureFlagOverride.findFirst({
    where: { orgId, userId, flagKey, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }
  }) : null
  if (userOverride) return userOverride.value

  // 2. Org-level override
  const orgOverride = await prisma.featureFlagOverride.findFirst({
    where: { orgId, userId: null, flagKey, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }
  })
  if (orgOverride) return orgOverride.value

  // 3. Global default
  const flag = await prisma.featureFlag.findUnique({ where: { key: flagKey } })
  return flag?.defaultValue ?? false
}
```

---

## Dependencies

- PostgreSQL `tsvector` + GIN indexes on all searchable entities
- Upstash Redis (search cache, notification dedup)
- `FeatureFlag`, `FeatureFlagOverride`, `Notification`, `NotificationPreference` models
- `@repo/notifications` (dedup + digest dispatch)
- Inngest (digest job scheduling)

---

## Definition of Done

- [ ] Command palette `Cmd+K` with multi-entity search < 200ms (GIN index + 30s cache)
- [ ] Type prefix filtering (`epic:`, `feature:`, `risk:`, `user:`, `sprint:`, `art:`)
- [ ] Role-filtered results (VIEWER excluded from unassigned entities)
- [ ] Cross-tenant isolation in search results
- [ ] Notification dedup: 1h Redis window (`notification:dedup:{type}:{entityId}:{orgId}`)
- [ ] Digest mode: per-category, per-channel, per-severity config
- [ ] Org Admin broadcast: pinned, max 3, ≤10s delivery
- [ ] Feature flag: global default + org override + user override + expiry
- [ ] Flag override expiry notification
- [ ] Recent search history (20 items, per-user localStorage)
- [ ] Unit tests: GIN search query, dedup window, flag resolution priority, digest batching
